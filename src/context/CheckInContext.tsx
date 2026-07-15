import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useHealthInbox } from './HealthInboxContext'
import type { HealthExtraction, UploadItem } from '../types'

export type CheckInFocus = 'general' | 'mental_health' | 'symptoms' | 'blood_pressure' | 'diabetes' | 'medication'
export type CheckInCadence = 'daily' | 'weekdays' | 'weekly'
export type CheckInChannel = 'in_app' | 'browser'

export interface CheckInSchedule {
  id: string
  title: string
  focus: CheckInFocus
  prompt: string
  cadence: CheckInCadence
  time: string
  weekday: number
  enabled: boolean
  channels: CheckInChannel[]
  nextDueAt: string
  lastCompletedAt?: string
  lastNotifiedFor?: string
}

export interface CheckInResponse {
  id: string
  scheduleId: string
  scheduleTitle: string
  focus: CheckInFocus
  prompt: string
  response: string
  createdAt: string
}

type SchedulePatch = Partial<Omit<CheckInSchedule, 'id'>>

interface CheckInContextValue {
  schedules: CheckInSchedule[]
  responses: CheckInResponse[]
  activeSchedule: CheckInSchedule | null
  nextSchedule: CheckInSchedule | null
  dueCount: number
  notificationPermission: NotificationPermission | 'unsupported'
  addSchedule: () => void
  updateSchedule: (scheduleId: string, patch: SchedulePatch) => void
  removeSchedule: (scheduleId: string) => void
  startCheckIn: (scheduleId: string) => void
  snoozeActive: (minutes?: number) => void
  completeCheckIn: (response: string) => void
  requestBrowserNotifications: () => Promise<NotificationPermission | 'unsupported'>
  resetCheckIns: () => void
}

const STORAGE_KEY = 'vital-check-ins-v1'
const RESPONSE_KEY = 'vital-check-in-responses-v1'

function validDay(schedule: Pick<CheckInSchedule, 'cadence' | 'weekday'>, date: Date) {
  const day = date.getDay()
  if (schedule.cadence === 'daily') return true
  if (schedule.cadence === 'weekdays') return day >= 1 && day <= 5
  return day === schedule.weekday
}

function nextOccurrence(schedule: Pick<CheckInSchedule, 'cadence' | 'time' | 'weekday'>, from = new Date()) {
  const [hour, minute] = schedule.time.split(':').map((value) => Number.parseInt(value, 10))
  for (let offset = 0; offset < 15; offset += 1) {
    const candidate = new Date(from)
    candidate.setDate(from.getDate() + offset)
    candidate.setHours(Number.isFinite(hour) ? hour : 19, Number.isFinite(minute) ? minute : 0, 0, 0)
    if (candidate.getTime() > from.getTime() && validDay(schedule, candidate)) return candidate
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000)
}

function seedSchedules(): CheckInSchedule[] {
  const daily = {
    id: 'checkin-daily-wellbeing',
    title: 'Daily wellbeing check-in',
    focus: 'general' as const,
    prompt: 'How are you feeling today? Is anything better, worse, or different?',
    cadence: 'daily' as const,
    time: '19:00',
    weekday: 3,
    enabled: true,
    channels: ['in_app'] as CheckInChannel[],
  }
  const weekly = {
    id: 'checkin-weekly-mood',
    title: 'Weekly mood and stress check-in',
    focus: 'mental_health' as const,
    prompt: 'How has your mood, sleep, stress, and energy been this week?',
    cadence: 'weekly' as const,
    time: '18:30',
    weekday: 0,
    enabled: false,
    channels: ['in_app'] as CheckInChannel[],
  }
  return [
    { ...daily, nextDueAt: nextOccurrence(daily).toISOString() },
    { ...weekly, nextDueAt: nextOccurrence(weekly).toISOString() },
  ]
}

function readArray<T>(key: string, fallback: T[]) {
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null')
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch {
    return fallback
  }
}

function notificationState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

const CheckInContext = createContext<CheckInContextValue | undefined>(undefined)

export function CheckInProvider({ children }: { children: ReactNode }) {
  const { queueExtractionFindings } = useHealthInbox()
  const [schedules, setSchedules] = useState<CheckInSchedule[]>(() => readArray(STORAGE_KEY, seedSchedules()))
  const [responses, setResponses] = useState<CheckInResponse[]>(() => readArray(RESPONSE_KEY, []))
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(notificationState)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
  }, [schedules])

  useEffect(() => {
    window.localStorage.setItem(RESPONSE_KEY, JSON.stringify(responses.slice(0, 50)))
  }, [responses])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const dueSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.enabled && new Date(schedule.nextDueAt).getTime() <= now)
      .sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt)),
    [schedules, now],
  )

  const nextSchedule = useMemo(
    () => [...schedules].filter((schedule) => schedule.enabled).sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt))[0] || null,
    [schedules],
  )

  const activeSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === activeScheduleId) || null,
    [schedules, activeScheduleId],
  )

  useEffect(() => {
    if (!activeScheduleId && dueSchedules[0]) setActiveScheduleId(dueSchedules[0].id)
  }, [activeScheduleId, dueSchedules])

  useEffect(() => {
    const schedule = dueSchedules.find((item) => item.channels.includes('browser') && item.lastNotifiedFor !== item.nextDueAt)
    if (!schedule || notificationPermission !== 'granted' || typeof Notification === 'undefined') return

    const notification = new Notification('Vital Passport check-in', {
      body: schedule.prompt,
      tag: `vital-checkin-${schedule.id}`,
    })
    notification.onclick = () => {
      window.focus()
      setActiveScheduleId(schedule.id)
      notification.close()
    }
    setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, lastNotifiedFor: schedule.nextDueAt } : item))
  }, [dueSchedules, notificationPermission])

  const addSchedule = () => {
    const schedule = {
      id: `checkin-${Date.now()}`,
      title: 'New health check-in',
      focus: 'general' as CheckInFocus,
      prompt: 'How are you feeling today? Is anything new or different?',
      cadence: 'daily' as CheckInCadence,
      time: '19:00',
      weekday: new Date().getDay(),
      enabled: true,
      channels: ['in_app'] as CheckInChannel[],
    }
    setSchedules((current) => [...current, { ...schedule, nextDueAt: nextOccurrence(schedule).toISOString() }])
  }

  const updateSchedule = (scheduleId: string, patch: SchedulePatch) => {
    setSchedules((current) => current.map((schedule) => {
      if (schedule.id !== scheduleId) return schedule
      const updated = { ...schedule, ...patch }
      const timingChanged = patch.time !== undefined || patch.cadence !== undefined || patch.weekday !== undefined
      return timingChanged ? { ...updated, nextDueAt: nextOccurrence(updated).toISOString(), lastNotifiedFor: undefined } : updated
    }))
  }

  const removeSchedule = (scheduleId: string) => {
    setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId))
    if (activeScheduleId === scheduleId) setActiveScheduleId(null)
  }

  const startCheckIn = (scheduleId: string) => setActiveScheduleId(scheduleId)

  const snoozeActive = (minutes = 60) => {
    if (!activeSchedule) return
    const nextDueAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    setSchedules((current) => current.map((schedule) => schedule.id === activeSchedule.id ? { ...schedule, nextDueAt, lastNotifiedFor: undefined } : schedule))
    setActiveScheduleId(null)
  }

  const completeCheckIn = (rawResponse: string) => {
    const response = rawResponse.trim()
    if (!activeSchedule || !response) return
    const createdAt = new Date().toISOString()
    const itemId = `checkin-${activeSchedule.id}-${Date.now()}`
    const extraction: HealthExtraction = {
      document_type: 'symptom_note',
      title: `${activeSchedule.title} response`,
      summary: response,
      event_date: createdAt.slice(0, 10),
      facility: 'Patient scheduled check-in',
      medications: [],
      lab_results: [],
      diagnoses: [],
      instructions: [],
      symptoms: [response],
      follow_up: '',
      evidence: [{ field: 'Patient check-in', value: response, quote: response, confidence: 1 }],
      warnings: [],
      requires_confirmation: true,
      confidence: 1,
    }
    const item: UploadItem = {
      id: itemId,
      name: extraction.title,
      type: 'voice',
      date: 'Today',
      status: 'ready',
      summary: response,
      extraction,
    }
    queueExtractionFindings(item)
    setResponses((current) => [{
      id: itemId,
      scheduleId: activeSchedule.id,
      scheduleTitle: activeSchedule.title,
      focus: activeSchedule.focus,
      prompt: activeSchedule.prompt,
      response,
      createdAt,
    }, ...current].slice(0, 50))
    setSchedules((current) => current.map((schedule) => schedule.id === activeSchedule.id ? {
      ...schedule,
      lastCompletedAt: createdAt,
      nextDueAt: nextOccurrence(schedule, new Date(Date.now() + 60_000)).toISOString(),
      lastNotifiedFor: undefined,
    } : schedule))
    setActiveScheduleId(null)
  }

  const requestBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return 'unsupported' as const
    }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    return permission
  }

  const resetCheckIns = () => {
    const seeded = seedSchedules()
    setSchedules(seeded)
    setResponses([])
    setActiveScheduleId(null)
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(RESPONSE_KEY)
  }

  return <CheckInContext.Provider value={{
    schedules,
    responses,
    activeSchedule,
    nextSchedule,
    dueCount: dueSchedules.length,
    notificationPermission,
    addSchedule,
    updateSchedule,
    removeSchedule,
    startCheckIn,
    snoozeActive,
    completeCheckIn,
    requestBrowserNotifications,
    resetCheckIns,
  }}>{children}</CheckInContext.Provider>
}

export function useCheckIns() {
  const context = useContext(CheckInContext)
  if (!context) throw new Error('useCheckIns must be used within CheckInProvider')
  return context
}
