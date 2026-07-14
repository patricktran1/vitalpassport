import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal-backdrop" onClick={onClose} aria-label="Close modal" />
      <div className="modal-card">
        <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  )
}
