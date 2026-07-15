const DEFAULT_SITE = 'default'

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
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

function configuration() {
  const baseUrl = String(process.env.OPENEMR_BASE_URL || '').replace(/\/+$/, '')
  const site = String(process.env.OPENEMR_SITE || DEFAULT_SITE).trim() || DEFAULT_SITE
  return {
    baseUrl,
    site,
    fhirBase: baseUrl ? `${baseUrl}/apis/${encodeURIComponent(site)}/fhir` : '',
  }
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function formatPatient(resource) {
  const name = resource?.name?.find((item) => item.use === 'official') || resource?.name?.[0] || {}
  const given = Array.isArray(name.given) ? name.given.filter(Boolean) : []
  const family = String(name.family || '')
  const fullName = String(name.text || [...given, family].filter(Boolean).join(' ') || 'Unnamed patient')
  const identifier = resource?.identifier?.find((item) => item.value)?.value || ''
  const email = resource?.telecom?.find((item) => item.system === 'email')?.value || ''
  const phone = resource?.telecom?.find((item) => item.system === 'phone')?.value || ''
  return {
    id: resource.id,
    name: fullName,
    given,
    family,
    birthDate: resource.birthDate || '',
    gender: resource.gender || '',
    identifier,
    email,
    phone,
  }
}

function scorePatient(patient, query) {
  const requestedName = normalize(query.name)
  const requestedParts = requestedName.split(' ').filter(Boolean)
  const requestedGiven = requestedParts[0] || ''
  const requestedFamily = requestedParts.at(-1) || ''
  const patientName = normalize(patient.name)
  const patientGiven = normalize(patient.given.join(' '))
  const patientFamily = normalize(patient.family)

  if (query.birthDate && patient.birthDate !== query.birthDate) return -1
  if (requestedName) {
    const hasOverlap = requestedParts.some((part) => patientName.split(' ').includes(part))
    if (!hasOverlap) return -1
  }

  let score = 0
  if (query.birthDate && patient.birthDate === query.birthDate) score += 100
  if (requestedName && patientName === requestedName) score += 80
  if (requestedParts.length && requestedParts.every((part) => patientName.split(' ').includes(part))) score += 45
  if (requestedFamily && patientFamily === requestedFamily) score += 30
  if (requestedGiven && patientGiven.split(' ').includes(requestedGiven)) score += 25
  return score
}

async function fetchBundle(url, accessToken) {
  const response = await fetch(url, {
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { text } }
  if (!response.ok) {
    const detail = body?.issue?.[0]?.diagnostics || body?.error_description || body?.error || body?.text || `OpenEMR returned ${response.status}.`
    const error = new Error(String(detail))
    error.status = response.status
    throw error
  }
  return body
}

function buildSearches(query) {
  const name = String(query.name || '').trim().slice(0, 120)
  const birthDate = String(query.birthDate || '').trim().slice(0, 10)
  const identifier = String(query.identifier || '').trim().slice(0, 120)
  const parts = name.split(/\s+/).filter(Boolean)
  const given = parts[0] || ''
  const family = parts.length > 1 ? parts.at(-1) : ''
  const searches = []

  const add = (label, values) => {
    const params = new URLSearchParams({ _count: '20', ...values })
    const value = params.toString()
    if (!searches.some((item) => item.query === value)) searches.push({ label, query: value })
  }

  if (identifier) add('identifier', { identifier })
  if (given && family && birthDate) add('given-family-birthdate', { given, family, birthdate: birthDate })
  if (family && birthDate) add('family-birthdate', { family, birthdate: birthDate })
  if (given && birthDate) add('given-birthdate', { given, birthdate: birthDate })
  if (name && birthDate) add('name-birthdate', { name, birthdate: birthDate })
  if (birthDate) add('birthdate', { birthdate: birthDate })
  if (given && family) add('given-family', { given, family })
  if (name) add('name', { name })

  return searches.slice(0, 8)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

  const config = configuration()
  if (!config.baseUrl) return json(res, 503, { error: 'OpenEMR is not configured yet.', code: 'OPENEMR_NOT_CONFIGURED' })
  try {
    const parsed = new URL(config.baseUrl)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('OpenEMR must use HTTPS.')
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'OpenEMR base URL is invalid.' })
  }

  try {
    const body = await readBody(req)
    const accessToken = String(body.accessToken || '')
    if (!accessToken) return json(res, 401, { error: 'OpenEMR authorization is required.', code: 'OPENEMR_AUTH_REQUIRED' })

    const query = {
      name: String(body.query?.name || '').trim(),
      birthDate: String(body.query?.birthDate || '').trim(),
      identifier: String(body.query?.identifier || '').trim(),
    }
    if (!query.name && !query.birthDate && !query.identifier) {
      return json(res, 400, { error: 'Enter a patient name, date of birth, or identifier.' })
    }

    const unique = new Map()
    const attempts = []
    for (const search of buildSearches(query)) {
      const bundle = await fetchBundle(`${config.fhirBase}/Patient?${search.query}`, accessToken)
      const count = Array.isArray(bundle?.entry) ? bundle.entry.length : 0
      attempts.push({ strategy: search.label, count })
      for (const entry of bundle?.entry || []) {
        const patient = formatPatient(entry.resource)
        if (patient.id) unique.set(patient.id, patient)
      }
      if (unique.size >= 20) break
    }

    const patients = [...unique.values()]
      .map((patient) => ({ patient, score: scorePatient(patient, query) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.patient.name.localeCompare(b.patient.name))
      .slice(0, 10)
      .map(({ patient }) => {
        const { given, family, ...publicPatient } = patient
        return publicPatient
      })

    return json(res, 200, {
      patients,
      matchQuality: patients.length === 1 ? 'unique' : patients.length > 1 ? 'review' : 'none',
      attempts,
    })
  } catch (error) {
    const status = Number(error?.status) || 500
    return json(res, status >= 400 && status < 600 ? status : 500, {
      error: error instanceof Error ? error.message : 'OpenEMR patient search failed.',
      code: status === 401 ? 'OPENEMR_AUTH_REQUIRED' : 'OPENEMR_PATIENT_SEARCH_FAILED',
    })
  }
}
