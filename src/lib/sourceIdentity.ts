import type { SourcePatientIdentity } from '../types'

export type SourceIdentityReviewStatus = 'not_present' | 'match' | 'needs_review' | 'mismatch'

export interface SourceIdentityReview {
  status: SourceIdentityReviewStatus
  sourceName: string
  sourceDob: string
  sourceMedicalRecordNumber: string
  accountName: string
  requiresAcknowledgement: boolean
}

const ignoredNameTokens = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'md', 'jr', 'sr', 'ii', 'iii', 'iv'])

function nameTokens(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !ignoredNameTokens.has(token))
    .sort()
}

export function namesMatch(left: string, right: string) {
  const a = nameTokens(left)
  const b = nameTokens(right)
  if (!a.length || !b.length || a.length !== b.length) return false
  return a.every((token, index) => token === b[index])
}

export function accountIdentityName(user: { user_metadata?: Record<string, unknown> } | null | undefined) {
  const metadata = user?.user_metadata || {}
  const candidates = [metadata.full_name, metadata.name, metadata.display_name]
  return candidates.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() || ''
}

export function reviewSourceIdentity(
  identity: SourcePatientIdentity | undefined,
  accountName: string,
): SourceIdentityReview {
  const sourceName = identity?.name?.trim() || ''
  const sourceDob = identity?.dob?.trim() || ''
  const sourceMedicalRecordNumber = identity?.medical_record_number?.trim() || ''
  const hasSourceIdentity = Boolean(sourceName || sourceDob || sourceMedicalRecordNumber)

  if (!hasSourceIdentity) {
    return {
      status: 'not_present',
      sourceName,
      sourceDob,
      sourceMedicalRecordNumber,
      accountName,
      requiresAcknowledgement: false,
    }
  }

  if (sourceName && accountName) {
    const match = namesMatch(sourceName, accountName)
    return {
      status: match ? 'match' : 'mismatch',
      sourceName,
      sourceDob,
      sourceMedicalRecordNumber,
      accountName,
      requiresAcknowledgement: !match,
    }
  }

  return {
    status: 'needs_review',
    sourceName,
    sourceDob,
    sourceMedicalRecordNumber,
    accountName,
    requiresAcknowledgement: true,
  }
}
