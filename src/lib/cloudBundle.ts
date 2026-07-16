import { isPatientRecordSnapshot, writeSnapshotToSession } from './recordStorage'
import type { PatientRecordSnapshot } from '../types'

export const CLOUD_BUNDLE_SCHEMA_VERSION = 2 as const

export const syncedLocalStorageKeys = [
  'vital-copilot-memory-v1',
  'vital-check-ins-v1',
  'vital-check-in-responses-v1',
  'vital-check-in-responses-v2',
  'vital-check-in-mock-deliveries-v1',
  'vital-check-in-mock-contact-v1',
  'vital-health-signals-v1',
  'vital-apple-health-demo-v1',
  'vital-personal-sandbox-from-demo-v1',
] as const

export const syncedSessionStorageKeys = [
  'vital-health-inbox-v1',
] as const

export const syncedCloudModules = [
  'Core health record',
  'Health Inbox decisions',
  'Check-in schedules and responses',
  'Mock reminder history',
  'Copilot memory',
  'Health Signals snapshot',
  'Apple Health demo data',
] as const

export interface PatientCloudBundle {
  schemaVersion: typeof CLOUD_BUNDLE_SCHEMA_VERSION
  updatedAt: string
  coreRecord: PatientRecordSnapshot
  browserState: {
    complete: boolean
    local: Record<string, string>
    session: Record<string, string>
  }
}

function captureKeys(storage: Storage, keys: readonly string[]) {
  return keys.reduce<Record<string, string>>((captured, key) => {
    const value = storage.getItem(key)
    if (value !== null) captured[key] = value
    return captured
  }, {})
}

export function captureCloudBundle(coreRecord: PatientRecordSnapshot): PatientCloudBundle {
  const browserState = typeof window === 'undefined'
    ? { complete: true, local: {}, session: {} }
    : {
        complete: true,
        local: captureKeys(window.localStorage, syncedLocalStorageKeys),
        session: captureKeys(window.sessionStorage, syncedSessionStorageKeys),
      }

  return {
    schemaVersion: CLOUD_BUNDLE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    coreRecord,
    browserState,
  }
}

export function cloudBundleSignature(bundle: PatientCloudBundle) {
  return JSON.stringify({
    coreRecord: bundle.coreRecord,
    browserState: bundle.browserState,
  })
}

export function isPatientCloudBundle(value: unknown): value is PatientCloudBundle {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PatientCloudBundle>
  return candidate.schemaVersion === CLOUD_BUNDLE_SCHEMA_VERSION
    && isPatientRecordSnapshot(candidate.coreRecord)
    && Boolean(candidate.browserState)
    && typeof candidate.browserState === 'object'
    && Boolean(candidate.browserState?.local)
    && Boolean(candidate.browserState?.session)
}

export function normalizeCloudRecord(value: unknown): PatientCloudBundle | null {
  if (isPatientCloudBundle(value)) {
    return {
      ...value,
      browserState: {
        complete: value.browserState.complete !== false,
        local: value.browserState.local,
        session: value.browserState.session,
      },
    }
  }
  if (isPatientRecordSnapshot(value)) {
    return {
      schemaVersion: CLOUD_BUNDLE_SCHEMA_VERSION,
      updatedAt: value.updatedAt,
      coreRecord: value,
      browserState: { complete: false, local: {}, session: {} },
    }
  }
  return null
}

function restoreKeys(storage: Storage, values: Record<string, string>, allowedKeys: readonly string[], removeMissing: boolean) {
  allowedKeys.forEach((key) => {
    const value = values[key]
    if (typeof value === 'string') storage.setItem(key, value)
    else if (removeMissing) storage.removeItem(key)
  })
}

export function restoreCloudBundle(bundle: PatientCloudBundle) {
  if (typeof window === 'undefined') return
  writeSnapshotToSession(bundle.coreRecord)
  restoreKeys(window.localStorage, bundle.browserState.local, syncedLocalStorageKeys, bundle.browserState.complete)
  restoreKeys(window.sessionStorage, bundle.browserState.session, syncedSessionStorageKeys, bundle.browserState.complete)
}
