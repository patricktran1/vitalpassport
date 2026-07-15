import type { PatientRecordSnapshot } from '../types'

export const LOCAL_RECORD_KEY = 'vital-patient-record-v1'
export const CLOUD_LOADED_USER_KEY = 'vital-cloud-loaded-user'

const sessionKeys = {
  answers: 'vital-answers',
  uploads: 'vital-uploads',
  sources: 'vital-sources',
  timelineEvents: 'vital-timeline',
  clinicalMedications: 'vital-clinical-medications',
  labResults: 'vital-lab-results',
  reconciliationIssues: 'vital-reconciliation-issues',
  careTasks: 'vital-care-tasks',
} as const

export function isPatientRecordSnapshot(value: unknown): value is PatientRecordSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PatientRecordSnapshot>
  return candidate.schemaVersion === 1
    && Boolean(candidate.answers)
    && Array.isArray(candidate.uploads)
    && Array.isArray(candidate.sources)
    && Array.isArray(candidate.timelineEvents)
    && Array.isArray(candidate.clinicalMedications)
    && Array.isArray(candidate.labResults)
    && Array.isArray(candidate.reconciliationIssues)
    && Array.isArray(candidate.careTasks)
}

export function writeSnapshotToSession(snapshot: PatientRecordSnapshot) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(sessionKeys.answers, JSON.stringify(snapshot.answers))
  window.sessionStorage.setItem(sessionKeys.uploads, JSON.stringify(snapshot.uploads))
  window.sessionStorage.setItem(sessionKeys.sources, JSON.stringify(snapshot.sources))
  window.sessionStorage.setItem(sessionKeys.timelineEvents, JSON.stringify(snapshot.timelineEvents))
  window.sessionStorage.setItem(sessionKeys.clinicalMedications, JSON.stringify(snapshot.clinicalMedications))
  window.sessionStorage.setItem(sessionKeys.labResults, JSON.stringify(snapshot.labResults))
  window.sessionStorage.setItem(sessionKeys.reconciliationIssues, JSON.stringify(snapshot.reconciliationIssues))
  window.sessionStorage.setItem(sessionKeys.careTasks, JSON.stringify(snapshot.careTasks))
}

export function saveLocalSnapshot(snapshot: PatientRecordSnapshot) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_RECORD_KEY, JSON.stringify(snapshot))
}

export function readLocalSnapshot(): PatientRecordSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(LOCAL_RECORD_KEY)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    return isPatientRecordSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function hydrateSessionFromLocalRecord() {
  if (typeof window === 'undefined') return
  if (window.sessionStorage.getItem(sessionKeys.answers)) return
  const snapshot = readLocalSnapshot()
  if (snapshot) writeSnapshotToSession(snapshot)
}
