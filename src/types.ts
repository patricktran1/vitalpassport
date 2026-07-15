export type SourceType = 'documented' | 'patient' | 'ai' | 'conflict'
export type HealthItemType = 'document' | 'medication' | 'lab' | 'voice' | 'symptom' | 'question' | 'photo'
export type VerificationStatus = 'documented' | 'patient_confirmed' | 'needs_review' | 'superseded'
export type CloudSyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'error'

export interface SourceRecord {
  id: string
  title: string
  subtitle: string
  date: string
  type: HealthItemType
  excerpt: string
  details: Array<{ label: string; value: string; highlight?: boolean }>
}

export interface TimelineEvent {
  id: string
  date: string
  displayDate: string
  category: 'symptoms' | 'medications' | 'visits' | 'results' | 'documents'
  title: string
  summary: string
  sourceLabel: string
  sourceType: SourceType
  sourceId?: string
}

export interface Medication {
  name: string
  dose: string
  frequency: string
  status: 'verified' | 'conflict' | 'unverified'
  source: string
  sourceId: string
}

export interface ExtractionMedication {
  name: string
  strength: string
  directions: string
  prescriber: string
}

export interface ExtractionLabResult {
  test: string
  value: string
  unit: string
  reference_range: string
  abnormal_flag: string
}

export interface ExtractionEvidence {
  field: string
  value: string
  quote: string
  confidence: number
}

export interface HealthExtraction {
  document_type: 'medication_bottle' | 'lab_report' | 'after_visit_summary' | 'discharge_summary' | 'imaging_report' | 'symptom_note' | 'question' | 'health_photo' | 'other'
  title: string
  summary: string
  event_date: string
  facility: string
  medications: ExtractionMedication[]
  lab_results: ExtractionLabResult[]
  diagnoses: string[]
  instructions: string[]
  symptoms: string[]
  follow_up: string
  evidence: ExtractionEvidence[]
  warnings: string[]
  requires_confirmation: boolean
  confidence: number
  model?: string
  mode?: 'live' | 'demo'
}

export interface UploadItem {
  id: string
  name: string
  type: HealthItemType
  date: string
  status: 'processing' | 'ready'
  summary: string
  extraction?: HealthExtraction
}

export interface ClinicalMedication {
  id: string
  canonicalName: string
  name: string
  strength: string
  directions: string
  prescriber: string
  sourceId: string
  sourceTitle: string
  sourceDate: string
  evidence: string
  confidence: number
  verificationStatus: VerificationStatus
  active: boolean
}

export interface ClinicalLabResult {
  id: string
  canonicalTest: string
  test: string
  value: string
  unit: string
  referenceRange: string
  abnormalFlag: string
  eventDate: string
  sourceId: string
  sourceTitle: string
  evidence: string
  confidence: number
  trend?: string
}

export interface ReconciliationSource {
  recordId: string
  sourceId: string
  label: string
  value: string
}

export interface ReconciliationIssue {
  id: string
  kind: 'medication_conflict'
  entityName: string
  title: string
  detail: string
  question: string
  status: 'open' | 'resolved'
  sources: ReconciliationSource[]
  resolution?: string
  selectedRecordId?: string
  createdAt: string
}

export interface CareTask {
  id: string
  type: 'follow_up' | 'lab_review' | 'medication_review' | 'patient_question'
  title: string
  detail: string
  status: 'open' | 'done'
  sourceId?: string
  dueLabel?: string
}

export interface MedicationSummary {
  canonicalName: string
  name: string
  strength: string
  directions: string
  status: 'confirmed' | 'conflict' | 'needs_review'
  sourceCount: number
  sourceIds: string[]
  issueId?: string
}

export interface IngestionSummary {
  medicationsAdded: number
  labsAdded: number
  timelineEventsAdded: number
  conflictsFound: number
  tasksCreated: number
}

export interface InterviewAnswers {
  timing: string
  positional: string
  dose: string
  priorities: string
}

export interface PatientRecordSnapshot {
  schemaVersion: 1
  updatedAt: string
  answers: InterviewAnswers
  uploads: UploadItem[]
  sources: SourceRecord[]
  timelineEvents: TimelineEvent[]
  clinicalMedications: ClinicalMedication[]
  labResults: ClinicalLabResult[]
  reconciliationIssues: ReconciliationIssue[]
  careTasks: CareTask[]
}

export interface SharedBriefPacket {
  schemaVersion: 1
  preparedAt: string
  patient: {
    name: string
    age: number
    dob: string
    pronouns: string
    conditions: string[]
    allergies: string[]
  }
  visit: {
    label: string
    reason: string
  }
  readiness: {
    percent: number
    interviewConfirmed: number
    interviewTotal: number
    openInterviewGaps: number
    openReconciliationCount: number
  }
  priorities: string[]
  medications: Array<{
    name: string
    strength: string
    directions: string
    status: MedicationSummary['status']
    sourceCount: number
  }>
  labs: Array<{
    test: string
    value: string
    unit: string
    abnormalFlag: string
    eventDate: string
    trend?: string
    sourceId: string
  }>
  reconciliation: Array<{
    title: string
    status: ReconciliationIssue['status']
    detail: string
    resolution?: string
    sources: Array<{ label: string; value: string; sourceId: string }>
  }>
  timeline: TimelineEvent[]
  openTasks: Array<Pick<CareTask, 'title' | 'detail' | 'dueLabel'>>
  sources: SourceRecord[]
  disclaimer: string
}

export interface SharedBriefEnvelope {
  packet: SharedBriefPacket
  createdAt: string
  expiresAt: string
  accessCount: number
}

export interface ShareLinkRecord {
  id: string
  label: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  lastAccessedAt: string | null
  accessCount: number
  token?: string
  url?: string
}
