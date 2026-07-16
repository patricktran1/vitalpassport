import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useCheckIns, type CheckInMetricKey, type CheckInResponse, type CheckInSchedule } from './CheckInContext'
import { useHealthInbox, type HealthInboxStatus } from './HealthInboxContext'
import { useVital } from './VitalContext'
import type { HealthExtraction, TimelineEvent, UploadItem } from '../types'

export type SignalSeverity = 'watch' | 'attention'
export type TrendDirection = 'improving' | 'stable' | 'worsening' | 'insufficient'
export type TrendWindow = '7d' | '30d'

export interface MetricTrend {
  key: CheckInMetricKey
  label: string
  current: number | null
  previous: number | null
  delta: number
  direction: TrendDirection
  favorableHigh: boolean
  values: Array<{ date: string; value: number }>
}

export interface HealthSignal {
  id: string
  title: string
  detail: string
  evidence: string[]
  severity: SignalSeverity
  metric?: CheckInMetricKey
  detectedAt: string
  status: HealthInboxStatus | 'not_queued'
  findingId: string
}

interface HealthSignalsContextValue {
  signals: HealthSignal[]
  pendingSignals: HealthSignal[]
  confirmedSignals: HealthSignal[]
  trends: Record<TrendWindow, MetricTrend[]>
  structuredResponses: CheckInResponse[]
  pendingSignalCount: number
}

const SNAPSHOT_KEY = 'vital-health-signals-v1'
const metricDefinitions: Array<{ key: CheckInMetricKey; label: string; favorableHigh: boolean }> = [
  { key: 'mood', label: 'Mood', favorableHigh: true },
  { key: 'energy', label: 'Energy', favorableHigh: true },
  { key: 'sleep', label: 'Sleep quality', favorableHigh: true },
  { key: 'pain', label: 'Pain', favorableHigh: false },
  { key: 'stress', label: 'Stress', favorableHigh: false },
  { key: 'symptomSeverity', label: 'Symptom severity', favorableHigh: false },
]

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const roundOne = (value: number) => Math.round(value * 10) / 10
const signalFindingId = (signalId: string) => `inbox-signal-${signalId}-fact`

function structured(responses: CheckInResponse[]) {
  return responses
    .filter((response) => response.metrics && Number.isFinite(response.metrics.mood))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function buildTrends(responses: CheckInResponse[], days: number): MetricTrend[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const inWindow = structured(responses).filter((response) => new Date(response.createdAt).getTime() >= cutoff)
  return metricDefinitions.map((definition) => {
    const values = inWindow.map((response) => ({ date: response.createdAt, value: response.metrics[definition.key] }))
    if (values.length < 2) return { ...definition, current: values[0]?.value ?? null, previous: null, delta: 0, direction: 'insufficient' as const, values }
    const split = Math.max(1, Math.floor(values.length / 2))
    const previousValues = values.slice(0, split).map((point) => point.value)
    const currentValues = values.slice(split).map((point) => point.value)
    const previous = roundOne(average(previousValues))
    const current = roundOne(average(currentValues.length ? currentValues : previousValues))
    const delta = roundOne(current - previous)
    let direction: TrendDirection = 'stable'
    if (Math.abs(delta) >= 0.75) {
      const favorable = definition.favorableHigh ? delta > 0 : delta < 0
      direction = favorable ? 'improving' : 'worsening'
    }
    return { ...definition, current, previous, delta, direction, values }
  })
}

function countExpected(schedule: CheckInSchedule, start: Date, end: Date) {
  let count = 0
  const cursor = new Date(start)
  cursor.setHours(12, 0, 0, 0)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (schedule.cadence === 'daily' || (schedule.cadence === 'weekdays' && day >= 1 && day <= 5) || (schedule.cadence === 'weekly' && day === schedule.weekday)) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

function latestMedicationEvent(timeline: TimelineEvent[]) {
  return [...timeline].filter((event) => event.category === 'medications').sort((a, b) => b.date.localeCompare(a.date))[0]
}

function detectSignals(responses: CheckInResponse[], schedules: CheckInSchedule[], timeline: TimelineEvent[]): Omit<HealthSignal, 'status' | 'findingId'>[] {
  const ordered = structured(responses)
  const latest = ordered[ordered.length - 1]
  if (!latest) return []
  const detectedAt = latest.createdAt
  const signals: Omit<HealthSignal, 'status' | 'findingId'>[] = []

  const lastFour = ordered.slice(-4)
  if (lastFour.length === 4 && lastFour[3].metrics.sleep <= lastFour[0].metrics.sleep - 2) {
    signals.push({
      id: 'sleep-decline',
      title: 'Sleep quality has declined across recent check-ins',
      detail: `Sleep moved from ${lastFour[0].metrics.sleep}/10 to ${lastFour[3].metrics.sleep}/10 across four recorded check-ins. This describes the patient-reported pattern without identifying a cause.`,
      evidence: lastFour.map((response) => `${new Date(response.createdAt).toLocaleDateString()}: sleep ${response.metrics.sleep}/10`),
      severity: 'attention',
      metric: 'sleep',
      detectedAt,
    })
  }

  const lastThree = ordered.slice(-3)
  if (lastThree.length === 3 && lastThree[2].metrics.symptomSeverity >= lastThree[0].metrics.symptomSeverity + 2) {
    signals.push({
      id: 'symptom-worsening',
      title: 'Reported symptom severity has increased',
      detail: `Symptom severity rose from ${lastThree[0].metrics.symptomSeverity}/10 to ${lastThree[2].metrics.symptomSeverity}/10 across the three latest check-ins.`,
      evidence: lastThree.map((response) => `${new Date(response.createdAt).toLocaleDateString()}: symptoms ${response.metrics.symptomSeverity}/10`),
      severity: 'attention',
      metric: 'symptomSeverity',
      detectedAt,
    })
  }

  const lastTwo = ordered.slice(-2)
  if (lastTwo.length === 2 && average(lastTwo.map((response) => response.metrics.stress)) >= 8) {
    signals.push({
      id: 'high-stress',
      title: 'Stress has remained high in the latest check-ins',
      detail: `The two latest stress scores average ${roundOne(average(lastTwo.map((response) => response.metrics.stress)))}/10.`,
      evidence: lastTwo.map((response) => `${new Date(response.createdAt).toLocaleDateString()}: stress ${response.metrics.stress}/10`),
      severity: 'watch',
      metric: 'stress',
      detectedAt,
    })
  }

  if (latest.metrics.medicationExperience === 'worse' || latest.metrics.medicationExperience === 'side_effects') {
    signals.push({
      id: 'medication-experience',
      title: latest.metrics.medicationExperience === 'side_effects' ? 'Possible medication side effects were reported' : 'Medication experience was reported as worse',
      detail: 'This is a patient-reported experience, not a determination that a medication caused the symptoms. Medication changes should be reviewed with a clinician.',
      evidence: [`${new Date(latest.createdAt).toLocaleDateString()}: medication experience marked ${latest.metrics.medicationExperience.replace('_', ' ')}`, latest.response || 'No additional narrative was entered.'],
      severity: 'attention',
      detectedAt,
    })
  }

  const windowEnd = new Date()
  const windowStart = new Date(windowEnd)
  windowStart.setDate(windowEnd.getDate() - 9)
  schedules.filter((schedule) => schedule.enabled).forEach((schedule) => {
    const expected = countExpected(schedule, windowStart, windowEnd)
    const completed = ordered.filter((response) => response.scheduleId === schedule.id && new Date(response.createdAt) >= windowStart).length
    const missed = Math.max(0, expected - completed)
    if (missed >= 3) {
      signals.push({
        id: `missed-${schedule.id}`,
        title: `${missed} scheduled check-ins may have been missed`,
        detail: `${schedule.title} had ${expected} expected opportunities and ${completed} recorded responses in the last 10 days. This may reflect skipped check-ins, paused app use, or incomplete local history.`,
        evidence: [`Expected occurrences: ${expected}`, `Recorded responses: ${completed}`, `Difference: ${missed}`],
        severity: 'watch',
        detectedAt,
      })
    }
  })

  const medicationEvent = latestMedicationEvent(timeline)
  if (medicationEvent) {
    const eventTime = new Date(`${medicationEvent.date}T12:00:00`).getTime()
    const before = ordered.filter((response) => {
      const time = new Date(response.createdAt).getTime()
      return time < eventTime && time >= eventTime - 14 * 24 * 60 * 60 * 1000
    })
    const after = ordered.filter((response) => {
      const time = new Date(response.createdAt).getTime()
      return time >= eventTime && time <= eventTime + 14 * 24 * 60 * 60 * 1000
    })
    if (before.length >= 2 && after.length >= 2) {
      const beforeAverage = roundOne(average(before.map((response) => response.metrics.symptomSeverity)))
      const afterAverage = roundOne(average(after.map((response) => response.metrics.symptomSeverity)))
      if (afterAverage >= beforeAverage + 1.5) {
        signals.push({
          id: `timing-overlap-${medicationEvent.id}`,
          title: 'Symptom scores increased after a recorded medication event',
          detail: `Average symptom severity was ${beforeAverage}/10 before and ${afterAverage}/10 after “${medicationEvent.title}.” The timing overlaps, but the record does not establish that the medication event caused the change.`,
          evidence: [`Medication timeline event: ${medicationEvent.displayDate} · ${medicationEvent.title}`, `Before average: ${beforeAverage}/10`, `After average: ${afterAverage}/10`],
          severity: 'attention',
          metric: 'symptomSeverity',
          detectedAt,
        })
      }
    }
  }

  return signals
}

function signalUpload(signal: Omit<HealthSignal, 'status' | 'findingId'>): UploadItem {
  const summary = `${signal.detail} Evidence: ${signal.evidence.join(' | ')}`
  const extraction: HealthExtraction = {
    document_type: 'symptom_note',
    title: signal.title,
    summary,
    event_date: signal.detectedAt.slice(0, 10),
    facility: 'Vital Passport deterministic signal engine',
    medications: [],
    lab_results: [],
    diagnoses: [],
    instructions: [],
    symptoms: [],
    follow_up: '',
    evidence: [{ field: 'Deterministic trend rule', value: signal.title, quote: signal.evidence.join(' | '), confidence: 1 }],
    warnings: ['Trend signal requires patient review before inclusion in the confirmed record.'],
    requires_confirmation: true,
    confidence: 1,
    mode: 'demo',
  }
  return {
    id: `signal-${signal.id}`,
    name: signal.title,
    type: 'symptom',
    date: 'Today',
    status: 'ready',
    summary,
    extraction,
  }
}

const HealthSignalsContext = createContext<HealthSignalsContextValue | undefined>(undefined)

export function HealthSignalsProvider({ children }: { children: ReactNode }) {
  const { responses, schedules } = useCheckIns()
  const { findings, queueExtractionFindings } = useHealthInbox()
  const { timelineEvents } = useVital()

  const structuredResponses = useMemo(() => structured(responses).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [responses])
  const trends = useMemo<Record<TrendWindow, MetricTrend[]>>(() => ({
    '7d': buildTrends(responses, 7),
    '30d': buildTrends(responses, 30),
  }), [responses])
  const detected = useMemo(() => detectSignals(responses, schedules, timelineEvents), [responses, schedules, timelineEvents])

  useEffect(() => {
    detected.forEach((signal) => {
      if (!findings.some((finding) => finding.id === signalFindingId(signal.id))) queueExtractionFindings(signalUpload(signal))
    })
  }, [detected, findings, queueExtractionFindings])

  const signals = useMemo<HealthSignal[]>(() => detected.map((signal) => {
    const findingId = signalFindingId(signal.id)
    const finding = findings.find((item) => item.id === findingId)
    return { ...signal, findingId, status: finding?.status || 'not_queued' }
  }), [detected, findings])

  const pendingSignals = useMemo(() => signals.filter((signal) => signal.status === 'pending' || signal.status === 'not_queued'), [signals])
  const confirmedSignals = useMemo(() => signals.filter((signal) => signal.status === 'confirmed' || signal.status === 'edited'), [signals])

  useEffect(() => {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      updatedAt: new Date().toISOString(),
      signals,
      trends,
      recentResponses: structuredResponses.slice(0, 30),
    }))
  }, [signals, trends, structuredResponses])

  return <HealthSignalsContext.Provider value={{
    signals,
    pendingSignals,
    confirmedSignals,
    trends,
    structuredResponses,
    pendingSignalCount: pendingSignals.length,
  }}>{children}</HealthSignalsContext.Provider>
}

export function useHealthSignals() {
  const context = useContext(HealthSignalsContext)
  if (!context) throw new Error('useHealthSignals must be used within HealthSignalsProvider')
  return context
}
