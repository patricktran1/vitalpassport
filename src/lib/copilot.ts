import type { CopilotMemoryItem } from '../context/CopilotMemoryContext'
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
  memories: CopilotMemoryItem[]
}

type InboxSnapshotFinding = {
  id: string
  kind: string
  title: string
  detail: string
  proposedValue: string
  finalValue?: string
  sourceId: string
  sourceLabel: string
  sourceQuote: string
  status: string
  reviewedAt?: string
  receipt?: { summary: string; changes: string[] }
}

type HealthSignalsSnapshot = {
  updatedAt?: string
  signals?: Array<{
    id: string
    title: string
    detail: string
    evidence: string[]
    severity: string
    metric?: string
    detectedAt: string
    status: string
  }>
  trends?: Record<string, Array<{
    key: string
    label: string
    current: number | null
    previous: number | null
    delta: number
    direction: string
    values: Array<{ date: string; value: number }>
  }>>
  recentResponses?: Array<{
    id: string
    response: string
    createdAt: string
    metrics: Record<string, string | number>
  }>
}

function readHealthInbox() {
  if (typeof window === 'undefined') return { pending: [] as InboxSnapshotFinding[], recentlyReviewed: [] as InboxSnapshotFinding[] }
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem('vital-health-inbox-v1') || '[]') as InboxSnapshotFinding[]
    if (!Array.isArray(parsed)) return { pending: [], recentlyReviewed: [] }
    const pending = parsed.filter((finding) => finding.status === 'pending').slice(0, 30)
    const recentlyReviewed = parsed
      .filter((finding) => finding.status !== 'pending')
      .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
      .slice(0, 20)
    return { pending, recentlyReviewed }
  } catch {
    return { pending: [], recentlyReviewed: [] }
  }
}

function readHealthSignals(): HealthSignalsSnapshot {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem('vital-health-signals-v1') || '{}')
    return parsed && typeof parsed === 'object' ? parsed as HealthSignalsSnapshot : {}
  } catch {
    return {}
  }
}

export function buildHealthRecordSnapshot(input: HealthRecordSnapshotInput) {
  const inbox = readHealthInbox()
  const healthSignals = readHealthSignals()
  const activeMemories = input.memories.filter((memory) => !memory.forgottenAt).slice(0, 40)
  const confirmedSignals = (healthSignals.signals || []).filter((signal) => signal.status === 'confirmed' || signal.status === 'edited')
  const pendingSignals = (healthSignals.signals || []).filter((signal) => signal.status === 'pending' || signal.status === 'not_queued')
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
      pending_health_inbox_count: inbox.pending.length,
      recently_reviewed_health_inbox_count: inbox.recentlyReviewed.length,
      patient_controlled_memory_count: activeMemories.length,
      structured_check_in_count: healthSignals.recentResponses?.length || 0,
      pending_health_signal_count: pendingSignals.length,
      confirmed_health_signal_count: confirmedSignals.length,
    },
    patient_controlled_memory: activeMemories.map((memory) => ({
      id: memory.id,
      type: memory.kind,
      title: memory.title,
      value: memory.value,
      origin: memory.origin,
      source_id: memory.sourceId || null,
      updated_at: memory.updatedAt,
      evidence_boundary: memory.sourceId
        ? 'Patient-controlled context linked to a source. Verify the source before treating it as a medical fact.'
        : 'Patient-controlled context only. This is not source evidence or a confirmed clinical fact.',
    })),
    check_in_trends: {
      updated_at: healthSignals.updatedAt || null,
      seven_day: healthSignals.trends?.['7d'] || [],
      thirty_day: healthSignals.trends?.['30d'] || [],
      recent_responses: (healthSignals.recentResponses || []).slice(0, 20),
      interpretation_boundary: 'Scores are patient reported. Trends describe direction only and do not diagnose a condition or establish causation.',
    },
    health_signals: {
      pending_review: pendingSignals,
      patient_confirmed: confirmedSignals,
      other_reviewed: (healthSignals.signals || []).filter((signal) => !['pending', 'not_queued', 'confirmed', 'edited'].includes(signal.status)),
      interpretation_boundary: 'Signals come from deterministic local rules. Pending signals are not part of the patient-confirmed record.',
    },
    health_inbox: {
      pending: inbox.pending.map((finding) => ({
        id: finding.id,
        classification: finding.kind,
        title: finding.title,
        detail: finding.detail,
        proposed_value: finding.proposedValue,
        source_id: finding.sourceId,
        source_label: finding.sourceLabel,
        source_quote: finding.sourceQuote,
      })),
      recently_reviewed: inbox.recentlyReviewed.map((finding) => ({
        id: finding.id,
        classification: finding.kind,
        title: finding.title,
        decision: finding.status,
        final_value: finding.finalValue || finding.proposedValue,
        receipt: finding.receipt,
        source_id: finding.sourceId,
        source_label: finding.sourceLabel,
        source_quote: finding.sourceQuote,
        reviewed_at: finding.reviewedAt,
      })),
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
