import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CopilotMemoryKind = 'preference' | 'goal' | 'concern' | 'context'
export type CopilotMemoryOrigin = 'patient' | 'copilot' | 'check_in' | 'record'

export interface CopilotMemoryItem {
  id: string
  kind: CopilotMemoryKind
  title: string
  value: string
  origin: CopilotMemoryOrigin
  sourceId?: string
  createdAt: string
  updatedAt: string
  forgottenAt?: string
}

export interface NewCopilotMemory {
  kind: CopilotMemoryKind
  title: string
  value: string
  origin?: CopilotMemoryOrigin
  sourceId?: string
}

type MemoryPatch = Partial<Pick<CopilotMemoryItem, 'kind' | 'title' | 'value' | 'sourceId'>>

interface CopilotMemoryContextValue {
  memories: CopilotMemoryItem[]
  activeMemories: CopilotMemoryItem[]
  forgottenMemories: CopilotMemoryItem[]
  remember: (input: NewCopilotMemory) => string
  updateMemory: (memoryId: string, patch: MemoryPatch) => void
  forgetMemory: (memoryId: string) => void
  restoreMemory: (memoryId: string) => void
  clearMemory: () => void
  resetMemory: () => void
}

const STORAGE_KEY = 'vital-copilot-memory-v1'

const seedMemories: CopilotMemoryItem[] = [
  {
    id: 'memory-communication-style',
    kind: 'preference',
    title: 'Communication style',
    value: 'Use plain language, preserve uncertainty, and show supporting sources.',
    origin: 'patient',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
  },
  {
    id: 'memory-visit-goal',
    kind: 'goal',
    title: 'Current health goal',
    value: 'Prepare focused questions for the July 18 primary-care visit.',
    origin: 'patient',
    createdAt: '2026-07-15T09:02:00.000Z',
    updatedAt: '2026-07-15T09:02:00.000Z',
  },
  {
    id: 'memory-dizziness-concern',
    kind: 'concern',
    title: 'Ongoing concern',
    value: 'Understand how dizziness, blood pressure, and medication timing overlap without assuming one caused another.',
    origin: 'patient',
    createdAt: '2026-07-15T09:04:00.000Z',
    updatedAt: '2026-07-15T09:04:00.000Z',
  },
]

function readMemories() {
  if (typeof window === 'undefined') return seedMemories
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    return Array.isArray(parsed) ? parsed as CopilotMemoryItem[] : seedMemories
  } catch {
    return seedMemories
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

const CopilotMemoryContext = createContext<CopilotMemoryContextValue | undefined>(undefined)

export function CopilotMemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<CopilotMemoryItem[]>(readMemories)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memories.slice(0, 100)))
  }, [memories])

  const remember = (input: NewCopilotMemory) => {
    const value = input.value.trim()
    const title = input.title.trim() || 'Remembered context'
    if (!value) return ''

    const existing = memories.find((memory) => !memory.forgottenAt && normalize(memory.value) === normalize(value))
    if (existing) return existing.id

    const timestamp = new Date().toISOString()
    const id = `memory-${Date.now()}`
    const memory: CopilotMemoryItem = {
      id,
      kind: input.kind,
      title,
      value,
      origin: input.origin || 'patient',
      sourceId: input.sourceId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setMemories((current) => [memory, ...current])
    return id
  }

  const updateMemory = (memoryId: string, patch: MemoryPatch) => {
    setMemories((current) => current.map((memory) => memory.id === memoryId ? {
      ...memory,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : memory.title,
      value: patch.value !== undefined ? patch.value.trim() : memory.value,
      updatedAt: new Date().toISOString(),
    } : memory))
  }

  const forgetMemory = (memoryId: string) => {
    setMemories((current) => current.map((memory) => memory.id === memoryId ? {
      ...memory,
      forgottenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } : memory))
  }

  const restoreMemory = (memoryId: string) => {
    setMemories((current) => current.map((memory) => memory.id === memoryId ? {
      ...memory,
      forgottenAt: undefined,
      updatedAt: new Date().toISOString(),
    } : memory))
  }

  const activeMemories = useMemo(
    () => memories.filter((memory) => !memory.forgottenAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [memories],
  )
  const forgottenMemories = useMemo(
    () => memories.filter((memory) => memory.forgottenAt).sort((a, b) => (b.forgottenAt || '').localeCompare(a.forgottenAt || '')),
    [memories],
  )

  const clearMemory = () => setMemories([])
  const resetMemory = () => {
    setMemories(seedMemories)
    window.localStorage.removeItem(STORAGE_KEY)
  }

  return <CopilotMemoryContext.Provider value={{
    memories,
    activeMemories,
    forgottenMemories,
    remember,
    updateMemory,
    forgetMemory,
    restoreMemory,
    clearMemory,
    resetMemory,
  }}>{children}</CopilotMemoryContext.Provider>
}

export function useCopilotMemory() {
  const context = useContext(CopilotMemoryContext)
  if (!context) throw new Error('useCopilotMemory must be used within CopilotMemoryProvider')
  return context
}
