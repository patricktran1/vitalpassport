import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useVital } from './VitalContext'
import { supabase } from '../lib/supabase'
import {
  CLOUD_BUNDLE_SCHEMA_VERSION,
  captureCloudBundle,
  cloudBundleSignature,
  restoreCloudBundle,
  syncedCloudModules,
  type PatientCloudBundle,
} from '../lib/cloudBundle'
import { loadCloudBundle, saveCloudBundle } from '../lib/cloudSyncService'
import { CLOUD_LOADED_USER_KEY, saveLocalSnapshot } from '../lib/recordStorage'
import type { CloudSyncStatus, PatientRecordSnapshot } from '../types'

interface SupabaseSyncContextValue {
  status: CloudSyncStatus
  storageMode: 'local' | 'cloud'
  lastSyncedAt: string | null
  error: string
  schemaVersion: number
  syncedModules: readonly string[]
  syncNow: () => Promise<void>
  reloadFromCloud: () => Promise<void>
}

const SupabaseSyncContext = createContext<SupabaseSyncContextValue | undefined>(undefined)

export function SupabaseSyncProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const vital = useVital()
  const [status, setStatus] = useState<CloudSyncStatus>('local')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
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
    if (!supabase || !auth.user || syncInFlight.current) return
    syncInFlight.current = true
    setStatus('saving')
    setError('')
    try {
      const syncedAt = await saveCloudBundle(supabase, auth.user.id, bundle)
      window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, auth.user.id)
      lastUploadedSignature.current = cloudBundleSignature(bundle)
      setLastSyncedAt(syncedAt)
      setStatus('synced')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The cloud record could not be synchronized.'
      setStatus('error')
      setError(message)
      throw new Error(message)
    } finally {
      syncInFlight.current = false
    }
  }, [auth.user])

  const syncNow = useCallback(async () => {
    await pushBundle(captureCloudBundle(snapshot))
  }, [pushBundle, snapshot])

  const applyCloudBundle = useCallback((bundle: PatientCloudBundle, updatedAt: string | null, userId: string) => {
    restoreCloudBundle(bundle)
    saveLocalSnapshot(bundle.coreRecord)
    window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, userId)
    lastUploadedSignature.current = cloudBundleSignature(bundle)
    setLastSyncedAt(updatedAt || bundle.updatedAt)
  }, [])

  const reloadFromCloud = useCallback(async () => {
    if (!supabase || !auth.user) return
    setStatus('loading')
    setError('')
    try {
      const result = await loadCloudBundle(supabase, auth.user.id)
      if (!result.bundle) {
        await syncNow()
        return
      }
      applyCloudBundle(result.bundle, result.updatedAt, auth.user.id)
      window.location.reload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The cloud record could not be loaded.'
      setStatus('error')
      setError(message)
      throw new Error(message)
    }
  }, [applyCloudBundle, auth.user, syncNow])

  useEffect(() => {
    if (auth.loading) {
      setStatus(auth.configured ? 'loading' : 'local')
      return
    }
    if (!auth.configured || !auth.user || !supabase) {
      setStatus('local')
      setError('')
      lastUploadedSignature.current = ''
      return
    }

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
        const result = await loadCloudBundle(supabase, userId)
        if (cancelled) return
        if (!result.bundle) {
          await pushBundle(captureCloudBundle(snapshot))
          return
        }

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
  }, [auth.configured, auth.loading, auth.user?.id])

  useEffect(() => {
    if (!auth.user || !supabase) return
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
  }, [auth.user?.id, pushBundle, snapshot])

  const value = useMemo<SupabaseSyncContextValue>(() => ({
    status,
    storageMode: auth.user && auth.configured ? 'cloud' : 'local',
    lastSyncedAt,
    error,
    schemaVersion: CLOUD_BUNDLE_SCHEMA_VERSION,
    syncedModules: syncedCloudModules,
    syncNow,
    reloadFromCloud,
  }), [auth.configured, auth.user, error, lastSyncedAt, reloadFromCloud, status, syncNow])

  return <SupabaseSyncContext.Provider value={value}>{children}</SupabaseSyncContext.Provider>
}

export function useSupabaseSync() {
  const context = useContext(SupabaseSyncContext)
  if (!context) throw new Error('useSupabaseSync must be used within SupabaseSyncProvider')
  return context
}
