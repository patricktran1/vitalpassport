import { patient } from '../data/demo'
import type { CareTask, ClinicalLabResult, MedicationSummary, ReconciliationIssue, SourceRecord, TimelineEvent } from '../types'

export type CopilotSignalKind = 'change' | 'attention' | 'gap' | 'context'

export interface CopilotCitation {
  source_id: string
  label: string
  quote: string
}

export interface CopilotSignal {
  kind: CopilotSignalKind
  title: string
  detail: string
}

export interface CopilotNextStep {
  label: string
  detail: string
  route: string
}

export interface CopilotResult {
  headline: string
  answer: string
  record_status: 'grounded' | 'limited'
  citations: CopilotCitation[]
  signals: CopilotSignal[]
  next_steps: CopilotNextStep[]
  follow_up_prompts: string[]
  model?: string
}

export interface HealthRecordSnapshotInput {
  sources: SourceRecord[]
  timelineEvents: TimelineEvent[]
  medicationSummaries: MedicationSummary[]
  labResults: ClinicalLabResult[]
  reconciliationIssues: ReconciliationIssue[]
  careTasks: CareTask[]
  reviewGaps: Array<{ label: string; detail: string; source: string; resolved: boolean }>
}

export function buildHealthRecordSnapshot(input: HealthRecordSnapshotInput) {
  return {
    patient: {
      name: patient.name,
      date_of_birth: patient.dob,
      conditions: patient.conditions,
      allergies: patient.allergies,
    },
    summary: {
      source_count: input.sources.length,
      medication_count: input.medicationSummaries.length,
      open_conflict_count: input.reconciliationIssues.filter((issue) => issue.status === 'open').length,
      open_task_count: input.careTasks.filter((task) => task.status === 'open').length,
      unresolved_history_gap_count: input.reviewGaps.filter((gap) => !gap.resolved).length,
    },
    medications: input.medicationSummaries.slice(0, 30),
    laboratory_results: input.labResults.slice(0, 40),
    reconciliation_issues: input.reconciliationIssues.slice(0, 20),
    open_tasks: input.careTasks.filter((task) => task.status === 'open').slice(0, 30),
    history_gaps: input.reviewGaps.filter((gap) => !gap.resolved),
    timeline: [...input.timelineEvents].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    sources: input.sources.slice(0, 40).map((source) => ({
      id: source.id,
      title: source.title,
      subtitle: source.subtitle,
      date: source.date,
      type: source.type,
      excerpt: source.excerpt,
      details: source.details.slice(0, 20),
    })),
  }
}

export async function askHealthCopilot(question: string, record: ReturnType<typeof buildHealthRecordSnapshot>) {
  const response = await fetch('/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, record }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || 'Health Copilot could not answer that question.')
  }
  return payload.result as CopilotResult
}
