import {
  patient,
  seedCareTasks,
  seedLabResults,
  seedReconciliationIssues,
  sources as demoSources,
  timeline as demoTimeline,
} from '../data/demo'
import { calculatePatientAge, readStoredPatientProfile, type PatientProfile } from './patientProfile'
import type {
  CareTask,
  ClinicalLabResult,
  InterviewAnswers,
  MedicationSummary,
  ReconciliationIssue,
  SharedBriefPacket,
  SourceRecord,
  TimelineEvent,
} from '../types'

interface BuildSharedBriefPacketInput {
  profile?: PatientProfile
  answers: InterviewAnswers
  readiness: number
  openGapCount: number
  resolvedCount: number
  openReconciliationCount: number
  medicationSummaries: MedicationSummary[]
  labResults: ClinicalLabResult[]
  reconciliationIssues: ReconciliationIssue[]
  careTasks: CareTask[]
  sources: SourceRecord[]
  timelineEvents: TimelineEvent[]
}

function parsePriorities(value: string) {
  return value
    .split(/\n|\?\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.endsWith('?') ? item : `${item}?`)
    .slice(0, 3)
}

function latestLabs(results: ClinicalLabResult[]) {
  const latest = new Map<string, ClinicalLabResult>()
  ;[...results]
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    .forEach((result) => {
      if (!latest.has(result.canonicalTest)) latest.set(result.canonicalTest, result)
    })

  return [...latest.values()]
    .sort((a, b) => {
      const aAbnormal = a.abnormalFlag && !/normal|within|negative/i.test(a.abnormalFlag) ? 1 : 0
      const bAbnormal = b.abnormalFlag && !/normal|within|negative/i.test(b.abnormalFlag) ? 1 : 0
      return bAbnormal - aAbnormal
    })
    .slice(0, 6)
}

function sourceSubset(allSources: SourceRecord[], sourceIds: Set<string>) {
  return allSources
    .filter((source) => sourceIds.has(source.id))
    .map((source) => ({
      ...source,
      details: source.details.slice(0, 20),
      excerpt: source.excerpt.slice(0, 1200),
    }))
}

function confirmedSignalTimeline(): TimelineEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const snapshot = JSON.parse(window.localStorage.getItem('vital-health-signals-v1') || '{}') as {
      signals?: Array<{ id: string; title: string; detail: string; detectedAt: string; status: string }>
    }
    return (snapshot.signals || [])
      .filter((signal) => signal.status === 'confirmed' || signal.status === 'edited')
      .map((signal) => {
        const date = signal.detectedAt.slice(0, 10)
        return {
          id: `confirmed-health-signal-${signal.id}`,
          date,
          displayDate: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)),
          category: 'symptoms' as const,
          title: `Patient-confirmed trend: ${signal.title}`,
          summary: `${signal.detail} This pattern was confirmed by the patient after Health Inbox review.`,
          sourceLabel: 'Structured check-ins · patient confirmed',
          sourceType: 'patient' as const,
        }
      })
  } catch {
    return []
  }
}

export function buildSharedBriefPacket(input: BuildSharedBriefPacketInput): SharedBriefPacket {
  const profile = input.profile || readStoredPatientProfile()
  const selectedTimeline = [...input.timelineEvents, ...confirmedSignalTimeline()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10)
  const labs = latestLabs(input.labResults)
  const sourceIds = new Set<string>()

  selectedTimeline.forEach((event) => event.sourceId && sourceIds.add(event.sourceId))
  labs.forEach((lab) => sourceIds.add(lab.sourceId))
  input.medicationSummaries.forEach((medication) => medication.sourceIds.forEach((sourceId) => sourceIds.add(sourceId)))
  input.reconciliationIssues.forEach((issue) => issue.sources.forEach((source) => sourceIds.add(source.sourceId)))
  input.careTasks.forEach((task) => task.sourceId && sourceIds.add(task.sourceId))

  const latestEvent = selectedTimeline[selectedTimeline.length - 1]
  const reason = latestEvent?.summary || (input.sources.length ? `${input.sources.length} patient-confirmed ${input.sources.length === 1 ? 'source has' : 'sources have'} been organized for clinical review.` : 'No confirmed health information has been added yet.')

  return {
    schemaVersion: 1,
    preparedAt: new Date().toISOString(),
    patient: {
      name: profile.name || 'Patient profile incomplete',
      age: calculatePatientAge(profile.dob) || 0,
      dob: profile.dob,
      pronouns: profile.pronouns,
      conditions: [...profile.conditions],
      allergies: [...profile.allergies],
    },
    visit: {
      label: 'Patient-controlled clinical handoff',
      reason,
    },
    readiness: {
      percent: input.readiness,
      interviewConfirmed: input.resolvedCount,
      interviewTotal: 4,
      openInterviewGaps: input.openGapCount,
      openReconciliationCount: input.openReconciliationCount,
    },
    priorities: parsePriorities(input.answers.priorities),
    medications: input.medicationSummaries.map((medication) => ({
      name: medication.name,
      strength: medication.strength,
      directions: medication.directions,
      status: medication.status,
      sourceCount: medication.sourceCount,
    })),
    labs: labs.map((lab) => ({
      test: lab.test,
      value: lab.value,
      unit: lab.unit,
      abnormalFlag: lab.abnormalFlag,
      eventDate: lab.eventDate,
      trend: lab.trend,
      sourceId: lab.sourceId,
    })),
    reconciliation: input.reconciliationIssues.map((issue) => ({
      title: issue.title,
      status: issue.status,
      detail: issue.detail,
      resolution: issue.resolution,
      sources: issue.sources.map((source) => ({
        label: source.label,
        value: source.value,
        sourceId: source.sourceId,
      })),
    })),
    timeline: selectedTimeline,
    openTasks: input.careTasks
      .filter((task) => task.status === 'open')
      .slice(0, 8)
      .map(({ title, detail, dueLabel }) => ({ title, detail, dueLabel })),
    sources: sourceSubset(input.sources, sourceIds),
    disclaimer: 'This patient-controlled summary organizes patient-provided and documented information. Verify important details against original records before clinical use.',
  }
}

export const demoSharedBriefPacket: SharedBriefPacket = {
  schemaVersion: 1,
  preparedAt: '2026-07-14T22:00:00.000Z',
  patient: {
    name: patient.name,
    age: patient.age,
    dob: patient.dob,
    pronouns: patient.pronouns,
    conditions: [...patient.conditions],
    allergies: [...patient.allergies],
  },
  visit: {
    label: 'Primary care with Dr. Jordan Kim · July 18, 2026',
    reason: 'Dizziness and fatigue beginning around June 20, with a possible temporal overlap with a metoprolol dose change.',
  },
  readiness: {
    percent: 68,
    interviewConfirmed: 0,
    interviewTotal: 4,
    openInterviewGaps: 4,
    openReconciliationCount: 1,
  },
  priorities: [
    'Could my medication be contributing to the dizziness?',
    'Do I need additional testing?',
    'What symptoms should make me seek urgent care?',
  ],
  medications: [
    { name: 'Lisinopril', strength: '10 mg', directions: 'Once daily', status: 'confirmed', sourceCount: 1 },
    { name: 'Metformin', strength: '500 mg', directions: 'Twice daily', status: 'confirmed', sourceCount: 1 },
    { name: 'Metoprolol', strength: '25 mg twice daily vs 50 mg every morning', directions: 'Patient confirmation needed', status: 'conflict', sourceCount: 2 },
  ],
  labs: seedLabResults.map((lab) => ({
    test: lab.test,
    value: lab.value,
    unit: lab.unit,
    abnormalFlag: lab.abnormalFlag,
    eventDate: lab.eventDate,
    trend: lab.trend,
    sourceId: lab.sourceId,
  })),
  reconciliation: seedReconciliationIssues.map((issue) => ({
    title: issue.title,
    status: issue.status,
    detail: issue.detail,
    resolution: issue.resolution,
    sources: issue.sources.map((source) => ({ label: source.label, value: source.value, sourceId: source.sourceId })),
  })),
  timeline: demoTimeline.slice(0, 7),
  openTasks: seedCareTasks.map(({ title, detail, dueLabel }) => ({ title, detail, dueLabel })),
  sources: demoSources,
  disclaimer: 'Synthetic demonstration only. This patient-controlled summary organizes patient-provided and documented information.',
}
