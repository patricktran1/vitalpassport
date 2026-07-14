import { HeartPulse } from 'lucide-react'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="Vital Passport">
      <div className="brand-mark"><HeartPulse size={compact ? 18 : 22} strokeWidth={2.3} /></div>
      {!compact && (
        <div>
          <div className="brand-name">Vital Passport</div>
          <div className="brand-tagline">Your health story, ready.</div>
        </div>
      )}
    </div>
  )
}
