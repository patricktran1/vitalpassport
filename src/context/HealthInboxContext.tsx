import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useVital } from './VitalContext'
import type { HealthExtraction, SourceRecord, UploadItem } from '../types'

export type HealthInboxKind = 'new_fact' | 'change' | 'conflict' | 'missing_context' | 'suggested_action'
export type HealthInboxStatus = 'pending' | 'confirmed' | 'edited' | 'rejected' | 'unsure'
export type HealthInboxDecision = Exclude<HealthInboxStatus, 'pending'>

type HealthInboxEffect = 'resolve_metoprolol_bottle' | 'add_lab_priority' | 'confirm_symptom_improved' | 'record_review'

export interface HealthInboxReceipt {
  summary: string
  changes: string[]
}

export interface HealthInboxFinding {
  id: string
  kind: HealthInboxKind
  title: string
  detail: string
  proposedValue: string
  sourceId: string
  sourceLabel: string
  sourceQuote: string
  sourceSnapshot: SourceRecord
  createdAt: string
  status: HealthInboxStatus
  effect: HealthInboxEffect
  reviewedAt?: string
  finalValue?: string
  receipt?: HealthInboxReceipt
}

interface HealthInboxContextValue {
  findings: HealthInboxFinding[]
  pendingFindings: HealthInboxFinding[]
  reviewedFindings: HealthInboxFinding[]
  recentlyConfirmed: HealthInboxFinding[]
  pendingCount: number
  reviewFinding: (findingId: string, decision: HealthInboxDecision, editedValue?: string) => void
  reopenFinding: (findingId: string) => void
  queueExtractionFindings: (item: UploadItem) => number
  resetInbox: () => void
}

const STORAGE_KEY = 'vital-health-inbox-v1'

const symptomUpdateSource: SourceRecord = {
  id: 'src-symptom-update',
  title: 'Dizziness symptom update',
  subtitle: 'Patient entry · July 14, 2026',
  date: '2026-07-14',
  type: 'symptom',
  excerpt: 'My dizziness is better now, but I do not remember the exact day it started improving.',
  details: [
    { label: 'Change', value: 'Dizziness has improved', highlight: true },
    { label: 'Missing context', value: 'Exact improvement date is not known', highlight: true },
  ],
}

const seedFindings: HealthInboxFinding[] = [
  {
    id: 'inbox-metoprolol-change',
    kind: 'conflict',
    title: 'Metoprolol instructions may have changed',
    detail: 'The bottle label lists 50 mg extended release every morning, while the urgent care summary lists 25 mg twice daily.',
    proposedValue: 'Metoprolol succinate ER 50 mg, one tablet every morning',
    sourceId: 'src-bottle',
    sourceLabel: 'Metoprolol bottle photo',
    sourceQuote: 'METOPROLOL SUCCINATE ER 50 MG TABLET. Take one tablet by mouth every morning.',
    sourceSnapshot: {
      id: 'src-bottle',
      title: 'Metoprolol bottle photo',
      subtitle: 'Patient upload · July 10, 2026',
      date: '2026-07-10',
      type: 'medication',
      excerpt: 'METOPROLOL SUCCINATE ER 50 MG TABLET. Take one tablet by mouth every morning.',
      details: [
        { label: 'Medication', value: 'Metoprolol succinate ER' },
        { label: 'Dose', value: '50 mg', highlight: true },
        { label: 'Directions', value: 'Take one tablet every morning', highlight: true },
      ],
    },
    createdAt: '2026-07-14T16:05:00.000Z',
    status: 'pending',
    effect: 'resolve_metoprolol_bottle',
  },
  {
    id: 'inbox-low-hemoglobin-follow-up',
    kind: 'suggested_action',
    title: 'A flagged lab result has a follow-up action',
    detail: 'Hemoglobin was documented as low. Vital Passport can add this to the visit priorities without interpreting the cause.',
    proposedValue: 'Discuss hemoglobin 10.8 g/dL and the follow-up plan at the next visit',
    sourceId: 'src-labs',
    sourceLabel: 'Laboratory report',
    sourceQuote: 'Hemoglobin 10.8 g/dL (low).',
    sourceSnapshot: {
      id: 'src-labs',
      title: 'Laboratory report',
      subtitle: 'Bayview Medical Group · July 2, 2026',
      date: '2026-07-02',
      type: 'lab',
      excerpt: 'CBC and metabolic panel. Hemoglobin 10.8 g/dL (low). Glucose 168 mg/dL (high).',
      details: [
        { label: 'Hemoglobin', value: '10.8 g/dL · Low', highlight: true },
        { label: 'Recommended review', value: 'Discuss with the doctor at the next visit' },
      ],
    },
    createdAt: '2026-07-14T16:03:00.000Z',
    status: 'pending',
    effect: 'add_lab_priority',
  },
  {
    id: 'inbox-dizziness-improved-date',
    kind: 'missing_context',
    title: 'Dizziness improved, but the date is missing',
    detail: 'The symptom update supports improvement, but it does not identify the exact day the change occurred.',
    proposedValue: 'Dizziness has improved; exact improvement date is not known',
    sourceId: symptomUpdateSource.id,
    sourceLabel: symptomUpdateSource.title,
    sourceQuote: symptomUpdateSource.excerpt,
    sourceSnapshot: symptomUpdateSource,
    createdAt: '2026-07-14T16:01:00.000Z',
    status: 'pending',
    effect: 'confirm_symptom_improved',
  },
]

function readFindings() {
  if (typeof window === 'undefined') return seedFindings
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    return Array.isArray(parsed) ? parsed as HealthInboxFinding[] : seedFindings
  } catch {
    return seedFindings
  }
}

function displayDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Today'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed)
}

function sourceFromUpload(item: UploadItem, extraction: HealthExtraction): SourceRecord {
  const date = extraction.event_date && !/^today$/i.test(extraction.event_date)
    ? extraction.event_date
    : new Date().toISOString().slice(0, 10)
  return {
    id: `source-${item.id}`,
    title: extraction.title || item.name,
    subtitle: `${extraction.facility || 'Patient upload'} · ${displayDate(date)}`,
    date,
    type: item.type,
    excerpt: extraction.summary,
    details: [
      ...extraction.medications.map((medication) => ({ label: 'Medication', value: [medication.name, medication.strength, medication.directions].filter(Boolean).join(' · '), highlight: true })),
      ...extraction.lab_results.map((lab) => ({ label: lab.test || 'Lab result', value: [lab.value, lab.unit, lab.abnormal_flag].filter(Boolean).join(' · '), highlight: Boolean(lab.abnormal_flag && !/normal|within/i.test(lab.abnormal_flag)) })),
      ...extraction.symptoms.map((symptom) => ({ label: 'Symptom', value: symptom })),
      ...(extraction.follow_up ? [{ label: 'Follow-up', value: extraction.follow_up, highlight: true }] : []),
    ].slice(0, 20),
  }
}

const HealthInboxContext = createContext<HealthInboxContextValue | undefined>(undefined)

export function HealthInboxProvider({ children }: { children: ReactNode }) {
  const {
    answers,
    uploads,
    setAnswer,
    clinicalMedications,
    reconciliationIssues,
    resolveReconciliation,
  } = useVital()
  const [findings, setFindings] = useState<HealthInboxFinding[]>(readFindings)

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(findings))
  }, [findings])

  const reviewFinding = (findingId: string, decision: HealthInboxDecision, editedValue?: string) => {
    const finding = findings.find((item) => item.id === findingId)
    if (!finding) return

    const finalValue = (editedValue || finding.proposedValue).trim()
    const changes: string[] = []

    if (decision === 'confirmed' || decision === 'edited') {
      if (finding.effect === 'resolve_metoprolol_bottle') {
        const issue = reconciliationIssues.find((item) => item.id === 'issue-metoprolol' && item.status === 'open')
        const bottleRecord = clinicalMedications.find((medication) => medication.id === 'med-metoprolol-bottle')
        if (issue && bottleRecord) resolveReconciliation(issue.id, bottleRecord.id)
        changes.push('Medication summary updated', 'Reconciliation conflict resolved', 'Timeline and shareable brief refreshed')
      } else if (finding.effect === 'add_lab_priority') {
        const priority = finalValue.replace(/[.;]+$/, '')
        const nextPriorities = answers.priorities.toLowerCase().includes('hemoglobin')
          ? answers.priorities
          : [answers.priorities, priority].filter(Boolean).join('; ')
        setAnswer('priorities', nextPriorities)
        changes.push('Visit priorities updated', 'Existing lab follow-up task retained', 'Shareable brief and Copilot snapshot refreshed')
      } else if (finding.effect === 'confirm_symptom_improved') {
        setAnswer('timing', finalValue)
        changes.push('Symptom context updated without inventing a date', 'Visit preparation and shareable brief refreshed', 'Copilot snapshot refreshed')
      } else {
        changes.push('Patient confirmation attached to the source-supported finding', 'Copilot record snapshot refreshed')
      }
    } else if (decision === 'unsure') {
      changes.push('Uncertainty preserved', 'No structured health fact was changed', 'The item remains visible to Health Copilot')
    } else {
      changes.push('Finding excluded from the patient-confirmed record', 'Original source remains available in the audit trail')
    }

    const decisionLabel = decision === 'edited' ? 'Edited and confirmed' : decision === 'confirmed' ? 'Confirmed' : decision === 'rejected' ? 'Rejected' : 'Marked unsure'
    setFindings((current) => current.map((item) => item.id === findingId ? {
      ...item,
      status: decision,
      reviewedAt: new Date().toISOString(),
      finalValue,
      receipt: {
        summary: `${decisionLabel}: ${finalValue}`,
        changes,
      },
    } : item))
  }

  const reopenFinding = (findingId: string) => {
    setFindings((current) => current.map((item) => item.id === findingId ? {
      ...item,
      status: 'pending',
      reviewedAt: undefined,
      finalValue: undefined,
      receipt: undefined,
    } : item))
  }

  const queueExtractionFindings = (item: UploadItem) => {
    const extraction = item.extraction
    if (!extraction) return 0
    const sourceSnapshot = sourceFromUpload(item, extraction)
    const createdAt = new Date().toISOString()
    const queued: HealthInboxFinding[] = []

    extraction.medications.forEach((medication, index) => {
      const value = [medication.name, medication.strength, medication.directions].filter(Boolean).join(' · ')
      queued.push({
        id: `inbox-${item.id}-med-${index}`,
        kind: extraction.warnings.some((warning) => /conflict|different|discrep/i.test(warning)) ? 'conflict' : 'change',
        title: `Review ${medication.name || 'medication'} instructions`,
        detail: 'A medication detail was added from a new source. Confirm what the source says before relying on it as current.',
        proposedValue: value,
        sourceId: sourceSnapshot.id,
        sourceLabel: sourceSnapshot.title,
        sourceQuote: extraction.evidence.find((evidence) => `${evidence.field} ${evidence.value}`.toLowerCase().includes(medication.name.toLowerCase()))?.quote || extraction.summary,
        sourceSnapshot,
        createdAt,
        status: 'pending',
        effect: 'record_review',
      })
    })

    extraction.lab_results.filter((lab) => lab.abnormal_flag && !/normal|within|negative/i.test(lab.abnormal_flag)).forEach((lab, index) => {
      queued.push({
        id: `inbox-${item.id}-lab-${index}`,
        kind: 'suggested_action',
        title: `Review flagged ${lab.test || 'lab result'}`,
        detail: 'The source marked this result outside its stated reference range. Vital Passport is not interpreting the cause.',
        proposedValue: `Discuss ${[lab.test, lab.value, lab.unit, lab.abnormal_flag].filter(Boolean).join(' ')} with the doctor`,
        sourceId: sourceSnapshot.id,
        sourceLabel: sourceSnapshot.title,
        sourceQuote: extraction.evidence.find((evidence) => `${evidence.field} ${evidence.value}`.toLowerCase().includes((lab.test || '').toLowerCase()))?.quote || extraction.summary,
        sourceSnapshot,
        createdAt,
        status: 'pending',
        effect: 'record_review',
      })
    })

    if (extraction.follow_up) queued.push({
      id: `inbox-${item.id}-follow-up`,
      kind: 'suggested_action',
      title: 'Review documented follow-up',
      detail: 'A source contains a follow-up instruction that can be carried into the patient-controlled action list.',
      proposedValue: extraction.follow_up,
      sourceId: sourceSnapshot.id,
      sourceLabel: sourceSnapshot.title,
      sourceQuote: extraction.evidence.find((evidence) => /follow|instruction/i.test(evidence.field))?.quote || extraction.follow_up,
      sourceSnapshot,
      createdAt,
      status: 'pending',
      effect: 'record_review',
    })

    if (extraction.symptoms.length && (!extraction.event_date || /^today$/i.test(extraction.event_date))) queued.push({
      id: `inbox-${item.id}-symptom-context`,
      kind: 'missing_context',
      title: 'Symptom timing needs context',
      detail: 'The symptom is source-supported, but the event date is missing or only recorded as today.',
      proposedValue: extraction.symptoms.join('; '),
      sourceId: sourceSnapshot.id,
      sourceLabel: sourceSnapshot.title,
      sourceQuote: extraction.evidence[0]?.quote || extraction.summary,
      sourceSnapshot,
      createdAt,
      status: 'pending',
      effect: 'record_review',
    })

    if (!queued.length) queued.push({
      id: `inbox-${item.id}-fact`,
      kind: 'new_fact',
      title: `Review new information from ${sourceSnapshot.title}`,
      detail: 'The source was structured successfully. Confirm the summary or edit it before treating it as patient-confirmed context.',
      proposedValue: extraction.summary,
      sourceId: sourceSnapshot.id,
      sourceLabel: sourceSnapshot.title,
      sourceQuote: extraction.evidence[0]?.quote || extraction.summary,
      sourceSnapshot,
      createdAt,
      status: 'pending',
      effect: 'record_review',
    })

    setFindings((current) => {
      const queuedIds = new Set(queued.map((finding) => finding.id))
      return [...queued, ...current.filter((finding) => !queuedIds.has(finding.id))]
    })
    return queued.length
  }

  useEffect(() => {
    uploads.forEach((item) => {
      if (!item.extraction) return
      const prefix = `inbox-${item.id}-`
      if (!findings.some((finding) => finding.id.startsWith(prefix))) queueExtractionFindings(item)
    })
  }, [uploads, findings])

  const pendingFindings = useMemo(() => findings.filter((finding) => finding.status === 'pending'), [findings])
  const reviewedFindings = useMemo(() => findings.filter((finding) => finding.status !== 'pending').sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || '')), [findings])
  const recentlyConfirmed = useMemo(() => reviewedFindings.filter((finding) => finding.status === 'confirmed' || finding.status === 'edited').slice(0, 5), [reviewedFindings])

  const resetInbox = () => {
    setFindings(seedFindings)
    window.sessionStorage.removeItem(STORAGE_KEY)
  }

  return <HealthInboxContext.Provider value={{
    findings,
    pendingFindings,
    reviewedFindings,
    recentlyConfirmed,
    pendingCount: pendingFindings.length,
    reviewFinding,
    reopenFinding,
    queueExtractionFindings,
    resetInbox,
  }}>{children}</HealthInboxContext.Provider>
}

export function useHealthInbox() {
  const context = useContext(HealthInboxContext)
  if (!context) throw new Error('useHealthInbox must be used within HealthInboxProvider')
  return context
}
