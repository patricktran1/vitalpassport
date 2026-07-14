export type SourceType = 'documented' | 'patient' | 'ai' | 'conflict'
export type HealthItemType = 'document' | 'medication' | 'lab' | 'voice' | 'symptom' | 'question' | 'photo'

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

export interface InterviewAnswers {
  timing: string
  positional: string
  dose: string
  priorities: string
}
