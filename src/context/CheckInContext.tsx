import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useHealthInbox } from './HealthInboxContext'
import type { HealthExtraction, UploadItem } from '../types'

export type CheckInFocus = 'general' | 'mental_health' | 'symptoms' | 'blood_pressure' | 'diabetes' | 'medication'
export type CheckInCadence = 'daily' | 'weekdays' | 'weekly'
export type CheckInChannel = 'in_app' | 'browser' | 'mock_email' | 'mock_sms'
export type MockDeliveryChannel = Extract<CheckInChannel, 'mock_email' | 'mock_sms'>
export type CheckInMetricKey = 'mood' | 'energy' | 'sleep' | 'pain' | 'stress' | 'symptomSeverity'
export type MedicationExperience = 'not_applicable' | 'better' | 'unchanged' | 'worse' | 'side_effects'

export interface CheckInMetrics {
  mood: number
  energy: number
  sleep: number
  pain: number
  stress: number
  symptomSeverity: number
  medicationExperience: MedicationExperience
}

export interface CheckInSubmission {
  response: string
  metrics: CheckInMetrics
}

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
  metrics: CheckInMetrics
  createdAt: string
  demo?: boolean
}

export interface MockDelivery {
  id: string
  occurrenceKey: string
  scheduleId: string
  scheduleTitle: string
  channel: MockDeliveryChannel
  destination: string
  subject: string
  body: string
  createdAt: string
  status: 'simulated_sent'
}

interface MockContact {
  email: string
  phone: string
}

type SchedulePatch = Partial<Omit<CheckInSchedule, 'id'>>

interface CheckInContextValue {
  schedules: CheckInSchedule[]
  responses: CheckInResponse[]
  deliveries: MockDelivery[]
  activeSchedule: CheckInSchedule | null
  nextSchedule: CheckInSchedule | null
  dueCount: number
  notificationPermission: NotificationPermission | 'unsupported'
  mockEmail: string
  mockPhone: string
  addSchedule: () => void
  updateSchedule: (scheduleId: string, patch: SchedulePatch) => void
  removeSchedule: (scheduleId: string) => void
  startCheckIn: (scheduleId: string) => void
  snoozeActive: (minutes?: number) => void
  completeCheckIn: (submission: CheckInSubmission) => void
  requestBrowserNotifications: () => Promise<NotificationPermission | 'unsupported'>
  setMockContact: (patch: Partial<MockContact>) => void
  sendMockReminder: (scheduleId: string, channel: MockDeliveryChannel) => void
  resetCheckIns: () => void
}

const STORAGE_KEY = 'vital-check-ins-v1'
const RESPONSE_KEY = 'vital-check-in-responses-v2'
const DELIVERY_KEY = 'vital-check-in-mock-deliveries-v1'
const CONTACT_KEY = 'vital-check-in-mock-contact-v1'
const defaultContact: MockContact = { email: 'maria.santos@example.com', phone: '(415) 555-0198' }

export const defaultCheckInMetrics: CheckInMetrics = {
  mood: 5,
  energy: 5,
  sleep: 5,
  pain: 1,
  stress: 5,
  symptomSeverity: 5,
  medicationExperience: 'not_applicable',
}

const clampScore = (value: number) => Math.max(1, Math.min(10, Math.round(value)))

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
    channels: ['in_app', 'mock_email'] as CheckInChannel[],
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

function atDaysAgo(days: number, hour = 19) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

function seedResponses(): CheckInResponse[] {
  const points: Array<[number, string, Omit<CheckInMetrics, 'medicationExperience'>, MedicationExperience]> = [
    [9, 'Felt fairly steady and slept well.', { mood: 7, energy: 7, sleep: 8, pain: 2, stress: 4, symptomSeverity: 3 }, 'unchanged'],
    [8, 'A little tired but symptoms were manageable.', { mood: 7, energy: 7, sleep: 7, pain: 2, stress: 4, symptomSeverity: 3 }, 'unchanged'],
    [7, 'Dizziness was more noticeable in the afternoon.', { mood: 6, energy: 6, sleep: 7, pain: 3, stress: 5, symptomSeverity: 4 }, 'unchanged'],
    [5, 'Sleep was lighter and I felt more drained.', { mood: 6, energy: 5, sleep: 6, pain: 3, stress: 6, symptomSeverity: 5 }, 'unchanged'],
    [4, 'More stress and dizziness during errands.', { mood: 5, energy: 5, sleep: 5, pain: 4, stress: 7, symptomSeverity: 6 }, 'worse'],
    [3, 'Poor sleep and stronger symptoms after standing.', { mood: 5, energy: 4, sleep: 4, pain: 4, stress: 8, symptomSeverity: 7 }, 'worse'],
    [1, 'Very little sleep. Symptoms and fatigue felt worse.', { mood: 4, energy: 4, sleep: 3, pain: 5, stress: 8, symptomSeverity: 8 }, 'side_effects'],
  ]
  return points.map(([daysAgo, response, metrics, medicationExperience]) => ({
    id: `demo-checkin-${daysAgo}`,
    scheduleId: 'checkin-daily-wellbeing',
    scheduleTitle: 'Daily wellbeing check-in',
    focus: 'general' as const,
    prompt: 'How are you feeling today? Is anything better, worse, or different?',
    response,
    metrics: { ...metrics, medicationExperience },
    createdAt: atDaysAgo(daysAgo),
    demo: true,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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

function readResponses() {
  if (typeof window === 'undefined') return seedResponses()
  try {
    const current = JSON.parse(window.localStorage.getItem(RESPONSE_KEY) || 'null')
    if (Array.isArray(current)) return current as CheckInResponse[]
    const legacy = JSON.parse(window.localStorage.getItem('vital-check-in-responses-v1') || 'null')
    if (Array.isArray(legacy) && legacy.length) {
      return legacy.map((item) => ({ ...item, metrics: { ...defaultCheckInMetrics } })) as CheckInResponse[]
    }
    return seedResponses()
  } catch {
    return seedResponses()
  }
}

function readContact() {
  if (typeof window === 'undefined') return defaultContact
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONTACT_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? { ...defaultContact, ...parsed } as MockContact : defaultContact
  } catch {
    return defaultContact
  }
}

function notificationState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

function createMockDelivery(schedule: CheckInSchedule, channel: MockDeliveryChannel, destination: string, occurrenceKey: string): MockDelivery {
  const isEmail = channel === 'mock_email'
  return {
    id: `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurrenceKey,
    scheduleId: schedule.id,
    scheduleTitle: schedule.title,
    channel,
    destination,
    subject: isEmail ? `Vital Passport check-in: ${schedule.title}` : 'Vital Passport check-in',
    body: isEmail
      ? `${schedule.prompt}\n\nOpen Vital Passport to answer by voice or text. Your response will go to Health Inbox for review before it changes your confirmed record.`
      : `Vital Passport: ${schedule.prompt} Open the app to answer. This is a simulated demo text.`,
    createdAt: new Date().toISOString(),
    status: 'simulated_sent',
  }
}

function metricSummary(metrics: CheckInMetrics) {
  const medication = metrics.medicationExperience === 'not_applicable' ? '' : ` · Medication ${metrics.medicationExperience.replace('_', ' ')}`
  return `Mood ${metrics.mood}/10 · Energy ${metrics.energy}/10 · Sleep ${metrics.sleep}/10 · Pain ${metrics.pain}/10 · Stress ${metrics.stress}/10 · Symptom severity ${metrics.symptomSeverity}/10${medication}`
}

const CheckInContext = createContext<CheckInContextValue | undefined>(undefined)

export function CheckInProvider({ children }: { children: ReactNode }) {
  const { queueExtractionFindings } = useHealthInbox()
  const [schedules, setSchedules] = useState<CheckInSchedule[]>(() => readArray(STORAGE_KEY, seedSchedules()))
  const [responses, setResponses] = useState<CheckInResponse[]>(readResponses)
  const [deliveries, setDeliveries] = useState<MockDelivery[]>(() => readArray(DELIVERY_KEY, []))
  const [mockContact, setMockContactState] = useState<MockContact>(readContact)
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(notificationState)

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules)) }, [schedules])
  useEffect(() => { window.localStorage.setItem(RESPONSE_KEY, JSON.stringify(responses.slice(0, 120))) }, [responses])
  useEffect(() => { window.localStorage.setItem(DELIVERY_KEY, JSON.stringify(deliveries.slice(0, 100))) }, [deliveries])
  useEffect(() => { window.localStorage.setItem(CONTACT_KEY, JSON.stringify(mockContact)) }, [mockContact])

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
    const notification = new Notification('Vital Passport check-in', { body: schedule.prompt, tag: `vital-checkin-${schedule.id}` })
    notification.onclick = () => {
      window.focus()
      setActiveScheduleId(schedule.id)
      notification.close()
    }
    setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, lastNotifiedFor: schedule.nextDueAt } : item))
  }, [dueSchedules, notificationPermission])

  useEffect(() => {
    const additions: MockDelivery[] = []
    dueSchedules.forEach((schedule) => {
      schedule.channels.forEach((channel) => {
        if (channel !== 'mock_email' && channel !== 'mock_sms') return
        const occurrenceKey = `${schedule.id}:${schedule.nextDueAt}:${channel}`
        const alreadyLogged = deliveries.some((delivery) => delivery.occurrenceKey === occurrenceKey)
          || additions.some((delivery) => delivery.occurrenceKey === occurrenceKey)
        if (alreadyLogged) return
        const destination = channel === 'mock_email' ? mockContact.email : mockContact.phone
        additions.push(createMockDelivery(schedule, channel, destination, occurrenceKey))
      })
    })
    if (additions.length) setDeliveries((current) => [...additions, ...current].slice(0, 100))
  }, [dueSchedules, deliveries, mockContact])

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

  const completeCheckIn = ({ response: rawResponse, metrics: rawMetrics }: CheckInSubmission) => {
    if (!activeSchedule) return
    const response = rawResponse.trim()
    const metrics: CheckInMetrics = {
      mood: clampScore(rawMetrics.mood),
      energy: clampScore(rawMetrics.energy),
      sleep: clampScore(rawMetrics.sleep),
      pain: clampScore(rawMetrics.pain),
      stress: clampScore(rawMetrics.stress),
      symptomSeverity: clampScore(rawMetrics.symptomSeverity),
      medicationExperience: rawMetrics.medicationExperience,
    }
    const createdAt = new Date().toISOString()
    const itemId = `checkin-${activeSchedule.id}-${Date.now()}`
    const summary = [metricSummary(metrics), response].filter(Boolean).join('. ')
    const extraction: HealthExtraction = {
      document_type: 'symptom_note',
      title: `${activeSchedule.title} response`,
      summary,
      event_date: createdAt.slice(0, 10),
      facility: 'Patient scheduled check-in',
      medications: [],
      lab_results: [],
      diagnoses: [],
      instructions: [],
      symptoms: response ? [response] : [],
      follow_up: '',
      evidence: [{ field: 'Patient check-in', value: summary, quote: summary, confidence: 1 }],
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
      summary,
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
      metrics,
      createdAt,
    }, ...current].slice(0, 120))
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

  const setMockContact = (patch: Partial<MockContact>) => setMockContactState((current) => ({ ...current, ...patch }))

  const sendMockReminder = (scheduleId: string, channel: MockDeliveryChannel) => {
    const schedule = schedules.find((item) => item.id === scheduleId)
    if (!schedule) return
    const destination = channel === 'mock_email' ? mockContact.email : mockContact.phone
    const occurrenceKey = `manual:${schedule.id}:${channel}:${Date.now()}`
    setDeliveries((current) => [createMockDelivery(schedule, channel, destination, occurrenceKey), ...current].slice(0, 100))
  }

  const resetCheckIns = () => {
    setSchedules(seedSchedules())
    setResponses(seedResponses())
    setDeliveries([])
    setMockContactState(defaultContact)
    setActiveScheduleId(null)
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(RESPONSE_KEY)
    window.localStorage.removeItem('vital-check-in-responses-v1')
    window.localStorage.removeItem(DELIVERY_KEY)
    window.localStorage.removeItem(CONTACT_KEY)
  }

  return <CheckInContext.Provider value={{
    schedules,
    responses,
    deliveries,
    activeSchedule,
    nextSchedule,
    dueCount: dueSchedules.length,
    notificationPermission,
    mockEmail: mockContact.email,
    mockPhone: mockContact.phone,
    addSchedule,
    updateSchedule,
    removeSchedule,
    startCheckIn,
    snoozeActive,
    completeCheckIn,
    requestBrowserNotifications,
    setMockContact,
    sendMockReminder,
    resetCheckIns,
  }}>{children}</CheckInContext.Provider>
}

export function useCheckIns() {
  const context = useContext(CheckInContext)
  if (!context) throw new Error('useCheckIns must be used within CheckInProvider')
  return context
}
