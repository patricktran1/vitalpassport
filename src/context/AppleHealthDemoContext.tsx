import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppleHealthCategory = 'sleep' | 'heart_rate' | 'resting_heart_rate' | 'hrv' | 'steps'
export type AppleHealthConnectionStatus = 'disconnected' | 'connected'

export interface AppleHealthDay {
  date: string
  sleepHours: number
  coreHours: number
  deepHours: number
  remHours: number
  awakeHours: number
  restingHeartRate: number
  sleepingHeartRate: number
  heartRateMin: number
  heartRateMax: number
  hrvMs: number
  steps: number
  sourceDevice: string
  sourceApp: string
  manuallyEntered: boolean
}

export interface AppleHealthSyncReceipt {
  id: string
  startedAt: string
  completedAt: string
  categories: AppleHealthCategory[]
  sampleCount: number
  dayCount: number
  status: 'success'
  mode: 'demo'
}

interface AppleHealthStoredState {
  status: AppleHealthConnectionStatus
  permissions: AppleHealthCategory[]
  days: AppleHealthDay[]
  syncHistory: AppleHealthSyncReceipt[]
  lastSyncAt: string | null
}

interface AppleHealthDemoContextValue extends AppleHealthStoredState {
  connectDemo: (permissions?: AppleHealthCategory[]) => void
  updatePermissions: (permissions: AppleHealthCategory[]) => void
  syncNow: () => void
  disconnectDemo: () => void
  clearImportedData: () => void
  resetAppleHealthDemo: () => void
  importedSampleCount: number
}

export const APPLE_HEALTH_DEMO_STORAGE_KEY = 'vital-apple-health-demo-v1'
export const defaultAppleHealthPermissions: AppleHealthCategory[] = ['sleep', 'heart_rate', 'resting_heart_rate', 'hrv']
export const appleHealthCategoryMeta: Array<{ key: AppleHealthCategory; label: string; detail: string }> = [
  { key: 'sleep', label: 'Sleep', detail: 'Total sleep plus awake, core, deep, and REM stages' },
  { key: 'heart_rate', label: 'Heart rate', detail: 'Daily minimum, maximum, and sleeping average' },
  { key: 'resting_heart_rate', label: 'Resting heart rate', detail: 'Daily resting heart-rate summary' },
  { key: 'hrv', label: 'Heart-rate variability', detail: 'Daily HRV summary in milliseconds' },
  { key: 'steps', label: 'Steps', detail: 'Daily step total from the selected source device' },
]

const emptyState: AppleHealthStoredState = {
  status: 'disconnected',
  permissions: defaultAppleHealthPermissions,
  days: [],
  syncHistory: [],
  lastSyncAt: null,
}

function dateDaysAgo(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - offset)
  return date.toISOString().slice(0, 10)
}

function createSeedDays(): AppleHealthDay[] {
  const sleep = [7.5, 7.3, 7.2, 7.1, 6.9, 6.8, 6.6, 6.3, 6.1, 5.9, 5.8, 5.6, 5.5, 5.4]
  const resting = [67, 68, 67, 69, 68, 70, 70, 72, 73, 74, 74, 76, 76, 77]
  const sleeping = [59, 60, 59, 61, 60, 61, 62, 63, 64, 65, 65, 66, 67, 67]
  const hrv = [42, 44, 43, 41, 40, 39, 38, 37, 36, 34, 35, 32, 31, 30]
  const steps = [6420, 7120, 8040, 6950, 7550, 6110, 5840, 5300, 4920, 4560, 5120, 4310, 3980, 4720]

  return sleep.map((sleepHours, index) => {
    const recentIndex = sleep.length - 1 - index
    const deepHours = Math.max(0.7, Math.round((sleepHours * 0.17) * 10) / 10)
    const remHours = Math.max(0.9, Math.round((sleepHours * 0.22) * 10) / 10)
    const coreHours = Math.max(2.5, Math.round((sleepHours - deepHours - remHours) * 10) / 10)
    const awakeHours = Math.round((0.45 + recentIndex * 0.025) * 10) / 10
    return {
      date: dateDaysAgo(recentIndex),
      sleepHours,
      coreHours,
      deepHours,
      remHours,
      awakeHours,
      restingHeartRate: resting[index],
      sleepingHeartRate: sleeping[index],
      heartRateMin: sleeping[index] - 6,
      heartRateMax: 118 + index * 2,
      hrvMs: hrv[index],
      steps: steps[index],
      sourceDevice: 'Maria’s Apple Watch',
      sourceApp: 'Apple Health demo',
      manuallyEntered: false,
    }
  })
}

function sampleCountFor(categories: AppleHealthCategory[], dayCount: number) {
  return categories.reduce((count, category) => {
    if (category === 'heart_rate') return count + dayCount * 96
    if (category === 'sleep') return count + dayCount * 5
    return count + dayCount
  }, 0)
}

function createReceipt(categories: AppleHealthCategory[], dayCount: number): AppleHealthSyncReceipt {
  const startedAt = new Date(Date.now() - 1200).toISOString()
  const completedAt = new Date().toISOString()
  return {
    id: `apple-health-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt,
    completedAt,
    categories: [...categories],
    sampleCount: sampleCountFor(categories, dayCount),
    dayCount,
    status: 'success',
    mode: 'demo',
  }
}

function readState(): AppleHealthStoredState {
  if (typeof window === 'undefined') return emptyState
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPLE_HEALTH_DEMO_STORAGE_KEY) || 'null') as Partial<AppleHealthStoredState> | null
    if (!parsed || typeof parsed !== 'object') return emptyState
    return {
      status: parsed.status === 'connected' ? 'connected' : 'disconnected',
      permissions: Array.isArray(parsed.permissions) && parsed.permissions.length ? parsed.permissions : defaultAppleHealthPermissions,
      days: Array.isArray(parsed.days) ? parsed.days : [],
      syncHistory: Array.isArray(parsed.syncHistory) ? parsed.syncHistory : [],
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
    }
  } catch {
    return emptyState
  }
}

const AppleHealthDemoContext = createContext<AppleHealthDemoContextValue | undefined>(undefined)

export function AppleHealthDemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppleHealthStoredState>(readState)

  useEffect(() => {
    window.localStorage.setItem(APPLE_HEALTH_DEMO_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const connectDemo = (permissions = defaultAppleHealthPermissions) => {
    const selected = permissions.length ? permissions : defaultAppleHealthPermissions
    const days = createSeedDays()
    const receipt = createReceipt(selected, days.length)
    setState({
      status: 'connected',
      permissions: selected,
      days,
      syncHistory: [receipt],
      lastSyncAt: receipt.completedAt,
    })
  }

  const updatePermissions = (permissions: AppleHealthCategory[]) => {
    setState((current) => ({ ...current, permissions: permissions.length ? permissions : current.permissions }))
  }

  const syncNow = () => {
    setState((current) => {
      if (current.status !== 'connected') return current
      const days = current.days.length ? current.days : createSeedDays()
      const receipt = createReceipt(current.permissions, days.length)
      return {
        ...current,
        days,
        syncHistory: [receipt, ...current.syncHistory].slice(0, 20),
        lastSyncAt: receipt.completedAt,
      }
    })
  }

  const disconnectDemo = () => setState((current) => ({ ...current, status: 'disconnected' }))

  const clearImportedData = () => setState((current) => ({
    ...current,
    days: [],
    syncHistory: [],
    lastSyncAt: null,
  }))

  const resetAppleHealthDemo = () => {
    setState(emptyState)
    window.localStorage.removeItem(APPLE_HEALTH_DEMO_STORAGE_KEY)
  }

  const importedSampleCount = useMemo(
    () => state.syncHistory[0]?.sampleCount || (state.days.length ? sampleCountFor(state.permissions, state.days.length) : 0),
    [state.syncHistory, state.days, state.permissions],
  )

  return <AppleHealthDemoContext.Provider value={{
    ...state,
    connectDemo,
    updatePermissions,
    syncNow,
    disconnectDemo,
    clearImportedData,
    resetAppleHealthDemo,
    importedSampleCount,
  }}>{children}</AppleHealthDemoContext.Provider>
}

export function useAppleHealthDemo() {
  const context = useContext(AppleHealthDemoContext)
  if (!context) throw new Error('useAppleHealthDemo must be used within AppleHealthDemoProvider')
  return context
}
