import { patient as demoPatient } from '../data/demo'

export interface PatientProfile {
  name: string
  dob: string
  pronouns: string
  conditions: string[]
  allergies: string[]
}

export const PATIENT_PROFILE_KEY = 'vital-patient-profile-v1'

export const blankPatientProfile: PatientProfile = {
  name: '',
  dob: '',
  pronouns: '',
  conditions: [],
  allergies: [],
}

export const demoPatientProfile: PatientProfile = {
  name: demoPatient.name,
  dob: '1964-05-12',
  pronouns: demoPatient.pronouns,
  conditions: [...demoPatient.conditions],
  allergies: [...demoPatient.allergies],
}

export function normalizePatientProfile(value: unknown, fallback: PatientProfile): PatientProfile {
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<PatientProfile>
  return {
    name: typeof candidate.name === 'string' ? candidate.name.trim() : fallback.name,
    dob: typeof candidate.dob === 'string' ? candidate.dob.trim() : fallback.dob,
    pronouns: typeof candidate.pronouns === 'string' ? candidate.pronouns.trim() : fallback.pronouns,
    conditions: Array.isArray(candidate.conditions) ? candidate.conditions.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : fallback.conditions,
    allergies: Array.isArray(candidate.allergies) ? candidate.allergies.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : fallback.allergies,
  }
}

export function calculatePatientAge(dob: string, reference = new Date()) {
  if (!dob) return null
  const date = new Date(`${dob}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  let age = reference.getFullYear() - date.getFullYear()
  const birthdayPassed = reference.getMonth() > date.getMonth() || (reference.getMonth() === date.getMonth() && reference.getDate() >= date.getDate())
  if (!birthdayPassed) age -= 1
  return age >= 0 ? age : null
}

export function formatPatientDob(dob: string) {
  if (!dob) return ''
  const date = new Date(`${dob}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dob
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export function patientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'ME'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'ME'
}

export function profileDisplayName(profile: PatientProfile) {
  return profile.name || 'Patient profile incomplete'
}
