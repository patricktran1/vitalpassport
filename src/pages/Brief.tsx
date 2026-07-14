import { Check, ChevronRight, Download, ExternalLink, FileText, Link2, PencilLine, Printer, QrCode, Share2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useVital } from '../context/VitalContext'
import { medications, patient, sources, timeline } from '../data/demo'

export function Brief() {
  const { answers, openSource, readiness, openGapCount, resolvedCount, reviewGaps } = useVital()
  const [shareOpen,setShareOpen]=useState(false)
  const [qrOpen,setQrOpen]=useState(false)
  const [copied,setCopied]=useState(false)
  const shareUrl='https://vitalpassport.com/s/demo-maria-72h'
  const priorities=(answers.priorities || 'Could my medication be contributing to the dizziness? Do I need additional testing? What symptoms should make me seek urgent care?').split(/\n|\?\s+/).filter(Boolean).map((p)=>p.trim()+(p.trim().endsWith('?')?'':'?')).slice(0,3)
  const selectedTimeline=timeline.filter(t=>['t1','t2','t3','t4','t6','t7'].includes(t.id))
  const conflictResolved=Boolean(reviewGaps.find((gap)=>gap.key==='dose')?.resolved)
  const timingContext=answers.timing ? ` Patient reports the dizziness began ${answers.timing.toLowerCase()}.` : ''
  const positionalContext=answers.positional ? ` Standing trigger: ${answers.positional.toLowerCase()}.` : ''

  const downloadBrief=()=>{
    const text=`VITAL PASSPORT CLINICIAN BRIEF\n\nPatient: ${patient.name}, age ${patient.age}\nReason for visit: Dizziness and fatigue beginning around June 20, 2026.${timingContext}${positionalContext}\n\nPATIENT PRIORITIES\n${priorities.map((p,i)=>`${i+1}. ${p}`).join('\n')}\n\nMEDICATION RECONCILIATION\nUrgent care summary lists metoprolol 25 mg twice daily; bottle photograph lists metoprolol succinate ER 50 mg once daily. Patient response: ${answers.dose || 'Not yet confirmed'}.\n\nRELEVANT RESULTS\nHemoglobin 10.8 g/dL (low); glucose 168 mg/dL (high); lowest recent home BP 104/66.\n\nThis patient-controlled summary organizes patient-provided and documented information. Verify against source records before clinical use.`
    const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='Maria-Santos-Vital-Passport-Brief.txt'; a.click(); URL.revokeObjectURL(url)
  }
  const copyLink=async()=>{await navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),1800)}

  return <div className="page brief-page">
    <section className="page-heading split-heading"><div><div className="eyebrow">Clinician-ready handoff</div><h1>Visit brief</h1><p>A concise, source-linked summary designed to be reviewed in under a minute.</p></div><div className={`readiness-chip ${openGapCount===0?'complete':''}`}><ShieldCheck size={18}/><span><strong>{openGapCount===0?'Ready to share':`${readiness}% ready`}</strong> · Patient controlled</span></div></section>

    <div className="brief-toolbar no-print">
      <button className="button ghost" onClick={()=>setShareOpen(true)}><Share2 size={16}/> Share secure link</button>
      <button className="button ghost" onClick={()=>setQrOpen(true)}><QrCode size={16}/> Visit QR code</button>
      <button className="button ghost" onClick={downloadBrief}><Download size={16}/> Download</button>
      <button className="button ghost" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    </div>

    <article className="clinical-brief">
      <header className="brief-header">
        <div><div className="brief-brand">VITAL PASSPORT</div><h2>{patient.name}</h2><p>{patient.age} years old · DOB {patient.dob} · {patient.pronouns}</p></div>
        <div className="brief-meta"><span>Prepared July 14, 2026</span><strong>For primary care visit</strong></div>
      </header>

      <section className={`brief-verification ${openGapCount===0?'complete':''}`}>
        <div><ShieldCheck size={19}/><span><strong>{resolvedCount} of 4 patient details confirmed</strong><small>{openGapCount ? `${openGapCount} still need patient review before the story is complete.` : 'All agent-identified gaps have been reviewed by the patient.'}</small></span></div>
        <Link to="/prepare">{openGapCount ? 'Finish review' : 'Review answers'} <ChevronRight size={14}/></Link>
      </section>

      <section className="brief-highlight">
        <div className="section-number">01</div><div><div className="brief-section-label">Reason for visit</div><h3>Dizziness and fatigue beginning around June 20, with a possible temporal overlap with a metoprolol dose change.{timingContext}{positionalContext}</h3><div className="inline-tags"><StatusBadge type="patient" label="Patient reported"/><button className="source-link" onClick={()=>openSource(sources[3])}><FileText size={14}/> Voice note</button></div></div>
      </section>

      <div className="brief-columns">
        <section className="brief-section"><div className="brief-section-label">Patient priorities</div><ol className="priority-list">{priorities.map((p,i)=><li key={i}><span>{i+1}</span>{p}</li>)}</ol></section>
        <section className="brief-section"><div className="brief-section-label">Relevant history</div><div className="history-pills">{patient.conditions.map(c=><span key={c}>{c}</span>)}</div><div className="allergy-line"><strong>Allergies</strong><span>{patient.allergies.join(', ')}</span></div></section>
      </div>

      <section className={`conflict-panel ${conflictResolved?'resolved':''}`}>
        {conflictResolved?<Check size={22}/>:<TriangleAlert size={22}/>}<div><div className="brief-section-label">{conflictResolved?'Medication discrepancy reconciled':'Important medication discrepancy'}</div><h3>{conflictResolved?'Patient confirmed the current metoprolol instructions.':'Two sources list different metoprolol instructions.'}</h3><div className="conflict-compare"><button onClick={()=>openSource(sources[0])}><span>Urgent care summary</span><strong>25 mg twice daily</strong><ExternalLink size={14}/></button><div className="versus">VS</div><button onClick={()=>openSource(sources[1])}><span>Bottle photograph</span><strong>50 mg once daily</strong><ExternalLink size={14}/></button></div><p className="resolution"><Check size={15}/> Patient response: <strong>{answers.dose || 'Not yet confirmed'}</strong></p></div>
      </section>

      <section className="brief-section full"><div className="brief-section-label">Relevant timeline</div><div className="brief-timeline">{selectedTimeline.map(event=>{const source=sources.find(s=>s.id===event.sourceId);return <div key={event.id}><time>{event.displayDate}</time><span/><div><strong>{event.title}</strong><p>{event.summary}</p>{source&&<button className="source-link" onClick={()=>openSource(source)}>View source <ChevronRight size={13}/></button>}</div></div>})}</div></section>

      <div className="brief-columns lower">
        <section className="brief-section"><div className="brief-section-label">Current medications</div><div className="brief-med-list">{medications.map(m=>{const status=m.name.toLowerCase().includes('metoprolol')&&conflictResolved?'verified':m.status;return <button key={m.name} onClick={()=>openSource(sources.find(s=>s.id===m.sourceId) || sources[0])}><div><strong>{m.name}</strong><span>{m.name.toLowerCase().includes('metoprolol')&&conflictResolved?answers.dose:`${m.dose} · ${m.frequency}`}</span></div><StatusBadge type={status==='conflict'?'conflict':'verified'} label={status==='conflict'?'Conflict':'Verified'}/></button>})}</div></section>
        <section className="brief-section"><div className="brief-section-label">Relevant results</div><div className="result-grid"><button onClick={()=>openSource(sources[2])}><span>Hemoglobin</span><strong>10.8</strong><small>g/dL · Low</small></button><button onClick={()=>openSource(sources[2])}><span>Glucose</span><strong>168</strong><small>mg/dL · High</small></button><button onClick={()=>openSource(sources[4])}><span>Lowest home BP</span><strong>104/66</strong><small>Jul 12 · 8:10 AM</small></button></div></section>
      </div>

      <footer className="brief-footer"><div><ShieldCheck size={17}/><span>Patient-controlled summary · Statements retain their source and verification status.</span></div><p>Vital Passport organizes patient-provided information. It does not diagnose or replace professional medical care.</p></footer>
    </article>

    <Link to="/prepare" className="floating-edit no-print"><PencilLine size={16}/> Edit patient-confirmed details</Link>

    {shareOpen&&<Modal title="Share clinician brief" onClose={()=>setShareOpen(false)}><p className="modal-copy">Create a temporary, view-only link for the clinic. This demo link expires after 72 hours.</p><div className="share-link-box"><Link2 size={18}/><span>{shareUrl}</span><button onClick={copyLink}>{copied?'Copied':'Copy'}</button></div><div className="share-settings"><div><strong>Expires</strong><span>72 hours after first access</span></div><div><strong>Access</strong><span>View-only clinician brief and sources</span></div></div><button className="button primary full" onClick={copyLink}>{copied?<><Check size={17}/> Link copied</>:<>Create secure link</>}</button></Modal>}
    {qrOpen&&<Modal title="Visit QR code" onClose={()=>setQrOpen(false)}><div className="qr-panel"><QRCodeSVG value={shareUrl} size={210} bgColor="#ffffff" fgColor="#173a3a" level="M"/><h3>Scan at check-in</h3><p>Opens a temporary, read-only version of Maria’s clinician brief.</p></div></Modal>}
  </div>
}
