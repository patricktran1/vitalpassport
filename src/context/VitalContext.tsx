import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { recentUploads as seedUploads } from '../data/demo'
import type { InterviewAnswers, SourceRecord, UploadItem } from '../types'

interface VitalContextValue {
  answers: InterviewAnswers
  setAnswer: (key: keyof InterviewAnswers, value: string) => void
  uploads: UploadItem[]
  addUpload: (item: UploadItem) => void
  activeSource: SourceRecord | null
  openSource: (source: SourceRecord) => void
  closeSource: () => void
  readiness: number
}

const VitalContext = createContext<VitalContextValue | undefined>(undefined)

const defaultAnswers: InterviewAnswers = {
  timing: '',
  positional: '',
  dose: '',
  priorities: '',
}

export function VitalProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<InterviewAnswers>(defaultAnswers)
  const [uploads, setUploads] = useState<UploadItem[]>(seedUploads)
  const [activeSource, setActiveSource] = useState<SourceRecord | null>(null)

  const setAnswer = (key: keyof InterviewAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  const addUpload = (item: UploadItem) => {
    setUploads((current) => [item, ...current])
  }

  const completedAnswers = Object.values(answers).filter(Boolean).length
  const readiness = Math.min(100, 72 + completedAnswers * 7)

  const value = useMemo(
    () => ({
      answers,
      setAnswer,
      uploads,
      addUpload,
      activeSource,
      openSource: setActiveSource,
      closeSource: () => setActiveSource(null),
      readiness,
    }),
    [answers, uploads, activeSource, readiness],
  )

  return <VitalContext.Provider value={value}>{children}</VitalContext.Provider>
}

export function useVital() {
  const context = useContext(VitalContext)
  if (!context) throw new Error('useVital must be used within VitalProvider')
  return context
}
