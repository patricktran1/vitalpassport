import { CheckCircle2, Clock3, FileText, ListChecks, Pill, Printer, ShieldCheck, TestTube2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { demoSharedBriefPacket } from '../lib/briefPacket'
import { fetchSharedBrief } from '../lib/sharing'
import type { SharedBriefEnvelope } from '../types'

function formatDate(value: string, includeTime = false) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', includeTime
    ? { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }
    : { month:'short', day:'numeric', year:'numeric' }).format(new Date(value))
}

function sourceStatusLabel(type: string) {
  if (type === 'documented') return 'Documented'
  if (type === 'patient') return 'Patient reported'
  if (type === 'ai') return 'AI extracted · patient confirmed'
  return 'Conflict'
}

export function SharedBrief() {
  const { token = '' } = useParams()
  const [envelope, setEnvelope] = useState<SharedBriefEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (token === 'demo-maria') {
          if (!cancelled) setEnvelope({
            packet: demoSharedBriefPacket,
            createdAt: demoSharedBriefPacket.preparedAt,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            accessCount: 1,
          })
          return
        }
        const result = await fetchSharedBrief(token)
        if (!cancelled) {
          if (result) setEnvelope(result)
          else setError('This clinic link is invalid, expired, or has been revoked by the patient.')
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'The shared brief could not be opened.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  if (loading) return <div className="shared-page-state"><div className="shared-loader"/><h1>Opening patient-controlled brief</h1><p>Validating the link and loading the frozen clinical packet.</p></div>
  if (error || !envelope) return <div className="shared-page-state error"><TriangleAlert size={38}/><h1>Brief unavailable</h1><p>{error || 'This shared packet is unavailable.'}</p><small>Ask the patient to create a new Vital Passport link.</small></div>

  const { packet } = envelope
  const incomplete = packet.readiness.openInterviewGaps > 0 || packet.readiness.openReconciliationCount > 0

  return <div className="shared-brief-shell">
    <header className="shared-public-header">
      <div className="shared-brand"><span>VP</span><div><strong>Vital Passport</strong><small>Patient-controlled clinical handoff</small></div></div>
      <div className="shared-header-actions"><span><Clock3 size={14}/> Expires {formatDate(envelope.expiresAt, true)}</span><button onClick={()=>window.print()}><Printer size={16}/> Print</button></div>
    </header>

    <main className="shared-brief-page">
      <section className="shared-access-banner"><ShieldCheck size={20}/><div><strong>View-only clinic access</strong><span>This frozen packet cannot open or modify the patient’s Vital Passport account. Access has been counted and can be revoked by the patient.</span></div><small>View #{envelope.accessCount}</small></section>

      <article className="clinical-brief shared-clinical-brief">
        <header className="brief-header">
          <div><div className="brief-brand">VITAL PASSPORT</div><h2>{packet.patient.name}</h2><p>{packet.patient.age} years old · DOB {packet.patient.dob} · {packet.patient.pronouns}</p></div>
          <div className="brief-meta"><span>Prepared {formatDate(packet.preparedAt, true)}</span><strong>{packet.visit.label}</strong></div>
        </header>

        <section className={`shared-readiness-strip ${incomplete?'attention':'complete'}`}>
          {incomplete?<TriangleAlert size={19}/>:<CheckCircle2 size={19}/>}<div><strong>{incomplete?'Uncertainty remains visible':'Patient review complete'}</strong><span>{packet.readiness.interviewConfirmed}/{packet.readiness.interviewTotal} interview details confirmed · {packet.readiness.openReconciliationCount} unresolved source conflict{packet.readiness.openReconciliationCount===1?'':'s'}</span></div><b>{packet.readiness.percent}%</b>
        </section>

        <section className="brief-highlight">
          <div className="section-number">01</div><div><div className="brief-section-label">Reason for visit</div><h3>{packet.visit.reason}</h3><div className="shared-prepared-note">Patient-controlled summary frozen at {formatDate(packet.preparedAt, true)}</div></div>
        </section>

        <div className="brief-columns">
          <section className="brief-section"><div className="brief-section-label">Patient priorities</div><ol className="priority-list">{packet.priorities.map((priority,index)=><li key={priority}><span>{index+1}</span>{priority}</li>)}</ol></section>
          <section className="brief-section"><div className="brief-section-label">Relevant history</div><div className="history-pills">{packet.patient.conditions.map((condition)=><span key={condition}>{condition}</span>)}</div><div className="allergy-line"><strong>Allergies</strong><span>{packet.patient.allergies.join(', ')}</span></div></section>
        </div>

        {packet.reconciliation.length>0 && <section className="shared-reconciliation-section">
          <div className="brief-section-label">Source reconciliation</div>
          {packet.reconciliation.map((issue)=><div className={`shared-issue ${issue.status}`} key={issue.title}>{issue.status==='resolved'?<CheckCircle2 size={19}/>:<TriangleAlert size={19}/>}<div><strong>{issue.title}</strong><p>{issue.status==='resolved' ? issue.resolution : issue.detail}</p><div>{issue.sources.map((source)=><span key={`${issue.title}-${source.label}`}><b>{source.label}</b>{source.value}</span>)}</div></div></div>)}
        </section>}

        <div className="brief-columns lower">
          <section className="brief-section"><div className="brief-section-label"><Pill size={15}/> Current medications</div><div className="shared-med-list">{packet.medications.map((medication)=><div className={medication.status} key={`${medication.name}-${medication.strength}`}><span><strong>{medication.name}</strong><small>{medication.strength}{medication.directions?` · ${medication.directions}`:''}</small></span><em>{medication.status==='confirmed'?'Confirmed':medication.status==='conflict'?'Conflict':'Review'}</em></div>)}</div></section>
          <section className="brief-section"><div className="brief-section-label"><TestTube2 size={15}/> Relevant results</div><div className="shared-result-list">{packet.labs.map((lab)=><div key={`${lab.test}-${lab.eventDate}`}><span><strong>{lab.test}</strong><small>{formatDate(lab.eventDate)}</small></span><b>{lab.value} {lab.unit}</b><em>{lab.abnormalFlag}</em>{lab.trend&&<small>{lab.trend}</small>}</div>)}</div></section>
        </div>

        <section className="brief-section full"><div className="brief-section-label">Relevant timeline</div><div className="brief-timeline">{packet.timeline.map((event)=><div key={event.id}><time>{event.displayDate}</time><span/><div><strong>{event.title}</strong><p>{event.summary}</p><small className={`shared-source-status ${event.sourceType}`}>{sourceStatusLabel(event.sourceType)}</small></div></div>)}</div></section>

        <section className="brief-section full next-actions-section"><div className="brief-section-label"><ListChecks size={15}/> Open next actions</div>{packet.openTasks.length?<div className="brief-task-grid">{packet.openTasks.map((task)=><div key={`${task.title}-${task.detail}`}><ListChecks size={16}/><span><strong>{task.title}</strong><small>{task.detail}{task.dueLabel?` · ${task.dueLabel}`:''}</small></span></div>)}</div>:<p className="brief-empty-state">No open follow-up tasks were included.</p>}</section>

        <section className="shared-sources-section"><div className="brief-section-label"><FileText size={15}/> Source summaries</div><p>Open a source summary to review the provenance included by the patient.</p><div>{packet.sources.map((source)=><details key={source.id}><summary><span><strong>{source.title}</strong><small>{source.subtitle}</small></span><em>{source.type}</em></summary><p>{source.excerpt}</p><dl>{source.details.map((detail,index)=><div className={detail.highlight?'highlight':''} key={`${detail.label}-${index}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl></details>)}</div></section>

        <footer className="brief-footer"><div><ShieldCheck size={17}/><span>{packet.disclaimer}</span></div><p>Vital Passport does not diagnose or replace professional medical care.</p></footer>
      </article>
    </main>
  </div>
}
