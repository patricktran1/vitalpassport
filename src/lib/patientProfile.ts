import { patient as demoPatient } from '../data/demo'

export interface PatientProfile {
  name: string
  dob: string
  pronouns: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  emergencyContactName: string
  emergencyContactRelationship: string
  emergencyContactPhone: string
  photoDataUrl: string
  conditions: string[]
  allergies: string[]
}

export const PATIENT_PROFILE_KEY = 'vital-patient-profile-v1'

export const blankPatientProfile: PatientProfile = {
  name: '',
  dob: '',
  pronouns: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
  photoDataUrl: '',
  conditions: [],
  allergies: [],
}

export const demoPatientProfile: PatientProfile = {
  name: demoPatient.name,
  dob: '1964-05-12',
  pronouns: demoPatient.pronouns,
  phone: '(415) 555-0142',
  email: 'maria.santos@example.com',
  addressLine1: '1440 Bayview Avenue',
  addressLine2: 'Apartment 4B',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94124',
  emergencyContactName: 'Elena Santos',
  emergencyContactRelationship: 'Daughter',
  emergencyContactPhone: '(415) 555-0184',
  photoDataUrl: '',
  conditions: [...demoPatient.conditions],
  allergies: [...demoPatient.allergies],
}

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

export function normalizePatientProfile(value: unknown, fallback: PatientProfile): PatientProfile {
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<PatientProfile>
  return {
    name: cleanString(candidate.name, fallback.name),
    dob: cleanString(candidate.dob, fallback.dob),
    pronouns: cleanString(candidate.pronouns, fallback.pronouns),
    phone: cleanString(candidate.phone, fallback.phone),
    email: cleanString(candidate.email, fallback.email),
    addressLine1: cleanString(candidate.addressLine1, fallback.addressLine1),
    addressLine2: cleanString(candidate.addressLine2, fallback.addressLine2),
    city: cleanString(candidate.city, fallback.city),
    state: cleanString(candidate.state, fallback.state),
    postalCode: cleanString(candidate.postalCode, fallback.postalCode),
    emergencyContactName: cleanString(candidate.emergencyContactName, fallback.emergencyContactName),
    emergencyContactRelationship: cleanString(candidate.emergencyContactRelationship, fallback.emergencyContactRelationship),
    emergencyContactPhone: cleanString(candidate.emergencyContactPhone, fallback.emergencyContactPhone),
    photoDataUrl: typeof candidate.photoDataUrl === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(candidate.photoDataUrl) ? candidate.photoDataUrl : fallback.photoDataUrl,
    conditions: Array.isArray(candidate.conditions) ? candidate.conditions.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : fallback.conditions,
    allergies: Array.isArray(candidate.allergies) ? candidate.allergies.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : fallback.allergies,
  }
}

export function readStoredPatientProfile() {
  if (typeof window === 'undefined') return blankPatientProfile
  try {
    return normalizePatientProfile(JSON.parse(window.localStorage.getItem(PATIENT_PROFILE_KEY) || 'null'), blankPatientProfile)
  } catch {
    return blankPatientProfile
  }
}

export async function prepareProfilePhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP photograph.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Profile photographs must be 10 MB or smaller.')

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('This photograph could not be read. Try JPG, PNG, or WebP.'))
      nextImage.src = objectUrl
    })

    const size = 384
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The photograph could not be prepared.')

    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(objectUrl)
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
