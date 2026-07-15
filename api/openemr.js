const DEFAULT_SITE = 'default'
const DEFAULT_SCOPES = [
  'openid',
  'offline_access',
  'api:fhir',
  'user/Patient.rs',
  'user/DocumentReference.crs',
  'user/Observation.crs',
  'user/Condition.crs',
  'user/AllergyIntolerance.crs',
  'user/Provenance.crs',
].join(' ')

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function configuration() {
  const baseUrl = String(process.env.OPENEMR_BASE_URL || '').replace(/\/+$/, '')
  const site = String(process.env.OPENEMR_SITE || DEFAULT_SITE).trim() || DEFAULT_SITE
  const clientId = String(process.env.OPENEMR_CLIENT_ID || '').trim()
  const redirectUri = String(process.env.OPENEMR_REDIRECT_URI || 'https://vitalpassport.com/openemr/callback').trim()
  const scopes = String(process.env.OPENEMR_SCOPES || DEFAULT_SCOPES).trim()
  const configured = Boolean(baseUrl && clientId && redirectUri)
  return {
    configured,
    baseUrl,
    site,
    clientId,
    redirectUri,
    scopes,
    fhirBase: baseUrl ? `${baseUrl}/apis/${encodeURIComponent(site)}/fhir` : '',
    oauthBase: baseUrl ? `${baseUrl}/oauth2/${encodeURIComponent(site)}` : '',
  }
}

function requireConfiguration(res) {
  const config = configuration()
  if (!config.configured) {
    json(res, 503, {
      error: 'OpenEMR is not configured yet.',
      code: 'OPENEMR_NOT_CONFIGURED',
      required: ['OPENEMR_BASE_URL', 'OPENEMR_CLIENT_ID', 'OPENEMR_REDIRECT_URI'],
    })
    return null
  }
  try {
    const parsed = new URL(config.baseUrl)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('OpenEMR must use HTTPS.')
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : 'OpenEMR base URL is invalid.' })
    return null
  }
  return config
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { redirect: 'error', ...options })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { text } }
  if (!response.ok) {
    const detail = body?.issue?.[0]?.diagnostics || body?.error_description || body?.error || body?.text || `OpenEMR returned ${response.status}.`
    const error = new Error(String(detail))
    error.status = response.status
    error.body = body
    throw error
  }
  return { body, response }
}

function capabilitySummary(capability) {
  const resources = capability?.rest?.flatMap((rest) => rest.resource || []) || []
  const interactions = {}
  resources.forEach((resource) => {
    interactions[resource.type] = (resource.interaction || []).map((item) => item.code)
  })
  return {
    software: capability?.software?.name || 'OpenEMR',
    version: capability?.software?.version || '',
    fhirVersion: capability?.fhirVersion || '4.0.1',
    implementationUrl: capability?.implementation?.url || '',
    interactions,
  }
}

async function discover(config) {
  const [capabilityResult, smartResult] = await Promise.all([
    fetchJson(`${config.fhirBase}/metadata`, { headers: { Accept: 'application/fhir+json' } }),
    fetchJson(`${config.fhirBase}/.well-known/smart-configuration`, { headers: { Accept: 'application/json' } }),
  ])
  return {
    ...capabilitySummary(capabilityResult.body),
    authorizationEndpoint: smartResult.body?.authorization_endpoint || `${config.oauthBase}/authorize`,
    tokenEndpoint: smartResult.body?.token_endpoint || `${config.oauthBase}/token`,
    scopesSupported: smartResult.body?.scopes_supported || [],
    capabilities: smartResult.body?.capabilities || [],
  }
}

function bearerHeaders(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') throw new Error('OpenEMR authorization is required.')
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/fhir+json',
    'Content-Type': 'application/fhir+json',
  }
}

function formatPatient(resource) {
  const name = resource?.name?.[0]
  const fullName = name?.text || [...(name?.given || []), name?.family].filter(Boolean).join(' ') || 'Unnamed patient'
  const identifier = resource?.identifier?.find((item) => item.value)?.value || ''
  const email = resource?.telecom?.find((item) => item.system === 'email')?.value || ''
  const phone = resource?.telecom?.find((item) => item.system === 'phone')?.value || ''
  return {
    id: resource.id,
    name: fullName,
    birthDate: resource.birthDate || '',
    gender: resource.gender || '',
    identifier,
    email,
    phone,
  }
}

async function searchPatients(config, accessToken, query) {
  const params = new URLSearchParams({ _count: '10' })
  if (query?.name) params.set('name', String(query.name).slice(0, 120))
  if (query?.birthDate) params.set('birthdate', String(query.birthDate).slice(0, 10))
  if (query?.identifier) params.set('identifier', String(query.identifier).slice(0, 120))
  const { body } = await fetchJson(`${config.fhirBase}/Patient?${params.toString()}`, { headers: bearerHeaders(accessToken) })
  return (body?.entry || []).map((entry) => formatPatient(entry.resource)).filter((patient) => patient.id)
}

function base64Utf8(value) {
  return Buffer.from(String(value), 'utf8').toString('base64')
}

function parseNumeric(value) {
  const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number.parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function clinicianPacketText(packet) {
  const medications = packet.medications.map((item) => `- ${item.name}: ${[item.strength, item.directions].filter(Boolean).join(' · ')} [${item.status}]`).join('\n') || '- None listed'
  const labs = packet.labs.map((item) => `- ${item.eventDate} · ${item.test}: ${[item.value, item.unit, item.abnormalFlag].filter(Boolean).join(' · ')}`).join('\n') || '- None listed'
  const priorities = packet.priorities.map((item, index) => `${index + 1}. ${item}`).join('\n') || '1. No priorities entered'
  const issues = packet.reconciliation.map((item) => `- ${item.title}: ${item.status === 'resolved' ? item.resolution || 'Resolved' : item.detail}`).join('\n') || '- No reconciliation issues'
  const tasks = packet.openTasks.map((item) => `- ${item.title}: ${item.detail}`).join('\n') || '- No open tasks'
  const sources = packet.sources.map((item, index) => `${index + 1}. ${item.title} · ${item.subtitle}\n   ${item.excerpt}`).join('\n') || 'No sources included'
  return `VITAL PASSPORT PATIENT-CONTROLLED PRE-VISIT INTAKE\n\nPatient: ${packet.patient.name}\nDOB: ${packet.patient.dob}\nPrepared: ${packet.preparedAt}\nVisit: ${packet.visit.label}\n\nREASON FOR VISIT\n${packet.visit.reason}\n\nPATIENT PRIORITIES\n${priorities}\n\nCONDITIONS\n${packet.patient.conditions.join(', ') || 'None listed'}\n\nALLERGIES\n${packet.patient.allergies.join(', ') || 'None listed'}\n\nMEDICATIONS\n${medications}\n\nRECONCILIATION\n${issues}\n\nRELEVANT LABS\n${labs}\n\nOPEN NEXT ACTIONS\n${tasks}\n\nSOURCE INDEX\n${sources}\n\n${packet.disclaimer}`
}

function canCreate(discovery, resourceType) {
  return Boolean(discovery?.interactions?.[resourceType]?.includes('create'))
}

async function createResource(config, accessToken, resource) {
  const resourceType = resource.resourceType
  const { body, response } = await fetchJson(`${config.fhirBase}/${resourceType}`, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    body: JSON.stringify(resource),
  })
  const location = response.headers.get('content-location') || response.headers.get('location') || ''
  const id = body?.id || location.split('/').filter(Boolean).pop() || ''
  return { resourceType, id, location, status: 'created' }
}

function observationResource(patientId, lab) {
  const numericValue = parseNumeric(lab.value)
  const value = numericValue === null
    ? { valueString: [lab.value, lab.unit].filter(Boolean).join(' ') }
    : { valueQuantity: { value: numericValue, unit: lab.unit || undefined } }
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
    code: { text: lab.test },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: lab.eventDate ? `${lab.eventDate}T12:00:00Z` : undefined,
    ...value,
    interpretation: lab.abnormalFlag ? [{ text: lab.abnormalFlag }] : undefined,
    note: [{ text: `Patient-provided through Vital Passport. Source: ${lab.sourceId}. Verify against the original report.` }],
  }
}

async function importPacket(config, accessToken, patientId, packet, options) {
  if (!patientId || !packet?.patient || !Array.isArray(packet?.sources)) throw new Error('Patient and packet are required.')
  const discovery = await discover(config)
  const resources = []
  const failures = []
  const warnings = []
  const targets = []

  async function attempt(resource) {
    const resourceType = resource.resourceType
    if (!canCreate(discovery, resourceType)) {
      warnings.push(`${resourceType} create is not advertised by this OpenEMR capability statement.`)
      return null
    }
    try {
      const result = await createResource(config, accessToken, resource)
      resources.push(result)
      if (result.id) targets.push({ reference: `${resourceType}/${result.id}` })
      return result
    } catch (error) {
      failures.push({ resourceType, error: error instanceof Error ? error.message : 'Import failed.' })
      return null
    }
  }

  await attempt({
    resourceType: 'DocumentReference',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }], text: 'Patient-provided pre-visit intake' },
    subject: { reference: `Patient/${patientId}` },
    date: new Date().toISOString(),
    author: [{ reference: `Patient/${patientId}`, display: packet.patient.name }],
    description: 'Vital Passport patient-controlled pre-visit intake and reconciliation packet',
    content: [{ attachment: { contentType: 'text/plain; charset=utf-8', title: `${packet.patient.name} Vital Passport intake`, data: base64Utf8(clinicianPacketText(packet)) } }],
    context: { period: { start: packet.preparedAt } },
  })

  if (options?.includeLabs) {
    for (const lab of packet.labs.slice(0, 30)) await attempt(observationResource(patientId, lab))
  }

  if (options?.includeConditions) {
    for (const condition of packet.patient.conditions.slice(0, 20)) {
      await attempt({
        resourceType: 'Condition',
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }] },
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
        code: { text: condition },
        subject: { reference: `Patient/${patientId}` },
        recordedDate: new Date().toISOString(),
        note: [{ text: 'Patient-controlled import from Vital Passport. Confirm before relying on this problem-list item.' }],
      })
    }
  }

  if (options?.includeAllergies) {
    for (const allergy of packet.patient.allergies.slice(0, 20)) {
      if (/no known|nkda/i.test(allergy)) {
        warnings.push('No-known-allergy text remained in the intake document and was not converted into an AllergyIntolerance resource.')
        continue
      }
      await attempt({
        resourceType: 'AllergyIntolerance',
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'unconfirmed' }] },
        criticality: 'unable-to-assess',
        code: { text: allergy },
        patient: { reference: `Patient/${patientId}` },
        recordedDate: new Date().toISOString(),
        note: [{ text: 'Patient-controlled import from Vital Passport. Verify against the clinical chart.' }],
      })
    }
  }

  if (options?.includeProvenance && targets.length && canCreate(discovery, 'Provenance')) {
    await attempt({
      resourceType: 'Provenance',
      target: targets,
      recorded: new Date().toISOString(),
      agent: [{ type: { text: 'Patient-controlled application' }, who: { reference: `Patient/${patientId}`, display: packet.patient.name }, onBehalfOf: { display: 'Vital Passport' } }],
      reason: [{ text: 'Patient-directed pre-visit clinical handoff.' }],
      policy: ['https://vitalpassport.com/policies/patient-controlled-export'],
    })
  }

  if (packet.medications.some((item) => item.status !== 'confirmed')) {
    warnings.push('Medication discrepancies were included in the intake document only. No medication orders were created.')
  }

  return {
    status: failures.length ? (resources.length ? 'partial' : 'failed') : 'success',
    importedAt: new Date().toISOString(),
    patientId,
    openEmr: { baseUrl: config.baseUrl, site: config.site, software: discovery.software, version: discovery.version },
    resources,
    failures,
    warnings,
  }
}

export default async function handler(req, res) {
  const op = String(req.query?.op || '')
  if (req.method === 'GET' && op === 'config') {
    const config = configuration()
    return json(res, 200, {
      configured: config.configured,
      site: config.site,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      fhirBase: config.fhirBase,
      displayBaseUrl: config.baseUrl,
    })
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
  const config = requireConfiguration(res)
  if (!config) return

  try {
    const body = await readBody(req)
    if (op === 'discover') return json(res, 200, await discover(config))

    if (op === 'token') {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        code: String(body.code || ''),
        code_verifier: String(body.codeVerifier || ''),
      })
      const { body: token } = await fetchJson(`${config.oauthBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params.toString(),
      })
      return json(res, 200, token)
    }

    if (op === 'patients') {
      return json(res, 200, { patients: await searchPatients(config, body.accessToken, body.query || {}) })
    }

    if (op === 'import') {
      return json(res, 200, await importPacket(config, body.accessToken, body.patientId, body.packet, body.options || {}))
    }

    return json(res, 404, { error: 'Unknown OpenEMR operation.' })
  } catch (error) {
    const status = Number(error?.status) || 500
    return json(res, status >= 400 && status < 600 ? status : 500, {
      error: error instanceof Error ? error.message : 'OpenEMR request failed.',
      code: status === 401 ? 'OPENEMR_AUTH_REQUIRED' : 'OPENEMR_REQUEST_FAILED',
    })
  }
}
