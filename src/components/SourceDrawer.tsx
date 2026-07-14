import { FileText, Mic, Pill, TestTube2, X } from 'lucide-react'
import { useVital } from '../context/VitalContext'

const icons = {
  document: FileText,
  medication: Pill,
  lab: TestTube2,
  voice: Mic,
  symptom: FileText,
  question: FileText,
  photo: FileText,
}

export function SourceDrawer() {
  const { activeSource, closeSource } = useVital()
  if (!activeSource) return null
  const Icon = icons[activeSource.type]

  return (
    <>
      <button className="drawer-backdrop" onClick={closeSource} aria-label="Close source viewer" />
      <aside className="source-drawer" aria-label="Source record">
        <div className="drawer-header">
          <div className="source-icon large"><Icon size={22} /></div>
          <button className="icon-button" onClick={closeSource} aria-label="Close source"><X size={20} /></button>
        </div>
        <div className="eyebrow">Source record</div>
        <h2>{activeSource.title}</h2>
        <p className="muted">{activeSource.subtitle}</p>

        <div className={`source-preview ${activeSource.type}`}>
          {activeSource.type === 'medication' ? (
            <div className="med-label">
              <div className="med-label-top">RX ONLY</div>
              <strong>METOPROLOL<br />SUCCINATE ER</strong>
              <span>50 MG TABLET</span>
              <div className="label-rule" />
              <p>TAKE ONE TABLET BY MOUTH EVERY MORNING</p>
              <small>Qty 30 · Refills 2</small>
            </div>
          ) : (
            <div className="document-sheet">
              <div className="document-brand">BAYVIEW MEDICAL GROUP</div>
              <div className="document-rule" />
              <p>{activeSource.excerpt}</p>
            </div>
          )}
        </div>

        <div className="drawer-section">
          <h3>Extracted information</h3>
          <div className="detail-list">
            {activeSource.details.map((detail) => (
              <div key={detail.label} className={`detail-row ${detail.highlight ? 'highlight' : ''}`}>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="confidence-note">
          <span className="confidence-dot" />
          <div><strong>High-confidence extraction</strong><p>Always compare important details with the original source.</p></div>
        </div>
      </aside>
    </>
  )
}
