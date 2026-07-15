import { createHash } from 'node:crypto'

const DEFAULT_SITE = 'default'
const DEFAULT_DOCUMENT_PATH = '/Medical_Record'
const REQUIRED_STANDARD_SCOPES = ['api:oemr', 'user/patient.crus', 'user/document.crs']

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function canonicalDocumentPath(value) {
  const raw = String(value || DEFAULT_DOCUMENT_PATH).trim() || DEFAULT_DOCUMENT_PATH
  const parts = raw
    .split('/')
    .filter(Boolean)
    .map((part) => part.trim().replace(/\s+/g, '_'))
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
  const medications = (packet.medications || [])
    .map((item) => `- ${safeText(item.name, 200)}: ${[item.strength, item.directions]
      .filter(Boolean)
      .map((part) => safeText(part, 300))
      .join(' · ')} [${safeText(item.status, 60)}]`)
    .join('\n') || '- None listed'

  const labs = (packet.labs || [])
    .map((item) => `- ${safeText(item.eventDate, 40)} · ${safeText(item.test, 200)}: ${[
      item.value,
      item.unit,
      item.abnormalFlag,
    ].filter(Boolean).map((part) => safeText(part, 200)).join(' · ')}`)
    .join('\n') || '- None listed'

  const priorities = (packet.priorities || [])
    .map((item, index) => `${index + 1}. ${safeText(item, 1000)}`)
    .join('\n') || '1. No priorities entered'

  const issues = (packet.reconciliation || [])
    .map((item) => `- ${safeText(item.title, 300)}: ${item.status === 'resolved'
      ? safeText(item.resolution || 'Resolved', 1000)
      : safeText(item.detail, 1000)}`)
    .join('\n') || '- No reconciliation issues'

  const tasks = (packet.openTasks || [])
    .map((item) => `- ${safeText(item.title, 300)}: ${safeText(item.detail, 1000)}`)
    .join('\n') || '- No open tasks'

  const sources = (packet.sources || [])
    .map((item, index) => `${index + 1}. ${safeText(item.title, 300)} · ${safeText(item.subtitle, 300)}\n   ${safeText(item.excerpt, 2000)}`)
    .join('\n') || 'No sources included'

  return `VITAL PASSPORT PATIENT-CONTROLLED PRE-VISIT INTAKE

Patient: ${safeText(packet.patient?.name, 300)}
DOB: ${safeText(packet.patient?.dob, 40)}
Prepared: ${safeText(packet.preparedAt, 80)}
Visit: ${safeText(packet.visit?.label, 300)}

REASON FOR VISIT
${safeText(packet.visit?.reason, 3000)}

PATIENT PRIORITIES
${priorities}

CONDITIONS
${(packet.patient?.conditions || []).map((item) => safeText(item, 300)).join(', ') || 'None listed'}

ALLERGIES
${(packet.patient?.allergies || []).map((item) => safeText(item, 300)).join(', ') || 'None listed'}

MEDICATIONS
${medications}

RECONCILIATION
${issues}

RELEVANT LABS
${labs}

OPEN NEXT ACTIONS
${tasks}

SOURCE INDEX
${sources}

${safeText(packet.disclaimer, 3000)}`
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

function hasResponseErrors(value) {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0)
}

function extractError(body, fallback) {
  const validation = body?.validationErrors
  const internal = body?.internalErrors

  if (Array.isArray(validation) && validation.length) {
    return validation.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
  }
  if (validation && typeof validation === 'object' && Object.keys(validation).length) {
    return JSON.stringify(validation)
  }
  if (Array.isArray(internal) && internal.length) {
    return internal.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
  }
  if (internal && typeof internal === 'object' && Object.keys(internal).length) {
    return JSON.stringify(internal)
  }

  return body?.issue?.[0]?.diagnostics
    || body?.error_description
    || body?.error
    || body?.message
    || body?.text
    || fallback
}

async function fetchOpenEmr(url, options = {}) {
  const response = await fetch(url, { redirect: 'error', ...options })
  const text = await response.text()
  let body = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { text }
  }

  if (!response.ok) {
    const error = new Error(extractError(body, `OpenEMR returned ${response.status}.`))
    error.status = response.status
    error.body = body
    throw error
  }

  return { response, body }
}

function authHeaders(accessToken, accept = 'application/json') {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('OpenEMR authorization is required.')
  }
  return { Authorization: `Bearer ${accessToken}`, Accept: accept }
}

async function resolveNumericPid(config, accessToken, patientUuid) {
  const url = `${config.apiBase}/patient/${encodeURIComponent(patientUuid)}`
  const { body } = await fetchOpenEmr(url, { headers: authHeaders(accessToken) })
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data
  const pid = data?.pid

  if (!pid) {
    throw new Error('OpenEMR returned the patient chart but did not include its internal numeric patient ID.')
  }

  return String(pid)
}

function candidatePaths(primary) {
  return [...new Set([
    canonicalDocumentPath(primary),
    '/Medical_Record',
    '/Lab_Report',
  ])]
}

function standardDocumentRows(body) {
  if (Array.isArray(body?.data)) return body.data
  if (Array.isArray(body)) return body
  return []
}

function contentHash(content) {
  return createHash('sha3-512').update(content, 'utf8').digest('hex')
}

function documentListUrl(config, pid, path) {
  const query = new URLSearchParams({ path })
  return `${config.apiBase}/patient/${encodeURIComponent(pid)}/document?${query.toString()}`
}

async function listDocumentsAtPath(config, accessToken, pid, path) {
  const { body } = await fetchOpenEmr(documentListUrl(config, pid, path), {
    headers: authHeaders(accessToken),
  })

  if (body === false || body?.data === false) {
    const error = new Error(`OpenEMR does not have the document category ${displayDocumentPath(path)}.`)
    error.code = 'OPENEMR_DOCUMENT_CATEGORY_NOT_FOUND'
    throw error
  }

  if (hasResponseErrors(body?.validationErrors) || hasResponseErrors(body?.internalErrors)) {
    throw new Error(extractError(body, `OpenEMR could not list documents in ${displayDocumentPath(path)}.`))
  }

  return standardDocumentRows(body)
}

async function verifyUploadedDocument(config, accessToken, pid, path, filename, expectedHash) {
  let lastRows = []

  for (const delayMs of [0, 250, 750, 1500, 2500]) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    lastRows = await listDocumentsAtPath(config, accessToken, pid, path)

    const match = lastRows.find((item) => {
      const rowName = String(item?.filename || item?.name || '')
      const rowHash = String(item?.hash || '').toLowerCase()
      return rowName === filename || (expectedHash && rowHash === expectedHash)
    })

    if (match) {
      return {
        id: String(match.id || match.document_id || match.uuid || ''),
        filename: String(match.filename || match.name || filename),
        mimetype: String(match.mimetype || 'text/plain'),
        docdate: String(match.docdate || match.date || ''),
        hash: String(match.hash || expectedHash || ''),
        verificationMethod: 'OpenEMR native document list',
      }
    }
  }

  const names = lastRows
    .map((item) => String(item?.filename || item?.name || ''))
    .filter(Boolean)
    .slice(0, 8)

  throw new Error(
    `OpenEMR accepted the upload to ${displayDocumentPath(path)}, but the exact file did not appear in that category afterward. Visible titles: ${names.length ? names.join(', ') : 'none'}.`,
  )
}

async function uploadPatientDocument(config, accessToken, pid, filename, content) {
  const expectedHash = contentHash(content)
  const attempts = []

  for (const path of candidatePaths(config.documentPath)) {
    try {
      // OpenEMR 8.1 can return success for an invalid one-level category and
      // create an uncategorized document. Prove the category exists first.
      await listDocumentsAtPath(config, accessToken, pid, path)
    } catch (error) {
      const status = Number(error?.status) || 0
      if (status === 401 || status === 403) throw error
      attempts.push(`${displayDocumentPath(path)} preflight: ${error instanceof Error ? error.message : 'unavailable'}`)
      continue
    }

    const form = new FormData()
    form.append('document', new Blob([content], { type: 'text/plain; charset=utf-8' }), filename)

    try {
      const { body } = await fetchOpenEmr(documentListUrl(config, pid, path), {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: form,
      })

      const failed = body === false
        || body?.data === false
        || hasResponseErrors(body?.internalErrors)
        || hasResponseErrors(body?.validationErrors)

      if (failed) {
        throw new Error(extractError(body, `OpenEMR declined the document category ${displayDocumentPath(path)}.`))
      }
    } catch (error) {
      const status = Number(error?.status) || 0
      if (status === 401 || status === 403) throw error
      attempts.push(`${displayDocumentPath(path)} upload: ${error instanceof Error ? error.message : 'failed'}`)
      continue
    }

    const verified = await verifyUploadedDocument(
      config,
      accessToken,
      pid,
      path,
      filename,
      expectedHash,
    )

    return {
      path,
      categories: [displayDocumentPath(path)],
      binaryUrl: '',
      ...verified,
    }
  }

  throw new Error(`OpenEMR could not find a valid writable document category. Tried ${attempts.join(' | ')}`)
}

function uniqueDocumentFilename(patientName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', 'Z')
  return `Vital-Passport-${slug(patientName)}-${timestamp}.txt`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const config = configuration()
  if (!config.baseUrl) {
    return sendJson(res, 503, {
      error: 'OpenEMR is not configured yet.',
      code: 'OPENEMR_NOT_CONFIGURED',
    })
  }

  try {
    const parsed = new URL(config.baseUrl)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new Error('OpenEMR must use HTTPS.')
    }

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
    const content = packetText(packet)
    const filename = uniqueDocumentFilename(packet.patient.name)
    const uploaded = await uploadPatientDocument(config, accessToken, pid, filename, content)

    const warnings = []
    if (scopeClaimMismatch) {
      warnings.push(`OpenEMR's token response did not list all expected Standard API scopes (${REQUIRED_STANDARD_SCOPES.join(', ')}), but the native upload and verification succeeded.`)
    }
    if (options.includeLabs && (packet.labs || []).length) {
      warnings.push(`${packet.labs.length} laboratory result${packet.labs.length === 1 ? '' : 's'} were included in the intake document because this OpenEMR capability statement does not advertise Observation creation.`)
    }
    if (options.includeConditions && (packet.patient.conditions || []).length) {
      warnings.push('Conditions remained in the reviewed intake document; no duplicate problem-list entries were created.')
    }
    if (options.includeAllergies && (packet.patient.allergies || []).length) {
      warnings.push('Allergy statements remained in the reviewed intake document; no duplicate allergy entries were created.')
    }
    if (options.includeProvenance) {
      warnings.push('Source provenance is embedded in the intake document and receipt; no separate FHIR Provenance resource was created for the native OpenEMR document upload.')
    }
    if ((packet.medications || []).some((item) => item.status !== 'confirmed')) {
      warnings.push('Medication discrepancies were included in the intake document only. No medication orders were created.')
    }

    return sendJson(res, 200, {
      status: 'success',
      importedAt: new Date().toISOString(),
      patientId,
      openEmr: {
        baseUrl: config.baseUrl,
        site: config.site,
        software: 'OpenEMR',
        version: '',
      },
      resources: [{
        resourceType: 'PatientDocument',
        id: uploaded.id,
        location: `${config.apiBase}/patient/${encodeURIComponent(pid)}/document/${encodeURIComponent(uploaded.id)}`,
        status: 'verified',
      }],
      failures: [],
      warnings,
      document: {
        filename: uploaded.filename,
        categoryPath: uploaded.path,
        categories: uploaded.categories,
        pid,
        mimetype: uploaded.mimetype,
        docdate: uploaded.docdate,
        binaryUrl: uploaded.binaryUrl,
        hash: uploaded.hash,
        verified: true,
        verificationMethod: uploaded.verificationMethod,
      },
    })
  } catch (error) {
    const status = Number(error?.status) || 500
    const scopeHint = status === 401 || status === 403
      ? ` OpenEMR rejected an authorization check. Confirm the grant includes ${REQUIRED_STANDARD_SCOPES.join(', ')}.`
      : ''

    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: `${error instanceof Error ? error.message : 'OpenEMR document upload failed.'}${scopeHint}`,
      code: status === 401 || status === 403
        ? 'OPENEMR_DOCUMENT_SCOPE_REQUIRED'
        : 'OPENEMR_DOCUMENT_UPLOAD_NOT_VERIFIED',
    })
  }
}
