import { createHash } from 'node:crypto'
import { buildClinicalBriefHtml, clinicalBriefFilename } from './lib/clinical-brief.js'

const DEFAULT_SITE = 'default'
const DEFAULT_DOCUMENT_PATH = '/Medical_Record'
const DOCUMENT_MIME = 'text/html; charset=utf-8'
const REQUIRED_STANDARD_SCOPES = ['api:oemr', 'user/patient.crus', 'user/document.crs']

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function canonicalDocumentPath(value) {
  const raw = String(value || DEFAULT_DOCUMENT_PATH).trim() || DEFAULT_DOCUMENT_PATH
  const parts = raw.split('/').filter(Boolean).map((part) => part.trim().replace(/\s+/g, '_'))
  return `/${parts.join('/')}`
}

function displayDocumentPath(path) {
  return String(path || '').replaceAll('_', ' ').replace(/^\//, '')
}

function configuration() {
  const baseUrl = String(process.env.OPENEMR_BASE_URL || '').replace(/\/+$/, '')
  const site = String(process.env.OPENEMR_SITE || DEFAULT_SITE).trim() || DEFAULT_SITE
  const documentPath = canonicalDocumentPath(process.env.OPENEMR_DOCUMENT_PATH || DEFAULT_DOCUMENT_PATH)
  const encodedSite = encodeURIComponent(site)
  return {
    baseUrl,
    site,
    documentPath,
    apiBase: baseUrl ? `${baseUrl}/apis/${encodedSite}/api` : '',
    fhirBase: baseUrl ? `${baseUrl}/apis/${encodedSite}/fhir` : '',
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

function tokenScopes(value) {
  return new Set(String(value || '').split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean))
}

function hasDocumentScope(scopes) {
  if (!scopes.size) return true
  const hasApi = scopes.has('api:oemr')
  const hasPatient = scopes.has('user/patient.crus') || scopes.has('user/patient.rs') || scopes.has('user/patient.r')
  const hasDocument = scopes.has('user/document.crs') || scopes.has('user/document.c') || scopes.has('user/document.cruds')
  return hasApi && hasPatient && hasDocument
}

function hasResponseErrors(value) {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0)
}

function extractError(body, fallback) {
  const validation = body?.validationErrors
  const internal = body?.internalErrors
  if (Array.isArray(validation) && validation.length) return validation.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
  if (validation && typeof validation === 'object' && Object.keys(validation).length) return JSON.stringify(validation)
  if (Array.isArray(internal) && internal.length) return internal.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
  if (internal && typeof internal === 'object' && Object.keys(internal).length) return JSON.stringify(internal)
  return body?.issue?.[0]?.diagnostics || body?.error_description || body?.error || body?.message || body?.text || fallback
}

async function fetchOpenEmr(url, options = {}) {
  const response = await fetch(url, { redirect: 'error', ...options })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { text } }
  if (!response.ok) {
    const error = new Error(extractError(body, `OpenEMR returned ${response.status}.`))
    error.status = response.status
    error.body = body
    throw error
  }
  return { response, body }
}

function authHeaders(accessToken, accept = 'application/json') {
  if (!accessToken || typeof accessToken !== 'string') throw new Error('OpenEMR authorization is required.')
  return { Authorization: `Bearer ${accessToken}`, Accept: accept }
}

async function resolveNumericPid(config, accessToken, patientUuid) {
  const { body } = await fetchOpenEmr(`${config.apiBase}/patient/${encodeURIComponent(patientUuid)}`, {
    headers: authHeaders(accessToken),
  })
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data
  if (!data?.pid) throw new Error('OpenEMR returned the patient chart but did not include its internal numeric patient ID.')
  return String(data.pid)
}

function documentUrl(config, pid, path) {
  const query = new URLSearchParams({ path })
  return `${config.apiBase}/patient/${encodeURIComponent(pid)}/document?${query.toString()}`
}

function bundleResources(body) {
  if (body?.resourceType !== 'Bundle' || !Array.isArray(body.entry)) return []
  return body.entry.map((entry) => entry?.resource).filter(Boolean)
}

function attachmentMatch(resource, filename) {
  const target = filename.toLowerCase()
  for (const content of resource?.content || []) {
    const attachment = content?.attachment
    const title = String(attachment?.title || '').trim()
    if (title.toLowerCase() === target) return attachment
  }
  return null
}

function categoryLabels(resource) {
  return (resource?.category || [])
    .flatMap((category) => [category?.text, ...(category?.coding || []).map((coding) => coding?.display || coding?.code)])
    .filter(Boolean)
    .map(String)
}

async function verifyThroughFhir(config, accessToken, patientUuid, filename) {
  let observedTitles = []
  let lastError = null
  const patientValues = [patientUuid, `Patient/${patientUuid}`]

  for (const delayMs of [0, 500, 1500, 3000, 5000]) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    for (const patient of patientValues) {
      const query = new URLSearchParams({ patient, _count: '200' })
      try {
        const { body } = await fetchOpenEmr(`${config.fhirBase}/DocumentReference?${query.toString()}`, {
          headers: authHeaders(accessToken, 'application/fhir+json, application/json'),
        })
        const resources = bundleResources(body)
        observedTitles = [...new Set(resources.flatMap((resource) => (resource?.content || []).map((item) => String(item?.attachment?.title || '')).filter(Boolean)))]
        const match = resources.find((resource) => attachmentMatch(resource, filename))
        if (!match) continue
        const attachment = attachmentMatch(match, filename)
        return {
          id: String(match.id || ''),
          filename,
          mimetype: String(attachment?.contentType || 'text/html'),
          docdate: String(match.date || match.meta?.lastUpdated || ''),
          binaryUrl: String(attachment?.url || ''),
          categories: categoryLabels(match),
          verificationMethod: 'FHIR DocumentReference search',
        }
      } catch (error) {
        lastError = error
        const status = Number(error?.status) || 0
        if (status === 401 || status === 403) throw error
        if (status !== 404) throw error
      }
    }
  }

  if (lastError && Number(lastError?.status) !== 404) throw lastError
  const names = observedTitles.slice(0, 8)
  throw new Error(`OpenEMR accepted the clinical brief in ${displayDocumentPath(config.documentPath)}, but FHIR did not expose it afterward. Visible titles: ${names.length ? names.join(', ') : 'none'}.`)
}

async function uploadPatientDocument(config, accessToken, pid, patientUuid, filename, content) {
  const form = new FormData()
  form.append('document', new Blob([content], { type: DOCUMENT_MIME }), filename)

  const { response, body } = await fetchOpenEmr(documentUrl(config, pid, config.documentPath), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: form,
  })

  const failed = body === false || body?.data === false || hasResponseErrors(body?.internalErrors) || hasResponseErrors(body?.validationErrors)
  if (failed) throw new Error(extractError(body, `OpenEMR declined the document category ${displayDocumentPath(config.documentPath)}.`))

  const responseId = String(body?.data?.id || body?.id || '').trim()
  if (responseId) {
    return {
      id: responseId,
      filename,
      mimetype: 'text/html',
      docdate: new Date().toISOString(),
      binaryUrl: '',
      categories: [displayDocumentPath(config.documentPath)],
      verificationMethod: 'OpenEMR native upload response',
      responseStatus: response.status,
    }
  }

  return verifyThroughFhir(config, accessToken, patientUuid, filename)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' })

  const config = configuration()
  if (!config.baseUrl) return sendJson(res, 503, { error: 'OpenEMR is not configured yet.', code: 'OPENEMR_NOT_CONFIGURED' })

  try {
    const parsed = new URL(config.baseUrl)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('OpenEMR must use HTTPS.')

    const body = await readBody(req)
    const accessToken = String(body.accessToken || '')
    const patientId = String(body.patientId || '')
    const packet = body.packet
    const options = body.options || {}
    if (!accessToken || !patientId || !packet?.patient || !Array.isArray(packet?.sources)) {
      return sendJson(res, 400, { error: 'Authorization, patient, and packet are required.' })
    }

    const granted = tokenScopes(body.grantedScope)
    const scopeClaimMismatch = granted.size > 0 && !hasDocumentScope(granted)
    const pid = await resolveNumericPid(config, accessToken, patientId)
    const content = buildClinicalBriefHtml(packet)
    const filename = clinicalBriefFilename(packet.patient.name)
    const expectedHash = createHash('sha3-512').update(content, 'utf8').digest('hex')
    const uploaded = await uploadPatientDocument(config, accessToken, pid, patientId, filename, content)

    const warnings = []
    if (scopeClaimMismatch) warnings.push(`OpenEMR's token response did not list all expected Standard API scopes (${REQUIRED_STANDARD_SCOPES.join(', ')}), but the upload and verification succeeded.`)
    warnings.push('A print-ready HTML clinical brief was stored in Medical Record with patient-entered facts, discrepancies, and source provenance.')
    if (options.includeLabs && (packet.labs || []).length) warnings.push(`${packet.labs.length} laboratory result${packet.labs.length === 1 ? '' : 's'} were included in the clinical brief because this OpenEMR capability statement does not advertise Observation creation.`)
    if (options.includeConditions && (packet.patient.conditions || []).length) warnings.push('Conditions remained in the reviewed brief; no duplicate problem-list entries were created.')
    if (options.includeAllergies && (packet.patient.allergies || []).length) warnings.push('Allergy statements remained in the reviewed brief; no duplicate allergy entries were created.')
    if (options.includeProvenance) warnings.push('Source provenance is embedded in the clinical brief and receipt; no separate FHIR Provenance resource was created for the native OpenEMR document upload.')
    if ((packet.medications || []).some((item) => item.status !== 'confirmed')) warnings.push('Medication discrepancies were highlighted in the clinical brief only. No medication orders were created.')

    const resourceType = uploaded.verificationMethod === 'FHIR DocumentReference search' ? 'DocumentReference' : 'PatientDocument'
    const location = resourceType === 'DocumentReference'
      ? `${config.fhirBase}/DocumentReference/${encodeURIComponent(uploaded.id)}`
      : `${config.apiBase}/patient/${encodeURIComponent(pid)}/document/${encodeURIComponent(uploaded.id)}`

    return sendJson(res, 200, {
      status: 'success',
      importedAt: new Date().toISOString(),
      patientId,
      openEmr: { baseUrl: config.baseUrl, site: config.site, software: 'OpenEMR', version: '8.1.1' },
      resources: [{ resourceType, id: uploaded.id, location, status: 'verified' }],
      failures: [],
      warnings,
      document: {
        filename: uploaded.filename,
        categoryPath: config.documentPath,
        categories: uploaded.categories?.length ? uploaded.categories : [displayDocumentPath(config.documentPath)],
        pid,
        mimetype: uploaded.mimetype,
        format: 'html-clinical-brief',
        docdate: uploaded.docdate,
        binaryUrl: uploaded.binaryUrl,
        hash: expectedHash,
        verified: true,
        verificationMethod: uploaded.verificationMethod,
      },
    })
  } catch (error) {
    const status = Number(error?.status) || 500
    const scopeHint = status === 401 || status === 403
      ? ` OpenEMR rejected an authorization check. Confirm the grant includes ${REQUIRED_STANDARD_SCOPES.join(', ')} and user/DocumentReference.rs.`
      : ''
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: `${error instanceof Error ? error.message : 'OpenEMR clinical brief upload failed.'}${scopeHint}`,
      code: status === 401 || status === 403 ? 'OPENEMR_DOCUMENT_SCOPE_REQUIRED' : 'OPENEMR_DOCUMENT_UPLOAD_NOT_VERIFIED',
    })
  }
}
