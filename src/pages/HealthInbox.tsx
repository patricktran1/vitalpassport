import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, FileSearch, GitCompareArrows, Inbox, Pencil, RotateCcw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHealthInbox, type HealthInboxFinding, type HealthInboxKind } from '../context/HealthInboxContext'
import { useVital } from '../context/VitalContext'
import { openCopilotDrawer } from '../lib/copilot-drawer'

const kindMeta: Record<HealthInboxKind, { label: string; icon: typeof Sparkles }> = {
  new_fact: { label: 'New fact', icon: Sparkles },
  change: { label: 'Change', icon: Clock3 },
  conflict: { label: 'Conflict', icon: GitCompareArrows },
  missing_context: { label: 'Missing context', icon: CircleHelp },
  suggested_action: { label: 'Suggested action', icon: AlertTriangle },
}

function FindingCard({ finding }: { finding: HealthInboxFinding }) {
  const { reviewFinding } = useHealthInbox()
  const { openSource } = useVital()
  const [editing, setEditing] = useState(false)
  const [editedValue, setEditedValue] = useState(finding.proposedValue)
  const meta = kindMeta[finding.kind]
  const Icon = meta.icon

  const saveEdit = () => {
    if (!editedValue.trim()) return
    reviewFinding(finding.id, 'edited', editedValue)
    setEditing(false)
  }

  return (
    <article className={`inbox-finding-card kind-${finding.kind}`}>
      <div className="inbox-finding-topline">
        <span className="inbox-kind-pill"><Icon size={14}/>{meta.label}</span>
        <span className="inbox-pending-label">Needs your review</span>
      </div>
      <div className="inbox-finding-copy">
        <h2>{finding.title}</h2>
        <p>{finding.detail}</p>
      </div>

      <div className="inbox-proposed-value">
        <span>What Vital Passport found</span>
        {editing ? (
          <textarea value={editedValue} onChange={(event) => setEditedValue(event.target.value)} rows={3} autoFocus />
        ) : <strong>{finding.proposedValue}</strong>}
      </div>

      <button className="inbox-source-button" onClick={() => openSource(finding.sourceSnapshot)}>
        <FileSearch size={17}/>
        <span><small>Supporting source</small><strong>{finding.sourceLabel}</strong><em>“{finding.sourceQuote}”</em></span>
        <ChevronRight size={16}/>
      </button>

      {editing ? (
        <div className="inbox-edit-actions">
          <button className="button ghost" onClick={() => { setEditing(false); setEditedValue(finding.proposedValue) }}><X size={16}/> Cancel</button>
          <button className="button primary" onClick={saveEdit} disabled={!editedValue.trim()}><Check size={16}/> Save and confirm</button>
        </div>
      ) : (
        <div className="inbox-review-actions">
          <button className="inbox-confirm" onClick={() => reviewFinding(finding.id, 'confirmed')}><Check size={17}/><span><strong>Confirm</strong><small>Add this decision to my record</small></span></button>
          <button onClick={() => setEditing(true)}><Pencil size={17}/><span><strong>Edit</strong><small>Correct before confirming</small></span></button>
          <button onClick={() => reviewFinding(finding.id, 'unsure')}><CircleHelp size={17}/><span><strong>I’m not sure</strong><small>Preserve the uncertainty</small></span></button>
          <button className="inbox-reject" onClick={() => reviewFinding(finding.id, 'rejected')}><X size={17}/><span><strong>Reject</strong><small>Do not add this finding</small></span></button>
        </div>
      )}
    </article>
  )
}

export function HealthInbox() {
  const { pendingFindings, reviewedFindings, recentlyConfirmed, pendingCount, reopenFinding } = useHealthInbox()
  const { openSource } = useVital()

  return (
    <div className="page health-inbox-page">
      <section className="page-heading split-heading inbox-page-heading">
        <div>
          <div className="eyebrow">Patient review queue</div>
          <h1>Health Inbox</h1>
          <p>New health information stops here before consequential changes become patient-confirmed truth.</p>
        </div>
        <button className="button ghost" onClick={() => openCopilotDrawer('What is pending in my Health Inbox, and what did I confirm recently?')}><Sparkles size={16}/> Ask Health Copilot</button>
      </section>

      <section className="inbox-overview-card">
        <div className="inbox-overview-icon"><Inbox size={27}/></div>
        <div><div className="eyebrow">Review status</div><h2>{pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'finding needs' : 'findings need'} your decision` : 'Your Health Inbox is clear'}</h2><p>Confirm, correct, reject, or preserve uncertainty. Every decision creates a receipt.</p></div>
        <div className="inbox-overview-stats"><div><strong>{pendingCount}</strong><span>pending</span></div><div><strong>{recentlyConfirmed.length}</strong><span>recently confirmed</span></div><div><strong>{reviewedFindings.length}</strong><span>reviewed</span></div></div>
      </section>

      <div className="inbox-content-grid">
        <section className="inbox-queue-section">
          <div className="inbox-section-heading"><div><div className="eyebrow">Pending review</div><h2>Decide what belongs in your health memory.</h2></div><span>{pendingCount} open</span></div>
          <div className="inbox-finding-stack">
            {pendingFindings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
            {!pendingFindings.length && <div className="inbox-empty-state"><CheckCircle2 size={28}/><h3>Nothing is waiting for review.</h3><p>New uploads and patient notes will appear here when they need a decision.</p><Link to="/add" className="button primary">Add health information <ArrowRight size={16}/></Link></div>}
          </div>
        </section>

        <aside className="inbox-history-section">
          <div className="inbox-section-heading"><div><div className="eyebrow">Decision receipts</div><h2>What changed</h2></div></div>
          <div className="inbox-receipt-list">
            {reviewedFindings.map((finding) => (
              <article className={`inbox-receipt status-${finding.status}`} key={finding.id}>
                <div className="inbox-receipt-heading">
                  <span>{finding.status === 'confirmed' || finding.status === 'edited' ? <CheckCircle2 size={17}/> : finding.status === 'unsure' ? <CircleHelp size={17}/> : <X size={17}/>}</span>
                  <div><strong>{finding.title}</strong><small>{finding.status === 'edited' ? 'Edited and confirmed' : finding.status === 'confirmed' ? 'Confirmed' : finding.status === 'unsure' ? 'Uncertainty preserved' : 'Rejected'}</small></div>
                </div>
                <p>{finding.receipt?.summary}</p>
                {finding.receipt?.changes.length ? <ul>{finding.receipt.changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}
                <div className="inbox-receipt-actions">
                  <button onClick={() => openSource(finding.sourceSnapshot)}><FileSearch size={14}/> Source</button>
                  {(finding.status === 'unsure' || finding.status === 'rejected') && <button onClick={() => reopenFinding(finding.id)}><RotateCcw size={14}/> Review again</button>}
                </div>
              </article>
            ))}
            {!reviewedFindings.length && <div className="inbox-history-empty"><Clock3 size={21}/><span>Your review receipts will appear here.</span></div>}
          </div>
        </aside>
      </div>
    </div>
  )
}
