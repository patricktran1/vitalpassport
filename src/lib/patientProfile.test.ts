import { describe, expect, it } from 'vitest'
import {
  blankPatientProfile,
  calculatePatientAge,
  normalizePatientProfile,
  patientInitials,
  profileDisplayName,
} from './patientProfile'

describe('normalizePatientProfile', () => {
  it('returns the supplied fallback for missing or non-object values', () => {
    const fallback = { ...blankPatientProfile, name: 'Fallback Patient' }

    expect(normalizePatientProfile(null, fallback)).toBe(fallback)
    expect(normalizePatientProfile('invalid', fallback)).toBe(fallback)
  })

  it('trims strings and removes invalid or blank clinical list entries', () => {
    const normalized = normalizePatientProfile({
      name: '  Jordan Lee  ',
      email: ' jordan@example.com ',
      conditions: [' Asthma ', '', 7, 'Migraine'],
      allergies: [' Penicillin ', null, '  '],
    }, blankPatientProfile)

    expect(normalized.name).toBe('Jordan Lee')
    expect(normalized.email).toBe('jordan@example.com')
    expect(normalized.conditions).toEqual(['Asthma', 'Migraine'])
    expect(normalized.allergies).toEqual(['Penicillin'])
  })

  it('accepts supported image data URLs and rejects unsafe photo values', () => {
    const validPhoto = 'data:image/webp;base64,AAAA'
    const fallback = { ...blankPatientProfile, photoDataUrl: 'data:image/png;base64,FALLBACK' }

    expect(normalizePatientProfile({ photoDataUrl: validPhoto }, fallback).photoDataUrl).toBe(validPhoto)
    expect(normalizePatientProfile({ photoDataUrl: 'javascript:alert(1)' }, fallback).photoDataUrl)
      .toBe(fallback.photoDataUrl)
    expect(normalizePatientProfile({ photoDataUrl: 'data:image/svg+xml;base64,AAAA' }, fallback).photoDataUrl)
      .toBe(fallback.photoDataUrl)
  })

  it('uses fallback values when incoming fields have the wrong type', () => {
    const fallback = {
      ...blankPatientProfile,
      phone: '(555) 555-0100',
      conditions: ['Existing condition'],
    }

    const normalized = normalizePatientProfile({
      phone: 555,
      conditions: 'not-an-array',
    }, fallback)

    expect(normalized.phone).toBe(fallback.phone)
    expect(normalized.conditions).toBe(fallback.conditions)
  })
})

describe('calculatePatientAge', () => {
  it('handles birthdays before, on, and after the reference date', () => {
    const reference = new Date('2026-07-23T12:00:00')

    expect(calculatePatientAge('2000-07-22', reference)).toBe(26)
    expect(calculatePatientAge('2000-07-23', reference)).toBe(26)
    expect(calculatePatientAge('2000-07-24', reference)).toBe(25)
  })

  it('rejects empty, invalid, and future dates', () => {
    const reference = new Date('2026-07-23T12:00:00')

    expect(calculatePatientAge('', reference)).toBeNull()
    expect(calculatePatientAge('not-a-date', reference)).toBeNull()
    expect(calculatePatientAge('2030-01-01', reference)).toBeNull()
  })
})

describe('patient display helpers', () => {
  it('creates stable initials from one or more names', () => {
    expect(patientInitials('')).toBe('ME')
    expect(patientInitials('  maria  ')).toBe('M')
    expect(patientInitials('Maria Elena Santos')).toBe('ME')
  })

  it('uses an explicit incomplete-state label when no name is present', () => {
    expect(profileDisplayName(blankPatientProfile)).toBe('Patient profile incomplete')
    expect(profileDisplayName({ ...blankPatientProfile, name: 'Maria Santos' })).toBe('Maria Santos')
  })
})
