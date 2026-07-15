import type { SharedBriefPacket } from '../types'

export interface OpenEmrConfig {
  configured: boolean
  site: string
  clientId: string
  redirectUri: string
  scopes: string
  fhirBase: string
  displayBaseUrl: string
}

export interface OpenEmrDiscovery {
  software: string
  version: string
  fhirVersion: string
  implementationUrl: string
  interactions: Record<string, string[]>
  authorizationEndpoint: string
  tokenEndpoint: string
  scopesSupported: string[]
  capabilities: string[]
}

export interface OpenEmrPatient {
  id: string
  name: string
  birthDate: string
  gender: string
  identifier: string
  email: string
  phone: string
}

export interface OpenEmrImportOptions {
  includeLabs: boolean
  includeConditions: boolean
  includeAllergies: boolean
  includeProvenance: boolean
}

export interface OpenEmrImportReceipt {
  status: 'success' | 'partial' | 'failed'
  importedAt: string
  patientId: string
  openEmr: { baseUrl: string; site: string; software: string; version: string }
  resources: Array<{ resourceType: string; id: string; location: string; status: string }>
  failures: Array<{ resourceType: string; error: string }>
  warnings: string[]
}

const TOKEN_KEY = 'vital-openemr-token'
const PKCE_KEY = 'vital-openemr-pkce'
const RECEIPT_KEY = 'vital-openemr-receipt'
const HANDOFF_SCOPES = [
  'openid',
  'offline_access',
  'api:fhir',
  'user/Patient.rs',
  'api:oemr',
  'user/patient.crus',
  'user/document.crs',
]

async function api<T>(op: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/openemr?op=${encodeURIComponent(op)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `OpenEMR request failed (${response.status}).`)
  return payload as T
}

async function confidentialTokenApi<T>(body: unknown): Promise<T> {
  const response = await fetch('/api/openemr-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `OpenEMR token exchange failed (${response.status}).`)
  return payload as T
}

async function patientSearchApi<T>(body: unknown): Promise<T> {
  const response = await fetch('/api/openemr-patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `OpenEMR patient search failed (${response.status}).`)
  return payload as T
}

async function documentImportApi<T>(body: unknown): Promise<T> {
  const response = await fetch('/api/openemr-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `OpenEMR document upload failed (${response.status}).`)
  return payload as T
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomUrlSafe(length = 48) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)))
}

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export async function getOpenEmrConfig() {
  const config = await api<OpenEmrConfig>('config')
  return { ...config, scopes: HANDOFF_SCOPES.join(' ') }
}

export function discoverOpenEmr() {
  return api<OpenEmrDiscovery>('discover', {})
}

export async function beginOpenEmrAuthorization(config: OpenEmrConfig, discovery: OpenEmrDiscovery) {
  const state = randomUrlSafe(24)
  const codeVerifier = randomUrlSafe(64)
  const codeChallenge = await challengeFor(codeVerifier)
  window.sessionStorage.setItem(PKCE_KEY, JSON.stringify({ state, codeVerifier, createdAt: Date.now() }))
  const url = new URL(discovery.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', config.scopes)
  url.searchParams.set('state', state)
  url.searchParams.set('aud', config.fhirBase)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  window.location.assign(url.toString())
}

export async function completeOpenEmrAuthorization(code: string, state: string) {
  const stored = window.sessionStorage.getItem(PKCE_KEY)
  if (!stored) throw new Error('The OpenEMR connection session expired. Start the connection again.')
  const parsed = JSON.parse(stored) as { state: string; codeVerifier: string; createdAt: number }
  if (parsed.state !== state) throw new Error('OpenEMR returned an invalid authorization state.')
  if (Date.now() - parsed.createdAt > 10 * 60 * 1000) throw new Error('The OpenEMR authorization attempt expired.')
  const token = await confidentialTokenApi<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>({ code, codeVerifier: parsed.codeVerifier })
  const storedToken = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || '',
    scope: token.scope || '',
    expiresAt: Date.now() + (Number(token.expires_in || 3600) * 1000),
  }
  window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify(storedToken))
  window.sessionStorage.removeItem(PKCE_KEY)
  return storedToken
}

export function readOpenEmrToken() {
  const stored = window.sessionStorage.getItem(TOKEN_KEY)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as { accessToken: string; expiresAt: number; scope: string }
    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
    return parsed
  } catch {
    window.sessionStorage.removeItem(TOKEN_KEY)
    return null
  }
}

export function disconnectOpenEmr() {
  window.sessionStorage.removeItem(TOKEN_KEY)
}

export async function searchOpenEmrPatients(query: { name?: string; birthDate?: string; identifier?: string }) {
  const token = readOpenEmrToken()
  if (!token) throw new Error('Connect OpenEMR before searching patients.')
  const result = await patientSearchApi<{ patients: OpenEmrPatient[]; matchQuality: 'unique' | 'review' | 'none' }>({ accessToken: token.accessToken, query })
  return result.patients
}

export async function importOpenEmrPacket(patientId: string, packet: SharedBriefPacket, options: OpenEmrImportOptions) {
  const token = readOpenEmrToken()
  if (!token) throw new Error('Connect OpenEMR before importing.')
  const receipt = await documentImportApi<OpenEmrImportReceipt>({
    accessToken: token.accessToken,
    grantedScope: token.scope,
    patientId,
    packet,
    options,
  })
  window.localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt))
  return receipt
}

export function readLastOpenEmrReceipt() {
  try {
    const stored = window.localStorage.getItem(RECEIPT_KEY)
    return stored ? JSON.parse(stored) as OpenEmrImportReceipt : null
  } catch {
    return null
  }
}

export const demoOpenEmrDiscovery: OpenEmrDiscovery = {
  software: 'OpenEMR',
  version: '7.x demo',
  fhirVersion: '4.0.1',
  implementationUrl: 'Synthetic local adapter',
  interactions: {
    Patient: ['read', 'search-type'],
    DocumentReference: ['create', 'read', 'search-type'],
    Observation: ['create', 'read', 'search-type'],
    Condition: ['create', 'read', 'search-type'],
    AllergyIntolerance: ['create', 'read', 'search-type'],
    Provenance: ['create', 'read', 'search-type'],
  },
  authorizationEndpoint: '',
  tokenEndpoint: '',
  scopesSupported: [],
  capabilities: ['launch-standalone', 'client-public', 'permission-user'],
}

export const demoOpenEmrPatients: OpenEmrPatient[] = [
  { id: 'demo-patient-1042', name: 'Maria Santos', birthDate: '1964-05-12', gender: 'female', identifier: 'MRN-1042', email: 'maria@example.test', phone: '(415) 555-0142' },
  { id: 'demo-patient-2118', name: 'Marina Santos', birthDate: '1966-02-03', gender: 'female', identifier: 'MRN-2118', email: '', phone: '(415) 555-0188' },
]

export function createDemoOpenEmrReceipt(patientId: string, packet: SharedBriefPacket, options: OpenEmrImportOptions): OpenEmrImportReceipt {
  const resources = [
    { resourceType: 'PatientDocument', id: 'doc-demo-001', location: `PatientDocument/doc-demo-001`, status: 'created' },
    ...(options.includeLabs ? packet.labs.map((_, index) => ({ resourceType: 'Observation', id: `obs-demo-${index + 1}`, location: `Observation/obs-demo-${index + 1}`, status: 'created' })) : []),
    ...(options.includeConditions ? packet.patient.conditions.map((_, index) => ({ resourceType: 'Condition', id: `condition-demo-${index + 1}`, location: `Condition/condition-demo-${index + 1}`, status: 'created' })) : []),
    ...(options.includeProvenance ? [{ resourceType: 'Provenance', id: 'provenance-demo-001', location: 'Provenance/provenance-demo-001', status: 'created' }] : []),
  ]
  const receipt: OpenEmrImportReceipt = {
    status: 'success',
    importedAt: new Date().toISOString(),
    patientId,
    openEmr: { baseUrl: 'Synthetic OpenEMR adapter', site: 'default', software: 'OpenEMR', version: '7.x demo' },
    resources,
    failures: [],
    warnings: [
      'Synthetic demonstration only. No external OpenEMR chart was changed.',
      'Patient-reported medications were placed in the intake document; no medication orders were created.',
      ...(options.includeAllergies && packet.patient.allergies.some((item) => /no known|nkda/i.test(item)) ? ['No-known-allergy text was not converted into an AllergyIntolerance resource.'] : []),
    ],
  }
  window.localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt))
  return receipt
}
