import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { recentUploads as seedUploads } from '../data/demo'
import type { InterviewAnswers, SourceRecord, UploadItem } from '../types'

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
  addUpload: (item: UploadItem) => void
  activeSource: SourceRecord | null
  openSource: (source: SourceRecord) => void
  closeSource: () => void
  readiness: number
  reviewGaps: ReviewGap[]
  openGapCount: number
  resolvedCount: number
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

export function VitalProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<InterviewAnswers>(() => readSession('vital-answers', defaultAnswers))
  const [uploads, setUploads] = useState<UploadItem[]>(() => readSession('vital-uploads', seedUploads))
  const [activeSource, setActiveSource] = useState<SourceRecord | null>(null)

  useEffect(() => {
    window.sessionStorage.setItem('vital-answers', JSON.stringify(answers))
  }, [answers])

  useEffect(() => {
    window.sessionStorage.setItem('vital-uploads', JSON.stringify(uploads))
  }, [uploads])

  const setAnswer = (key: keyof InterviewAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  const addUpload = (item: UploadItem) => {
    setUploads((current) => [item, ...current])
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

  const resolvedCount = reviewGaps.filter((gap) => gap.resolved).length
  const openGapCount = reviewGaps.length - resolvedCount
  const readiness = Math.min(100, 68 + resolvedCount * 8)

  const resetDemo = () => {
    setAnswers(defaultAnswers)
    setUploads(seedUploads)
    setActiveSource(null)
    window.sessionStorage.removeItem('vital-answers')
    window.sessionStorage.removeItem('vital-uploads')
  }

  const value: VitalContextValue = {
    answers,
    setAnswer,
    uploads,
    addUpload,
    activeSource,
    openSource: setActiveSource,
    closeSource: () => setActiveSource(null),
    readiness,
    reviewGaps,
    openGapCount,
    resolvedCount,
    resetDemo,
  }

  return <VitalContext.Provider value={value}>{children}</VitalContext.Provider>
}

export function useVital() {
  const context = useContext(VitalContext)
  if (!context) throw new Error('useVital must be used within VitalProvider')
  return context
}
