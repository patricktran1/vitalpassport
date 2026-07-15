export type SourceType = 'documented' | 'patient' | 'ai' | 'conflict'
export type HealthItemType = 'document' | 'medication' | 'lab' | 'voice' | 'symptom' | 'question' | 'photo'
export type VerificationStatus = 'documented' | 'patient_confirmed' | 'needs_review' | 'superseded'

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
