import type { SourceType } from '../types'

export function StatusBadge({ type, label }: { type: SourceType | 'verified' | 'unverified'; label: string }) {
  return <span className={`status-badge ${type}`}>{label}</span>
}
