const DEFAULT_SITE = 'default'
const REQUIRED_STANDARD_SCOPES = ['api:oemr', 'user/patient.crus', 'user/document.crs']

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function configuration() {
  const baseUrl = String(process.env.OPENEMR_BASE_URL || '').replace(/\/+$/, '')
  const site = String(process.env.OPENEMR_SITE || DEFAULT_SITE).trim() || DEFAULT_SITE
  const documentPath = String(process.env.OPENEMR_DOCUMENT_PATH || '/Patient Documents').trim() || '/Patient Documents'
  return {
    baseUrl,
    site,
    documentPath: documentPath.startsWith('/') ? documentPath : `/${documentPath}`,
    apiBase: baseUrl ? `${baseUrl}/apis/${encodeURIComponent(site)}/api` : '',
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

function safeText(value, max = 5000) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max)
}

function slug(value) {
  return safeText(value, 100)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'patient'
}

function packetText(packet) {
  const medications = (packet.medications || []).map((item) => `- ${safeText(item.name, 200)}: ${[item.strength, item.directions].filter(Boolean).map((part) => safeText(part, 300)).join(' · ')} [${safeText(item.status, 60)}]`).join('\n') || '- None listed'
  const labs = (packet.labs || []).map((item) => `- ${safeText(item.eventDate, 40)} · ${safeText(item.test, 200)}: ${[item.value, item.unit, item.abnormalFlag].filter(Boolean).map((part) => safeText(part, 200)).join(' · ')}`).join('\n') || '- None listed'
  const priorities = (packet.priorities || []).map((item, index) => `${index + 1}. ${safeText(item, 1000)}`).join('\n') || '1. No priorities entered'
  const issues = (packet.reconciliation || []).map((item) => `- ${safeText(item.title, 300)}: ${item.status === 'resolved' ? safeText(item.resolution || 'Resolved', 1000) : safeText(item.detail, 1000)}`).join('\n') || '- No reconciliation issues'
  const tasks = (packet.openTasks || []).map((item) => `- ${safeText(item.title, 300)}: ${safeText(item.detail, 1000)}`).join('\n') || '- No open tasks'
  const sources = (packet.sources || []).map((item, index) => `${index + 1}. ${safeText(item.title, 300)} · ${safeText(item.subtitle, 300)}\n   ${safeText(item.excerpt, 2000)}`).join('\n') || 'No sources included'

  return `VITAL PASSPORT PATIENT-CONTROLLED PRE-VISIT INTAKE\n\nPatient: ${safeText(packet.patient?.name, 300)}\nDOB: ${safeText(packet.patient?.dob, 40)}\nPrepared: ${safeText(packet.preparedAt, 80)}\nVisit: ${safeText(packet.visit?.label, 300)}\n\nREASON FOR VISIT\n${safeText(packet.visit?.reason, 3000)}\n\nPATIENT PRIORITIES\n${priorities}\n\nCONDITIONS\n${(packet.patient?.conditions || []).map((item) => safeText(item, 300)).join(', ') || 'None listed'}\n\nALLERGIES\n${(packet.patient?.allergies || []).map((item) => safeText(item, 300)).join(', ') || 'None listed'}\n\nMEDICATIONS\n${medications}\n\nRECONCILIATION\n${issues}\n\nRELEVANT LABS\n${labs}\n\nOPEN NEXT ACTIONS\n${tasks}\n\nSOURCE INDEX\n${sources}\n\n${safeText(packet.disclaimer, 3000)}`
}

function tokenScopes(value) {
  return new Set(
    String(value || '')
      .split(/[\s,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  )
}

function hasDocumentScope(scopes) {
  if (!scopes.size) return true
  const hasApi = scopes.has('api:oemr')
  const hasPatient = scopes.has('user/patient.crus') || scopes.has('user/patient.rs') || scopes.has('user/patient.r')
  const hasDocument = scopes.has('user/document.crs') || scopes.has('user/document.c') || scopes.has('user/document.cruds')
  return hasApi && hasPatient && hasDocument
}

function extractError(body, fallback) {
  const validation = body?.validationErrors
  const internal = body?.internalErrors
  if (Array.isArray(validation) && validation.length) return validation.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
  if (validation && typeof validation === 'object' && Object.keys(validation).length) return JSON.stringify(validation)
  if (Array.isArray(internal) && internal.length) return internal.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
  if (internal && typeof internal === 'object' && Object.keys(internal).length) return JSON.stringify(internal)
  return body?.error_description || body?.error || body?.message || body?.text || fallback
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
  const url = `${config.apiBase}/patient/${encodeURIComponent(patientUuid)}`
  const { body } = await fetchOpenEmr(url, { headers: authHeaders(accessToken) })
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data
  const pid = data?.pid || data?.id
  if (!pid) throw new Error('OpenEMR returned the patient chart but did not include its internal patient ID.')
  return String(pid)
}

function candidatePaths(primary) {
  return [...new Set([
    primary,
    '/Patient Documents',
    '/Medical Record',
    '/Documents',
  ].filter(Boolean))]
}

async function uploadPatientDocument(config, accessToken, pid, filename, content) {
  const attempts = []
  for (const path of candidatePaths(config.documentPath)) {
    const query = new URLSearchParams({ path })
    const form = new FormData()
    form.append('document', new Blob([content], { type: 'text/plain; charset=utf-8' }), filename)
    try {
      const { body } = await fetchOpenEmr(`${config.apiBase}/patient/${encodeURIComponent(pid)}/document?${query.toString()}`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: form,
      })
      const failed = body?.data === false || (Array.isArray(body?.internalErrors) && body.internalErrors.length) || (Array.isArray(body?.validationErrors) && body.validationErrors.length)
      if (failed) throw new Error(extractError(body, `OpenEMR declined the document path ${path}.`))
      const returned = Array.isArray(body?.data) ? body.data[0] : body?.data
      return {
        path,
        id: String(returned?.id || returned?.document_id || returned?.uuid || filename),
        body,
      }
    } catch (error) {
      const status = Number(error?.status) || 0
      if (status === 401 || status === 403) throw error
      attempts.push(`${path}: ${error instanceof Error ? error.message : 'upload failed'}`)
    }
  }
  throw new Error(`OpenEMR could not store the intake in a document category. Tried ${attempts.join(' | ')}`)
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

    // OpenEMR may omit scopes or serialize them in a non-standard format in the token response.
    // Do not reject a valid token based only on that advisory claim. The native API remains the
    // authorization authority and will return 401/403 if the actual grant is insufficient.
    const pid = await resolveNumericPid(config, accessToken, patientId)
    const content = packetText(packet)
    const date = new Date().toISOString().slice(0, 10)
    const filename = `Vital-Passport-${slug(packet.patient.name)}-${date}.txt`
    const uploaded = await uploadPatientDocument(config, accessToken, pid, filename, content)

    const warnings = []
    if (scopeClaimMismatch) warnings.push(`OpenEMR's token response did not list all expected Standard API scopes (${REQUIRED_STANDARD_SCOPES.join(', ')}), but the native patient-document API authorized the upload.`)
    if (options.includeLabs && (packet.labs || []).length) warnings.push(`${packet.labs.length} laboratory result${packet.labs.length === 1 ? '' : 's'} were included in the intake document because this OpenEMR capability statement does not advertise Observation creation.`)
    if (options.includeConditions && (packet.patient.conditions || []).length) warnings.push('Conditions remained in the reviewed intake document; no duplicate problem-list entries were created.')
    if (options.includeAllergies && (packet.patient.allergies || []).length) warnings.push('Allergy statements remained in the reviewed intake document; no duplicate allergy entries were created.')
    if (options.includeProvenance) warnings.push('Source provenance is embedded in the intake document and receipt; no separate FHIR Provenance resource was created for the native OpenEMR document upload.')
    if ((packet.medications || []).some((item) => item.status !== 'confirmed')) warnings.push('Medication discrepancies were included in the intake document only. No medication orders were created.')

    return sendJson(res, 200, {
      status: 'success',
      importedAt: new Date().toISOString(),
      patientId,
      openEmr: { baseUrl: config.baseUrl, site: config.site, software: 'OpenEMR', version: '' },
      resources: [{
        resourceType: 'PatientDocument',
        id: uploaded.id,
        location: `${config.apiBase}/patient/${encodeURIComponent(pid)}/document`,
        status: 'created',
      }],
      failures: [],
      warnings,
      document: { filename, categoryPath: uploaded.path, pid },
    })
  } catch (error) {
    const status = Number(error?.status) || 500
    const scopeHint = status === 401 || status === 403
      ? ' OpenEMR rejected the native API request. Confirm the client grant includes api:oemr, user/patient.crus, and user/document.crs.'
      : ''
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: `${error instanceof Error ? error.message : 'OpenEMR document upload failed.'}${scopeHint}`,
      code: status === 401 || status === 403 ? 'OPENEMR_DOCUMENT_SCOPE_REQUIRED' : 'OPENEMR_DOCUMENT_UPLOAD_FAILED',
    })
  }
}
