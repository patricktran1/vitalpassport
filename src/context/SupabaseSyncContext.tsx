import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useVital } from './VitalContext'
import { useWorkspace } from './WorkspaceContext'
import { supabase } from '../lib/supabase'
import {
  CLOUD_BUNDLE_SCHEMA_VERSION,
  captureCloudBundle,
  cloudBundleSignature,
  restoreCloudBundle,
  syncedCloudModules,
  type PatientCloudBundle,
} from '../lib/cloudBundle'
import { deleteCloudBundle, loadCloudBundle, saveCloudBundle } from '../lib/cloudSyncService'
import { CLOUD_LOADED_USER_KEY, saveLocalSnapshot } from '../lib/recordStorage'
import { clearPersonalWorkspace, PERSONAL_SANDBOX_KEY, reloadWorkspace } from '../lib/workspace'
import type { CloudSyncStatus, PatientRecordSnapshot } from '../types'

interface SupabaseSyncContextValue {
  status: CloudSyncStatus
  storageMode: 'local' | 'cloud'
  lastSyncedAt: string | null
  error: string
  schemaVersion: number
  syncedModules: readonly string[]
  hasCloudRecord: boolean | null
  legacyDemoCloud: boolean
  syncNow: () => Promise<void>
  reloadFromCloud: () => Promise<void>
  deleteCloudRecord: () => Promise<void>
  resetToBlank: () => Promise<void>
}

function isLegacyMariaBundle(bundle: PatientCloudBundle) {
  if (bundle.browserState.local[PERSONAL_SANDBOX_KEY] === 'true') return false
  const sourceIds = new Set(bundle.coreRecord.sources.map((source) => source.id))
  const medicationIds = new Set(bundle.coreRecord.clinicalMedications.map((medication) => medication.id))
  return sourceIds.has('src-bottle')
    && sourceIds.has('src-labs')
    && medicationIds.has('med-metoprolol-bottle')
}

const SupabaseSyncContext = createContext<SupabaseSyncContextValue | undefined>(undefined)

export function SupabaseSyncProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const vital = useVital()
  const workspace = useWorkspace()
  const [status, setStatus] = useState<CloudSyncStatus>('local')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [hasCloudRecord, setHasCloudRecord] = useState<boolean | null>(null)
  const [legacyDemoCloud, setLegacyDemoCloud] = useState(false)
  const syncInFlight = useRef(false)
  const lastUploadedSignature = useRef('')

  const snapshot = useMemo<PatientRecordSnapshot>(() => ({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    answers: vital.answers,
    uploads: vital.uploads,
    sources: vital.sources,
    timelineEvents: vital.timelineEvents,
    clinicalMedications: vital.clinicalMedications,
    labResults: vital.labResults,
    reconciliationIssues: vital.reconciliationIssues,
    careTasks: vital.careTasks,
  }), [
    vital.answers,
    vital.uploads,
    vital.sources,
    vital.timelineEvents,
    vital.clinicalMedications,
    vital.labResults,
    vital.reconciliationIssues,
    vital.careTasks,
  ])

  useEffect(() => { saveLocalSnapshot(snapshot) }, [snapshot])

  const pushBundle = useCallback(async (bundle: PatientCloudBundle) => {
    if (workspace.isDemo) throw new Error('Maria demo data stays local unless you explicitly copy it into your account.')
    if (legacyDemoCloud) throw new Error('A legacy Maria demo bundle is quarantined in this account. Reset the cloud record to blank before saving personal information.')
    if (!supabase || !auth.user || syncInFlight.current) return
    syncInFlight.current = true
    setStatus('saving')
    setError('')
    try {
      const syncedAt = await saveCloudBundle(supabase, auth.user.id, bundle)
      window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, auth.user.id)
      lastUploadedSignature.current = cloudBundleSignature(bundle)
      setLastSyncedAt(syncedAt)
      setHasCloudRecord(true)
      setLegacyDemoCloud(false)
      setStatus('synced')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The cloud record could not be synchronized.'
      setStatus('error')
      setError(message)
      throw new Error(message)
    } finally {
      syncInFlight.current = false
    }
  }, [auth.user, legacyDemoCloud, workspace.isDemo])

  const syncNow = useCallback(async () => {
    await pushBundle(captureCloudBundle(snapshot))
  }, [pushBundle, snapshot])

  const applyCloudBundle = useCallback((bundle: PatientCloudBundle, updatedAt: string | null, userId: string) => {
    restoreCloudBundle(bundle)
    saveLocalSnapshot(bundle.coreRecord)
    window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, userId)
    lastUploadedSignature.current = cloudBundleSignature(bundle)
    setLastSyncedAt(updatedAt || bundle.updatedAt)
    setHasCloudRecord(true)
    setLegacyDemoCloud(false)
  }, [])

  const quarantineIfLegacyDemo = useCallback((bundle: PatientCloudBundle | null, updatedAt: string | null) => {
    if (!bundle || !isLegacyMariaBundle(bundle)) return false
    window.sessionStorage.removeItem(CLOUD_LOADED_USER_KEY)
    lastUploadedSignature.current = ''
    setHasCloudRecord(true)
    setLegacyDemoCloud(true)
    setLastSyncedAt(updatedAt || bundle.updatedAt)
    setStatus('synced')
    setError('')
    return true
  }, [])

  const reloadFromCloud = useCallback(async () => {
    if (workspace.isDemo) throw new Error('Switch to your personal Passport before loading an account record.')
    if (!supabase || !auth.user) return
    setStatus('loading')
    setError('')
    try {
      const result = await loadCloudBundle(supabase, auth.user.id)
      setHasCloudRecord(Boolean(result.bundle))
      if (!result.bundle) {
        await syncNow()
        return
      }
      if (quarantineIfLegacyDemo(result.bundle, result.updatedAt)) return
      applyCloudBundle(result.bundle, result.updatedAt, auth.user.id)
      window.location.reload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The cloud record could not be loaded.'
      setStatus('error')
      setError(message)
      throw new Error(message)
    }
  }, [applyCloudBundle, auth.user, quarantineIfLegacyDemo, syncNow, workspace.isDemo])

  const deleteCloudRecord = useCallback(async () => {
    if (!supabase || !auth.user) return
    setStatus('saving')
    setError('')
    try {
      await deleteCloudBundle(supabase, auth.user.id)
      window.sessionStorage.removeItem(CLOUD_LOADED_USER_KEY)
      lastUploadedSignature.current = ''
      setLastSyncedAt(null)
      setHasCloudRecord(false)
      setLegacyDemoCloud(false)
      setStatus('local')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The cloud record could not be deleted.'
      setStatus('error')
      setError(message)
      throw new Error(message)
    }
  }, [auth.user])

  const resetToBlank = useCallback(async () => {
    if (workspace.isDemo) throw new Error('Switch to your personal Passport before resetting it.')
    await deleteCloudRecord()
    clearPersonalWorkspace()
    reloadWorkspace()
  }, [deleteCloudRecord, workspace.isDemo])

  useEffect(() => {
    if (!auth.user || !supabase) {
      setHasCloudRecord(null)
      setLegacyDemoCloud(false)
      return
    }
    const client = supabase
    let cancelled = false
    void loadCloudBundle(client, auth.user.id).then((result) => {
      if (cancelled) return
      setHasCloudRecord(Boolean(result.bundle))
      if (workspace.isDemo) setLegacyDemoCloud(Boolean(result.bundle && isLegacyMariaBundle(result.bundle)))
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [auth.user?.id, workspace.isDemo])

  useEffect(() => {
    if (auth.loading) {
      setStatus(auth.configured && !workspace.isDemo ? 'loading' : 'local')
      return
    }
    if (workspace.isDemo) {
      setStatus('local')
      setError('')
      lastUploadedSignature.current = ''
      return
    }
    if (!auth.configured || !auth.user || !supabase) {
      setStatus('local')
      setError('')
      lastUploadedSignature.current = ''
      setLegacyDemoCloud(false)
      return
    }

    const client = supabase
    const userId = auth.user.id
    if (window.sessionStorage.getItem(CLOUD_LOADED_USER_KEY) === userId) {
      lastUploadedSignature.current = cloudBundleSignature(captureCloudBundle(snapshot))
      setStatus('synced')
      return
    }

    let cancelled = false
    const initialize = async () => {
      setStatus('loading')
      setError('')
      try {
        const result = await loadCloudBundle(client, userId)
        if (cancelled) return
        setHasCloudRecord(Boolean(result.bundle))
        if (!result.bundle) {
          await pushBundle(captureCloudBundle(snapshot))
          return
        }
        if (quarantineIfLegacyDemo(result.bundle, result.updatedAt)) return

        applyCloudBundle(result.bundle, result.updatedAt, userId)
        if (!result.bundle.browserState.complete) {
          await pushBundle(captureCloudBundle(result.bundle.coreRecord))
        }
        window.location.reload()
      } catch (caught) {
        if (cancelled) return
        setStatus('error')
        setError(caught instanceof Error ? caught.message : 'Cloud initialization failed.')
      }
    }

    void initialize()
    return () => { cancelled = true }
  }, [auth.configured, auth.loading, auth.user?.id, workspace.isDemo])

  useEffect(() => {
    if (workspace.isDemo || legacyDemoCloud || !auth.user || !supabase) return
    if (window.sessionStorage.getItem(CLOUD_LOADED_USER_KEY) !== auth.user.id) return

    const checkForChanges = () => {
      if (syncInFlight.current) return
      const bundle = captureCloudBundle(snapshot)
      if (cloudBundleSignature(bundle) === lastUploadedSignature.current) return
      void pushBundle(bundle).catch(() => undefined)
    }

    const first = window.setTimeout(checkForChanges, 900)
    const interval = window.setInterval(checkForChanges, 2500)
    window.addEventListener('storage', checkForChanges)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(interval)
      window.removeEventListener('storage', checkForChanges)
    }
  }, [auth.user?.id, legacyDemoCloud, pushBundle, snapshot, workspace.isDemo])

  const value = useMemo<SupabaseSyncContextValue>(() => ({
    status,
    storageMode: auth.user && auth.configured && !workspace.isDemo ? 'cloud' : 'local',
    lastSyncedAt,
    error,
    schemaVersion: CLOUD_BUNDLE_SCHEMA_VERSION,
    syncedModules: syncedCloudModules,
    hasCloudRecord,
    legacyDemoCloud,
    syncNow,
    reloadFromCloud,
    deleteCloudRecord,
    resetToBlank,
  }), [auth.configured, auth.user, deleteCloudRecord, error, hasCloudRecord, lastSyncedAt, legacyDemoCloud, reloadFromCloud, resetToBlank, status, syncNow, workspace.isDemo])

  return <SupabaseSyncContext.Provider value={value}>{children}</SupabaseSyncContext.Provider>
}

export function useSupabaseSync() {
  const context = useContext(SupabaseSyncContext)
  if (!context) throw new Error('useSupabaseSync must be used within SupabaseSyncProvider')
  return context
}
