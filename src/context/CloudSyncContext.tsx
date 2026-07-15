import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useVital } from './VitalContext'
import { supabase } from '../lib/supabase'
import {
  CLOUD_LOADED_USER_KEY,
  isPatientRecordSnapshot,
  saveLocalSnapshot,
  writeSnapshotToSession,
} from '../lib/recordStorage'
import type { CloudSyncStatus, PatientRecordSnapshot } from '../types'

interface CloudSyncContextValue {
  status: CloudSyncStatus
  storageMode: 'local' | 'cloud'
  lastSyncedAt: string | null
  error: string
  syncNow: () => Promise<void>
  reloadFromCloud: () => Promise<void>
}

const CloudSyncContext = createContext<CloudSyncContextValue | undefined>(undefined)

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const {
    answers,
    uploads,
    sources,
    timelineEvents,
    clinicalMedications,
    labResults,
    reconciliationIssues,
    careTasks,
  } = useVital()
  const [status, setStatus] = useState<CloudSyncStatus>('local')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState('')

  const snapshot = useMemo<PatientRecordSnapshot>(() => ({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    answers,
    uploads,
    sources,
    timelineEvents,
    clinicalMedications,
    labResults,
    reconciliationIssues,
    careTasks,
  }), [answers, uploads, sources, timelineEvents, clinicalMedications, labResults, reconciliationIssues, careTasks])

  useEffect(() => {
    saveLocalSnapshot(snapshot)
  }, [snapshot])

  const pushSnapshot = useCallback(async (record: PatientRecordSnapshot = snapshot) => {
    if (!supabase || !auth.user) return
    setStatus('saving')
    setError('')
    const syncedAt = new Date().toISOString()
    const { error: saveError } = await supabase.from('patient_records').upsert({
      user_id: auth.user.id,
      record: { ...record, updatedAt: syncedAt },
      schema_version: record.schemaVersion,
      updated_at: syncedAt,
    }, { onConflict: 'user_id' })
    if (saveError) {
      setStatus('error')
      setError(saveError.message)
      throw saveError
    }
    window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, auth.user.id)
    setLastSyncedAt(syncedAt)
    setStatus('synced')
  }, [auth.user, snapshot])

  const reloadFromCloud = useCallback(async () => {
    if (!supabase || !auth.user) return
    setStatus('loading')
    setError('')
    const { data, error: loadError } = await supabase
      .from('patient_records')
      .select('record, updated_at')
      .eq('user_id', auth.user.id)
      .maybeSingle()
    if (loadError) {
      setStatus('error')
      setError(loadError.message)
      throw loadError
    }
    if (!data?.record || !isPatientRecordSnapshot(data.record)) {
      await pushSnapshot(snapshot)
      return
    }
    writeSnapshotToSession(data.record)
    saveLocalSnapshot(data.record)
    window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, auth.user.id)
    setLastSyncedAt(typeof data.updated_at === 'string' ? data.updated_at : data.record.updatedAt)
    window.location.reload()
  }, [auth.user, pushSnapshot, snapshot])

  useEffect(() => {
    if (auth.loading) {
      setStatus(auth.configured ? 'loading' : 'local')
      return
    }
    if (!auth.configured || !auth.user || !supabase) {
      setStatus('local')
      setError('')
      return
    }
    const loadedUser = window.sessionStorage.getItem(CLOUD_LOADED_USER_KEY)
    if (loadedUser === auth.user.id) {
      setStatus('synced')
      return
    }

    let cancelled = false
    const initializeCloudRecord = async () => {
      setStatus('loading')
      setError('')
      const { data, error: loadError } = await supabase
        .from('patient_records')
        .select('record, updated_at')
        .eq('user_id', auth.user!.id)
        .maybeSingle()
      if (cancelled) return
      if (loadError) {
        setStatus('error')
        setError(loadError.message)
        return
      }
      if (data?.record && isPatientRecordSnapshot(data.record)) {
        writeSnapshotToSession(data.record)
        saveLocalSnapshot(data.record)
        window.sessionStorage.setItem(CLOUD_LOADED_USER_KEY, auth.user!.id)
        setLastSyncedAt(typeof data.updated_at === 'string' ? data.updated_at : data.record.updatedAt)
        window.location.reload()
        return
      }
      try {
        await pushSnapshot(snapshot)
      } catch {
        // pushSnapshot exposes the provider error state.
      }
    }
    void initializeCloudRecord()
    return () => { cancelled = true }
  }, [auth.configured, auth.loading, auth.user?.id])

  useEffect(() => {
    if (!auth.user || !supabase) return
    if (window.sessionStorage.getItem(CLOUD_LOADED_USER_KEY) !== auth.user.id) return
    const timer = window.setTimeout(() => {
      void pushSnapshot(snapshot).catch(() => undefined)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [auth.user?.id, pushSnapshot, snapshot])

  const value = useMemo<CloudSyncContextValue>(() => ({
    status,
    storageMode: auth.user && auth.configured ? 'cloud' : 'local',
    lastSyncedAt,
    error,
    syncNow: async () => pushSnapshot(snapshot),
    reloadFromCloud,
  }), [auth.configured, auth.user, error, lastSyncedAt, pushSnapshot, reloadFromCloud, snapshot, status])

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext)
  if (!context) throw new Error('useCloudSync must be used within CloudSyncProvider')
  return context
}
