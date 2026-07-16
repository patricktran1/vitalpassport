import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useWorkspace } from './WorkspaceContext'
import {
  blankPatientProfile,
  calculatePatientAge,
  demoPatientProfile,
  normalizePatientProfile,
  PATIENT_PROFILE_KEY,
  patientInitials,
  type PatientProfile,
} from '../lib/patientProfile'

interface PatientProfileContextValue {
  profile: PatientProfile
  age: number | null
  initials: string
  updateProfile: (next: PatientProfile) => void
  patchProfile: (next: Partial<PatientProfile>) => void
}

const PatientProfileContext = createContext<PatientProfileContextValue | undefined>(undefined)

function readProfile(fallback: PatientProfile) {
  if (typeof window === 'undefined') return fallback
  try {
    return normalizePatientProfile(JSON.parse(window.localStorage.getItem(PATIENT_PROFILE_KEY) || 'null'), fallback)
  } catch {
    return fallback
  }
}

export function PatientProfileProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspace()
  const fallback = workspace.isDemo ? demoPatientProfile : blankPatientProfile
  const [profile, setProfile] = useState<PatientProfile>(() => readProfile(fallback))

  useEffect(() => {
    window.localStorage.setItem(PATIENT_PROFILE_KEY, JSON.stringify(profile))
  }, [profile])

  const value = useMemo<PatientProfileContextValue>(() => ({
    profile,
    age: calculatePatientAge(profile.dob),
    initials: patientInitials(profile.name),
    updateProfile: (next) => setProfile(normalizePatientProfile(next, blankPatientProfile)),
    patchProfile: (next) => setProfile((current) => normalizePatientProfile({ ...current, ...next }, current)),
  }), [profile])

  return <PatientProfileContext.Provider value={value}>{children}</PatientProfileContext.Provider>
}

export function usePatientProfile() {
  const context = useContext(PatientProfileContext)
  if (!context) throw new Error('usePatientProfile must be used within PatientProfileProvider')
  return context
}
