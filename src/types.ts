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

export interface UploadItem {
  id: string
  name: string
  type: HealthItemType
  date: string
  status: 'processing' | 'ready'
  summary: string
}

export interface InterviewAnswers {
  timing: string
  positional: string
  dose: string
  priorities: string
}
