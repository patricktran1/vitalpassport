import type { PatientRecordSnapshot } from '../types'
import { blankPatientProfile, PATIENT_PROFILE_KEY } from './patientProfile'

export type WorkspaceMode = 'personal' | 'demo'

export const WORKSPACE_MODE_KEY = 'vital-workspace-mode-v1'
export const PERSONAL_SANDBOX_KEY = 'vital-personal-sandbox-from-demo-v1'
const WORKSPACE_SNAPSHOT_PREFIX = 'vital-workspace-state-v1:'
const CLOUD_LOADED_USER_KEY = 'vital-cloud-loaded-user'

export const workspaceLocalKeys = [
  'vital-patient-record-v1',
  PATIENT_PROFILE_KEY,
  'vital-copilot-memory-v1',
  'vital-check-ins-v1',
  'vital-check-in-responses-v2',
  'vital-check-in-responses-v1',
  'vital-check-in-mock-deliveries-v1',
  'vital-check-in-mock-contact-v1',
  'vital-health-signals-v1',
  'vital-apple-health-demo-v1',
] as const

export const workspaceSessionKeys = [
  'vital-answers',
  'vital-uploads',
  'vital-sources',
  'vital-timeline',
  'vital-clinical-medications',
  'vital-lab-results',
  'vital-reconciliation-issues',
  'vital-care-tasks',
  'vital-health-inbox-v1',
] as const

interface StoredWorkspaceState {
  local: Record<string, string>
  session: Record<string, string>
}

export function blankPatientRecord(): PatientRecordSnapshot {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    answers: { timing: '', positional: '', dose: '', priorities: '' },
    uploads: [],
    sources: [],
    timelineEvents: [],
    clinicalMedications: [],
    labResults: [],
    reconciliationIssues: [],
    careTasks: [],
  }
}

function captureKeys(storage: Storage, keys: readonly string[]) {
  return keys.reduce<Record<string, string>>((captured, key) => {
    const value = storage.getItem(key)
    if (value !== null) captured[key] = value
    return captured
  }, {})
}

function restoreKeys(storage: Storage, values: Record<string, string>, keys: readonly string[]) {
  keys.forEach((key) => {
    const value = values[key]
    if (typeof value === 'string') storage.setItem(key, value)
  })
}

function clearManagedState() {
  workspaceLocalKeys.forEach((key) => window.localStorage.removeItem(key))
  workspaceSessionKeys.forEach((key) => window.sessionStorage.removeItem(key))
  window.sessionStorage.removeItem(CLOUD_LOADED_USER_KEY)
}

function seedBlankPersonalState() {
  const record = blankPatientRecord()
  window.localStorage.setItem('vital-patient-record-v1', JSON.stringify(record))
  window.localStorage.setItem(PATIENT_PROFILE_KEY, JSON.stringify(blankPatientProfile))
  window.localStorage.setItem('vital-copilot-memory-v1', '[]')
  window.localStorage.setItem('vital-check-ins-v1', '[]')
  window.localStorage.setItem('vital-check-in-responses-v2', '[]')
  window.localStorage.setItem('vital-check-in-mock-deliveries-v1', '[]')
  window.localStorage.setItem('vital-check-in-mock-contact-v1', JSON.stringify({ email: '', phone: '' }))
  window.localStorage.setItem('vital-apple-health-demo-v1', JSON.stringify({ status: 'disconnected', permissions: [], days: [], syncHistory: [], lastSyncAt: null }))
  window.sessionStorage.setItem('vital-answers', JSON.stringify(record.answers))
  window.sessionStorage.setItem('vital-uploads', '[]')
  window.sessionStorage.setItem('vital-sources', '[]')
  window.sessionStorage.setItem('vital-timeline', '[]')
  window.sessionStorage.setItem('vital-clinical-medications', '[]')
  window.sessionStorage.setItem('vital-lab-results', '[]')
  window.sessionStorage.setItem('vital-reconciliation-issues', '[]')
  window.sessionStorage.setItem('vital-care-tasks', '[]')
  window.sessionStorage.setItem('vital-health-inbox-v1', '[]')
}

function snapshotKey(mode: WorkspaceMode) {
  return `${WORKSPACE_SNAPSHOT_PREFIX}${mode}`
}

export function readWorkspaceMode(): WorkspaceMode | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(WORKSPACE_MODE_KEY)
  return value === 'personal' || value === 'demo' ? value : null
}

export function isDemoWorkspace() {
  return readWorkspaceMode() === 'demo'
}

export function saveCurrentWorkspace(mode = readWorkspaceMode()) {
  if (!mode || typeof window === 'undefined') return
  const state: StoredWorkspaceState = {
    local: captureKeys(window.localStorage, workspaceLocalKeys),
    session: captureKeys(window.sessionStorage, workspaceSessionKeys),
  }
  window.localStorage.setItem(snapshotKey(mode), JSON.stringify(state))
}

function readSavedWorkspace(mode: WorkspaceMode): StoredWorkspaceState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(snapshotKey(mode)) || 'null') as StoredWorkspaceState | null
    if (!parsed || typeof parsed !== 'object' || !parsed.local || !parsed.session) return null
    return parsed
  } catch {
    return null
  }
}

export function activateWorkspace(mode: WorkspaceMode, options: { preserveCurrent?: boolean; copyCurrent?: boolean; cloudUserId?: string } = {}) {
  const current = readWorkspaceMode()
  if (options.preserveCurrent !== false && current) saveCurrentWorkspace(current)

  if (options.copyCurrent) {
    const copied: StoredWorkspaceState = {
      local: captureKeys(window.localStorage, workspaceLocalKeys),
      session: captureKeys(window.sessionStorage, workspaceSessionKeys),
    }
    window.localStorage.setItem(snapshotKey(mode), JSON.stringify(copied))
    window.localStorage.setItem(PERSONAL_SANDBOX_KEY, mode === 'personal' ? 'true' : 'false')
  }

  clearManagedState()
  const saved = readSavedWorkspace(mode)
  if (saved) {
    restoreKeys(window.localStorage, saved.local, workspaceLocalKeys)
    restoreKeys(window.sessionStorage, saved.session, workspaceSessionKeys)
  } else if (mode === 'personal') {
    seedBlankPersonalState()
    window.localStorage.removeItem(PERSONAL_SANDBOX_KEY)
  }

  window.localStorage.setItem(WORKSPACE_MODE_KEY, mode)
  if (options.copyCurrent && options.cloudUserId) {
    window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, options.cloudUserId)
  }
}

export function resetWorkspace(mode: WorkspaceMode) {
  clearManagedState()
  window.localStorage.removeItem(snapshotKey(mode))
  window.localStorage.removeItem(PERSONAL_SANDBOX_KEY)
  if (mode === 'personal') seedBlankPersonalState()
  window.localStorage.setItem(WORKSPACE_MODE_KEY, mode)
}

export function clearPersonalWorkspace() {
  clearManagedState()
  window.localStorage.removeItem(snapshotKey('personal'))
  window.localStorage.removeItem(PERSONAL_SANDBOX_KEY)
  seedBlankPersonalState()
  window.localStorage.setItem(WORKSPACE_MODE_KEY, 'personal')
}

export function reloadWorkspace() {
  window.location.assign('/')
}
