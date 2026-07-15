import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  recentUploads as seedUploads,
  seedCareTasks,
  seedClinicalMedications,
  seedLabResults,
  seedReconciliationIssues,
  sources as seedSources,
  timeline as seedTimeline,
} from '../data/demo'
import type {
  CareTask,
  ClinicalLabResult,
  ClinicalMedication,
  HealthExtraction,
  IngestionSummary,
  InterviewAnswers,
  MedicationSummary,
  ReconciliationIssue,
  SourceRecord,
  TimelineEvent,
  UploadItem,
} from '../types'

export interface ReviewGap {
  key: keyof InterviewAnswers
  label: string
  detail: string
  source: string
  resolved: boolean
}

interface VitalContextValue {
  answers: InterviewAnswers
  setAnswer: (key: keyof InterviewAnswers, value: string) => void
  uploads: UploadItem[]
  addUpload: (item: UploadItem) => IngestionSummary
  activeSource: SourceRecord | null
  openSource: (source: SourceRecord) => void
  closeSource: () => void
  sources: SourceRecord[]
  timelineEvents: TimelineEvent[]
  clinicalMedications: ClinicalMedication[]
  medicationSummaries: MedicationSummary[]
  labResults: ClinicalLabResult[]
  reconciliationIssues: ReconciliationIssue[]
  careTasks: CareTask[]
  resolveReconciliation: (issueId: string, selectedRecordId: string) => void
  toggleTask: (taskId: string) => void
  readiness: number
  reviewGaps: ReviewGap[]
  openGapCount: number
  resolvedCount: number
  openReconciliationCount: number
  resetDemo: () => void
}

const VitalContext = createContext<VitalContextValue | undefined>(undefined)

const defaultAnswers: InterviewAnswers = {
  timing: '',
  positional: '',
  dose: '',
  priorities: '',
}

function readSession<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.sessionStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : fallback
  } catch {
    return fallback
  }
}

function isResolvedAnswer(key: keyof InterviewAnswers, value: string) {
  if (!value || value === 'I’m not sure') return false
  if (key === 'dose' && value === 'I take it differently') return false
  return true
}

function normalizeMedicationName(value: string) {
  const removable = new Set([
    'hyclate', 'hydrochloride', 'succinate', 'tartrate', 'sodium', 'potassium',
    'extended', 'release', 'er', 'xr', 'sr', 'dr', 'tablet', 'tablets', 'capsule',
    'capsules', 'oral', 'solution', 'injection', 'cream', 'ointment',
  ])
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !removable.has(token) && !/^\d/.test(token) && !/^(mg|mcg|g|ml)$/.test(token))
    .join(' ')
    .trim()
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeTest(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function toIsoDate(value: string) {
  if (!value || /^today$/i.test(value.trim())) return new Date().toISOString().slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10)
}

function toDisplayDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T12:00:00`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed)
}

function evidenceFor(extraction: HealthExtraction, search: string) {
  const target = search.toLowerCase()
  const match = extraction.evidence.find((item) => `${item.field} ${item.value}`.toLowerCase().includes(target))
  return match?.quote || extraction.evidence[0]?.quote || extraction.summary
}

function medicationValue(medication: ClinicalMedication) {
  return [medication.strength, medication.directions].filter(Boolean).join(' · ')
}

function medicationValuesConflict(a: ClinicalMedication, b: ClinicalMedication) {
  const strengthConflict = Boolean(a.strength && b.strength && normalizeText(a.strength) !== normalizeText(b.strength))
  const directionsConflict = Boolean(a.directions && b.directions && normalizeText(a.directions) !== normalizeText(b.directions))
  return strengthConflict || directionsConflict
}

function buildSource(item: UploadItem, extraction: HealthExtraction): SourceRecord {
  const sourceId = `source-${item.id}`
  const isoDate = toIsoDate(extraction.event_date)
  const details: SourceRecord['details'] = []
  extraction.medications.forEach((medication) => details.push({
    label: 'Medication',
    value: [medication.name, medication.strength, medication.directions].filter(Boolean).join(' · '),
    highlight: true,
  }))
  extraction.lab_results.forEach((result) => details.push({
    label: result.test || 'Lab result',
    value: [result.value, result.unit, result.abnormal_flag].filter(Boolean).join(' · '),
    highlight: Boolean(result.abnormal_flag && !/normal|within/i.test(result.abnormal_flag)),
  }))
  extraction.symptoms.forEach((symptom) => details.push({ label: 'Symptom', value: symptom }))
  extraction.diagnoses.forEach((diagnosis) => details.push({ label: 'Documented diagnosis', value: diagnosis }))
  extraction.instructions.forEach((instruction) => details.push({ label: 'Instruction', value: instruction }))
  if (extraction.follow_up) details.push({ label: 'Follow-up', value: extraction.follow_up, highlight: true })
  if (details.length === 0) details.push({ label: 'Summary', value: extraction.summary })

  return {
    id: sourceId,
    title: extraction.title || item.name,
    subtitle: `${extraction.facility || 'Patient upload'} · ${toDisplayDate(isoDate)}`,
    date: isoDate,
    type: item.type,
    excerpt: extraction.summary,
    details: details.slice(0, 30),
  }
}

function timelineCategory(extraction: HealthExtraction): TimelineEvent['category'] {
  if (extraction.lab_results.length) return 'results'
  if (extraction.medications.length) return 'medications'
  if (extraction.symptoms.length || extraction.document_type === 'symptom_note') return 'symptoms'
  if (['after_visit_summary', 'discharge_summary'].includes(extraction.document_type)) return 'visits'
  return 'documents'
}

function buildTimelineEvent(item: UploadItem, extraction: HealthExtraction, sourceId: string): TimelineEvent {
  const date = toIsoDate(extraction.event_date)
  return {
    id: `timeline-${item.id}`,
    date,
    displayDate: toDisplayDate(date),
    category: timelineCategory(extraction),
    title: extraction.title || item.name,
    summary: extraction.summary,
    sourceLabel: extraction.mode === 'live' ? 'AI extracted · patient confirmed' : 'Patient confirmed',
    sourceType: extraction.mode === 'live' ? 'ai' : 'patient',
    sourceId,
  }
}

function parseNumeric(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] || '')
  return Number.isFinite(parsed) ? parsed : null
}

export function VitalProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<InterviewAnswers>(() => readSession('vital-answers', defaultAnswers))
  const [uploads, setUploads] = useState<UploadItem[]>(() => readSession('vital-uploads', seedUploads))
  const [sources, setSources] = useState<SourceRecord[]>(() => readSession('vital-sources', seedSources))
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(() => readSession('vital-timeline', seedTimeline))
  const [clinicalMedications, setClinicalMedications] = useState<ClinicalMedication[]>(() => readSession('vital-clinical-medications', seedClinicalMedications))
  const [labResults, setLabResults] = useState<ClinicalLabResult[]>(() => readSession('vital-lab-results', seedLabResults))
  const [reconciliationIssues, setReconciliationIssues] = useState<ReconciliationIssue[]>(() => readSession('vital-reconciliation-issues', seedReconciliationIssues))
  const [careTasks, setCareTasks] = useState<CareTask[]>(() => readSession('vital-care-tasks', seedCareTasks))
  const [activeSource, setActiveSource] = useState<SourceRecord | null>(null)

  useEffect(() => { window.sessionStorage.setItem('vital-answers', JSON.stringify(answers)) }, [answers])
  useEffect(() => { window.sessionStorage.setItem('vital-uploads', JSON.stringify(uploads)) }, [uploads])
  useEffect(() => { window.sessionStorage.setItem('vital-sources', JSON.stringify(sources)) }, [sources])
  useEffect(() => { window.sessionStorage.setItem('vital-timeline', JSON.stringify(timelineEvents)) }, [timelineEvents])
  useEffect(() => { window.sessionStorage.setItem('vital-clinical-medications', JSON.stringify(clinicalMedications)) }, [clinicalMedications])
  useEffect(() => { window.sessionStorage.setItem('vital-lab-results', JSON.stringify(labResults)) }, [labResults])
  useEffect(() => { window.sessionStorage.setItem('vital-reconciliation-issues', JSON.stringify(reconciliationIssues)) }, [reconciliationIssues])
  useEffect(() => { window.sessionStorage.setItem('vital-care-tasks', JSON.stringify(careTasks)) }, [careTasks])

  const applyMedicationResolution = (issue: ReconciliationIssue, selectedRecordId: string) => {
    const selected = clinicalMedications.find((medication) => medication.id === selectedRecordId)
    if (!selected) return

    setReconciliationIssues((current) => current.map((item) => item.id === issue.id ? {
      ...item,
      status: 'resolved',
      selectedRecordId,
      resolution: `Patient confirmed ${selected.name}: ${medicationValue(selected)}.`,
    } : item))

    const involvedIds = new Set(issue.sources.map((source) => source.recordId))
    setClinicalMedications((current) => current.map((medication) => {
      if (!involvedIds.has(medication.id)) return medication
      return medication.id === selectedRecordId
        ? { ...medication, active: true, verificationStatus: 'patient_confirmed' }
        : { ...medication, active: false, verificationStatus: 'superseded' }
    }))

    const eventId = `timeline-resolution-${issue.id}`
    const resolutionEvent: TimelineEvent = {
      id: eventId,
      date: new Date().toISOString().slice(0, 10),
      displayDate: toDisplayDate(new Date().toISOString().slice(0, 10)),
      category: 'medications',
      title: `${issue.entityName} discrepancy reconciled`,
      summary: `Patient confirmed ${medicationValue(selected)} as the current instructions. Earlier conflicting information remains linked to its source.`,
      sourceLabel: 'Patient confirmed',
      sourceType: 'patient',
      sourceId: selected.sourceId,
    }
    setTimelineEvents((current) => current.some((event) => event.id === eventId) ? current : [...current, resolutionEvent].sort((a, b) => a.date.localeCompare(b.date)))
  }

  const setAnswer = (key: keyof InterviewAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }))
    if (key === 'dose' && isResolvedAnswer(key, value)) {
      const issue = reconciliationIssues.find((item) => item.id === 'issue-metoprolol' && item.status === 'open')
      if (issue) {
        const selected = clinicalMedications.find((medication) => issue.sources.some((source) => source.recordId === medication.id)
          && (value.startsWith('25 mg') ? medication.strength.includes('25') : medication.strength.includes('50')))
        if (selected) applyMedicationResolution(issue, selected.id)
      }
    }
  }

  const addUpload = (item: UploadItem): IngestionSummary => {
    setUploads((current) => [item, ...current])
    const extraction = item.extraction
    if (!extraction) return { medicationsAdded:0, labsAdded:0, timelineEventsAdded:0, conflictsFound:0, tasksCreated:0 }

    const source = buildSource(item, extraction)
    const timelineEvent = buildTimelineEvent(item, extraction, source.id)
    const now = Date.now()
    const newIssues: ReconciliationIssue[] = []
    const newTasks: CareTask[] = []

    const newMedicationRecords: ClinicalMedication[] = extraction.medications.map((medication, index) => {
      const canonicalName = normalizeMedicationName(medication.name) || medication.name.toLowerCase()
      const candidate: ClinicalMedication = {
        id: `med-${item.id}-${index}`,
        canonicalName,
        name: medication.name || 'Medication',
        strength: medication.strength,
        directions: medication.directions,
        prescriber: medication.prescriber,
        sourceId: source.id,
        sourceTitle: source.title,
        sourceDate: source.date,
        evidence: evidenceFor(extraction, medication.name),
        confidence: extraction.evidence.find((evidence) => `${evidence.field} ${evidence.value}`.toLowerCase().includes(medication.name.toLowerCase()))?.confidence || extraction.confidence,
        verificationStatus: 'patient_confirmed',
        active: true,
      }
      const conflicts = clinicalMedications.filter((existing) => existing.active && existing.canonicalName === canonicalName && medicationValuesConflict(existing, candidate))
      const existingOpenIssue = reconciliationIssues.some((issue) => issue.status === 'open' && issue.sources.some((issueSource) => conflicts.some((conflict) => conflict.id === issueSource.recordId)))
      if (conflicts.length && !existingOpenIssue) {
        candidate.verificationStatus = 'needs_review'
        const issueId = `issue-${canonicalName.replace(/\s+/g, '-')}-${now}-${index}`
        newIssues.push({
          id: issueId,
          kind: 'medication_conflict',
          entityName: candidate.name,
          title: `${candidate.name} instructions conflict`,
          detail: `${conflicts.length + 1} source-supported versions are active in the patient record.`,
          question: `Which ${candidate.name} instructions are you following now?`,
          status: 'open',
          sources: [
            ...conflicts.slice(0, 3).map((conflict) => ({ recordId:conflict.id, sourceId:conflict.sourceId, label:conflict.sourceTitle, value:medicationValue(conflict) })),
            { recordId:candidate.id, sourceId:candidate.sourceId, label:candidate.sourceTitle, value:medicationValue(candidate) },
          ],
          createdAt: source.date,
        })
        newTasks.push({
          id:`task-${issueId}`,
          type:'medication_review',
          title:`Confirm current ${candidate.name} instructions`,
          detail:'Vital Passport found different strengths or schedules across source records.',
          status:'open',
          sourceId:source.id,
          dueLabel:'Before sharing the clinician brief',
        })
      }
      return candidate
    })

    const newLabRecords: ClinicalLabResult[] = extraction.lab_results.map((result, index) => {
      const canonicalTest = normalizeTest(result.test)
      const previous = [...labResults].filter((lab) => lab.canonicalTest === canonicalTest).sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0]
      const previousValue = previous ? parseNumeric(previous.value) : null
      const currentValue = parseNumeric(result.value)
      const trend = previous && previousValue !== null && currentValue !== null
        ? `${previous.value}${previous.unit ? ` ${previous.unit}` : ''} → ${result.value}${result.unit ? ` ${result.unit}` : ''}`
        : undefined
      const record: ClinicalLabResult = {
        id:`lab-${item.id}-${index}`,
        canonicalTest,
        test:result.test || 'Lab result',
        value:result.value,
        unit:result.unit,
        referenceRange:result.reference_range,
        abnormalFlag:result.abnormal_flag,
        eventDate:source.date,
        sourceId:source.id,
        sourceTitle:source.title,
        evidence:evidenceFor(extraction, result.test),
        confidence:extraction.evidence.find((evidence) => `${evidence.field} ${evidence.value}`.toLowerCase().includes(result.test.toLowerCase()))?.confidence || extraction.confidence,
        trend,
      }
      if (result.abnormal_flag && !/normal|within|negative/i.test(result.abnormal_flag)) {
        newTasks.push({
          id:`task-lab-${item.id}-${index}`,
          type:'lab_review',
          title:`Review ${result.abnormal_flag.toLowerCase()} ${record.test}`,
          detail:`${record.test} was ${[record.value, record.unit].filter(Boolean).join(' ')}${trend ? ` (${trend})` : ''}.`,
          status:'open',
          sourceId:source.id,
          dueLabel:'Discuss with the doctor',
        })
      }
      return record
    })

    if (extraction.follow_up) newTasks.push({
      id:`task-follow-up-${item.id}`,
      type:'follow_up',
      title:'Complete documented follow-up',
      detail:extraction.follow_up,
      status:'open',
      sourceId:source.id,
      dueLabel:'From uploaded instructions',
    })

    if (extraction.document_type === 'question' && extraction.evidence[0]?.value) newTasks.push({
      id:`task-question-${item.id}`,
      type:'patient_question',
      title:'Ask at the next visit',
      detail:extraction.evidence[0].value,
      status:'open',
      sourceId:source.id,
      dueLabel:'Patient priority',
    })

    setSources((current) => [source, ...current.filter((existing) => existing.id !== source.id)])
    setTimelineEvents((current) => [...current.filter((event) => event.id !== timelineEvent.id), timelineEvent].sort((a, b) => a.date.localeCompare(b.date)))
    if (newMedicationRecords.length) setClinicalMedications((current) => [...newMedicationRecords, ...current])
    if (newLabRecords.length) setLabResults((current) => [...newLabRecords, ...current].sort((a, b) => b.eventDate.localeCompare(a.eventDate)))
    if (newIssues.length) setReconciliationIssues((current) => [...newIssues, ...current])
    if (newTasks.length) setCareTasks((current) => [...newTasks, ...current])

    return {
      medicationsAdded:newMedicationRecords.length,
      labsAdded:newLabRecords.length,
      timelineEventsAdded:1,
      conflictsFound:newIssues.length,
      tasksCreated:newTasks.length,
    }
  }

  const resolveReconciliation = (issueId: string, selectedRecordId: string) => {
    const issue = reconciliationIssues.find((item) => item.id === issueId)
    if (!issue) return
    applyMedicationResolution(issue, selectedRecordId)
    if (issue.id === 'issue-metoprolol') {
      const selected = clinicalMedications.find((medication) => medication.id === selectedRecordId)
      if (selected) setAnswers((current) => ({ ...current, dose:selected.strength.includes('25') ? '25 mg twice daily' : '50 mg once daily' }))
    }
    setCareTasks((current) => current.map((task) => task.id === `task-${issueId}` ? { ...task, status:'done' } : task))
  }

  const toggleTask = (taskId: string) => {
    setCareTasks((current) => current.map((task) => task.id === taskId ? { ...task, status:task.status === 'open' ? 'done' : 'open' } : task))
  }

  const reviewGaps = useMemo<ReviewGap[]>(
    () => [
      {
        key: 'timing',
        label: 'Symptom timing',
        detail: answers.timing || 'Clarify whether symptoms started before or after the dose change.',
        source: 'Voice note + medication history',
        resolved: isResolvedAnswer('timing', answers.timing),
      },
      {
        key: 'positional',
        label: 'Trigger pattern',
        detail: answers.positional || 'Confirm whether standing up reliably triggers the dizziness.',
        source: 'Home blood pressure + symptom note',
        resolved: isResolvedAnswer('positional', answers.positional),
      },
      {
        key: 'dose',
        label: 'Metoprolol dose',
        detail: isResolvedAnswer('dose', answers.dose) ? `Patient confirmed: ${answers.dose}` : answers.dose ? `Patient response: ${answers.dose}. Further clarification is still needed.` : 'Bottle photo and urgent-care summary list different instructions.',
        source: '2 conflicting sources',
        resolved: isResolvedAnswer('dose', answers.dose),
      },
      {
        key: 'priorities',
        label: 'Patient priorities',
        detail: answers.priorities || 'Capture the questions Maria most wants answered during the visit.',
        source: 'Patient interview',
        resolved: isResolvedAnswer('priorities', answers.priorities),
      },
    ],
    [answers],
  )

  const medicationSummaries = useMemo<MedicationSummary[]>(() => {
    const groups = new Map<string, ClinicalMedication[]>()
    clinicalMedications.forEach((medication) => {
      const existing = groups.get(medication.canonicalName) || []
      groups.set(medication.canonicalName, [...existing, medication])
    })

    return [...groups.entries()].map(([canonicalName, records]) => {
      const activeRecords = records.filter((record) => record.active)
      const issue = reconciliationIssues.find((candidate) => candidate.status === 'open' && candidate.sources.some((source) => records.some((record) => record.id === source.recordId)))
      if (issue) return {
        canonicalName,
        name:issue.entityName,
        strength:issue.sources.map((source) => source.value).join(' vs '),
        directions:'Patient confirmation needed',
        status:'conflict' as const,
        sourceCount:records.length,
        sourceIds:issue.sources.map((source) => source.sourceId),
        issueId:issue.id,
      }
      const selected = [...activeRecords].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate))[0] || records[0]
      return {
        canonicalName,
        name:selected.name,
        strength:selected.strength,
        directions:selected.directions,
        status:selected.verificationStatus === 'needs_review' ? 'needs_review' as const : 'confirmed' as const,
        sourceCount:records.length,
        sourceIds:records.map((record) => record.sourceId),
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [clinicalMedications, reconciliationIssues])

  const resolvedCount = reviewGaps.filter((gap) => gap.resolved).length
  const openGapCount = reviewGaps.length - resolvedCount
  const openReconciliationCount = reconciliationIssues.filter((issue) => issue.status === 'open').length
  const additionalOpenIssues = reconciliationIssues.filter((issue) => issue.status === 'open' && issue.id !== 'issue-metoprolol').length
  const readiness = Math.max(35, Math.min(100, 68 + resolvedCount * 8 - additionalOpenIssues * 6))

  const resetDemo = () => {
    setAnswers(defaultAnswers)
    setUploads(seedUploads)
    setSources(seedSources)
    setTimelineEvents(seedTimeline)
    setClinicalMedications(seedClinicalMedications)
    setLabResults(seedLabResults)
    setReconciliationIssues(seedReconciliationIssues)
    setCareTasks(seedCareTasks)
    setActiveSource(null)
    ;['vital-answers','vital-uploads','vital-sources','vital-timeline','vital-clinical-medications','vital-lab-results','vital-reconciliation-issues','vital-care-tasks'].forEach((key) => window.sessionStorage.removeItem(key))
  }

  const value: VitalContextValue = {
    answers,
    setAnswer,
    uploads,
    addUpload,
    activeSource,
    openSource:setActiveSource,
    closeSource:() => setActiveSource(null),
    sources,
    timelineEvents,
    clinicalMedications,
    medicationSummaries,
    labResults,
    reconciliationIssues,
    careTasks,
    resolveReconciliation,
    toggleTask,
    readiness,
    reviewGaps,
    openGapCount,
    resolvedCount,
    openReconciliationCount,
    resetDemo,
  }

  return <VitalContext.Provider value={value}>{children}</VitalContext.Provider>
}

export function useVital() {
  const context = useContext(VitalContext)
  if (!context) throw new Error('useVital must be used within VitalProvider')
  return context
}
