import { ArrowUpFromLine, Check, ChevronRight, Download, ExternalLink, FileText, ListChecks, PencilLine, Printer, QrCode, Share2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShareBriefModal } from '../components/ShareBriefModal'
import { StatusBadge } from '../components/StatusBadge'
import { useVital } from '../context/VitalContext'
import { patient } from '../data/demo'
import { buildSharedBriefPacket } from '../lib/briefPacket'

export function Brief() {
  const {
    answers,
    openSource,
    readiness,
    openGapCount,
    resolvedCount,
    medicationSummaries,
    labResults,
    reconciliationIssues,
    openReconciliationCount,
    careTasks,
    sources,
    timelineEvents,
  } = useVital()
  const [shareOpen,setShareOpen]=useState(false)
  const [shareMode,setShareMode]=useState<'link'|'qr'>('link')
  const priorities=(answers.priorities || 'Could my medication be contributing to the dizziness? Do I need additional testing? What symptoms should make me seek urgent care?').split(/\n|\?\s+/).filter(Boolean).map((p)=>p.trim()+(p.trim().endsWith('?')?'':'?')).slice(0,3)
  const timingContext=answers.timing ? ` Patient reports the dizziness began ${answers.timing.toLowerCase()}.` : ''
  const positionalContext=answers.positional ? ` Standing trigger: ${answers.positional.toLowerCase()}.` : ''
  const primaryIssue=[...reconciliationIssues].sort((a,b)=>a.status===b.status?b.createdAt.localeCompare(a.createdAt):a.status==='open'?-1:1)[0]
  const conflictResolved=primaryIssue?.status==='resolved'
  const selectedTimeline=timelineEvents.filter((event)=>event.date<='2026-07-18').slice(-7)
  const openTasks=careTasks.filter((task)=>task.status==='open')
  const readyToShare=openGapCount===0&&openReconciliationCount===0

  const latestLabs=useMemo(()=>{
    const latest=new Map<string,typeof labResults[number]>()
    ;[...labResults].sort((a,b)=>b.eventDate.localeCompare(a.eventDate)).forEach((lab)=>{if(!latest.has(lab.canonicalTest))latest.set(lab.canonicalTest,lab)})
    return [...latest.values()].sort((a,b)=>{
      const aAbnormal=a.abnormalFlag&&!/normal|within|negative/i.test(a.abnormalFlag)?1:0
      const bAbnormal=b.abnormalFlag&&!/normal|within|negative/i.test(b.abnormalFlag)?1:0
      return bAbnormal-aAbnormal
    }).slice(0,4)
  },[labResults])

  const sharePacket=useMemo(()=>buildSharedBriefPacket({
    answers,
    readiness,
    openGapCount,
    resolvedCount,
    openReconciliationCount,
    medicationSummaries,
    labResults,
    reconciliationIssues,
    careTasks,
    sources,
    timelineEvents,
  }),[answers,readiness,openGapCount,resolvedCount,openReconciliationCount,medicationSummaries,labResults,reconciliationIssues,careTasks,sources,timelineEvents])

  const downloadBrief=()=>{
    const medicationText=medicationSummaries.map((medication)=>`- ${medication.name}: ${medication.strength}${medication.directions?` · ${medication.directions}`:''} [${medication.status}]`).join('\n')
    const labText=latestLabs.map((lab)=>`- ${lab.test}: ${lab.value} ${lab.unit} ${lab.abnormalFlag}${lab.trend?` (${lab.trend})`:''}`).join('\n')
    const issueText=reconciliationIssues.map((issue)=>`- ${issue.title}: ${issue.status==='resolved'?issue.resolution:issue.detail}`).join('\n')||'- No medication conflicts detected.'
    const taskText=openTasks.map((task)=>`- ${task.title}: ${task.detail}`).join('\n')||'- No open follow-up tasks.'
    const text=`VITAL PASSPORT CLINICIAN BRIEF\n\nPatient: ${patient.name}, age ${patient.age}\nReason for visit: Dizziness and fatigue beginning around June 20, 2026.${timingContext}${positionalContext}\n\nPATIENT PRIORITIES\n${priorities.map((p,i)=>`${i+1}. ${p}`).join('\n')}\n\nCURRENT MEDICATIONS\n${medicationText}\n\nRECONCILIATION\n${issueText}\n\nRELEVANT RESULTS\n${labText}\n\nOPEN NEXT ACTIONS\n${taskText}\n\nThis patient-controlled summary organizes source-linked information. Verify against original records before clinical use.`
    const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='Maria-Santos-Vital-Passport-Brief.txt'; a.click(); URL.revokeObjectURL(url)
  }

  const openSharing=(mode:'link'|'qr')=>{setShareMode(mode);setShareOpen(true)}

  return <div className="page brief-page">
    <section className="page-heading split-heading"><div><div className="eyebrow">Clinician-ready handoff</div><h1>Visit brief</h1><p>A concise, source-linked summary generated from the reconciled patient record.</p></div><div className={`readiness-chip ${readyToShare?'complete':''}`}><ShieldCheck size={18}/><span><strong>{readyToShare?'Ready to share':`${readiness}% ready`}</strong> · Patient controlled</span></div></section>

    <div className="brief-toolbar no-print">
      <button className="button ghost" onClick={()=>openSharing('link')}><Share2 size={16}/> Share clinic link</button>
      <button className="button ghost" onClick={()=>openSharing('qr')}><QrCode size={16}/> Visit QR code</button>
      <Link className="button ghost transfer-link" to="/transfer"><ArrowUpFromLine size={16}/> Export packet</Link>
      <button className="button ghost" onClick={downloadBrief}><Download size={16}/> Quick text</button>
      <button className="button ghost" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    </div>

    <article className="clinical-brief">
      <header className="brief-header">
        <div><div className="brief-brand">VITAL PASSPORT</div><h2>{patient.name}</h2><p>{patient.age} years old · DOB {patient.dob} · {patient.pronouns}</p></div>
        <div className="brief-meta"><span>Prepared July 14, 2026</span><strong>For primary care visit</strong></div>
      </header>

      <section className={`brief-verification ${readyToShare?'complete':''}`}>
        <div><ShieldCheck size={19}/><span><strong>{resolvedCount} of 4 interview details confirmed</strong><small>{openReconciliationCount ? `${openReconciliationCount} source conflict ${openReconciliationCount===1?'remains':'remain'} unresolved.` : openGapCount ? `${openGapCount} patient detail ${openGapCount===1?'still needs':'details still need'} review.` : 'The patient interview and source reconciliation are complete.'}</small></span></div>
        <Link to={openReconciliationCount?'/':'/prepare'}>{openReconciliationCount?'Open reconciliation center':openGapCount?'Finish interview':'Review record'} <ChevronRight size={14}/></Link>
      </section>

      <section className="brief-highlight">
        <div className="section-number">01</div><div><div className="brief-section-label">Reason for visit</div><h3>Dizziness and fatigue beginning around June 20, with a possible temporal overlap with a metoprolol dose change.{timingContext}{positionalContext}</h3><div className="inline-tags"><StatusBadge type="patient" label="Patient reported"/><button className="source-link" onClick={()=>openSource(sources.find((source)=>source.id==='src-voice') || sources[0])}><FileText size={14}/> Voice note</button></div></div>
      </section>

      <div className="brief-columns">
        <section className="brief-section"><div className="brief-section-label">Patient priorities</div><ol className="priority-list">{priorities.map((p,i)=><li key={i}><span>{i+1}</span>{p}</li>)}</ol></section>
        <section className="brief-section"><div className="brief-section-label">Relevant history</div><div className="history-pills">{patient.conditions.map(c=><span key={c}>{c}</span>)}</div><div className="allergy-line"><strong>Allergies</strong><span>{patient.allergies.join(', ')}</span></div></section>
      </div>

      {primaryIssue?<section className={`conflict-panel ${conflictResolved?'resolved':''}`}>
        {conflictResolved?<Check size={22}/>:<TriangleAlert size={22}/>}<div><div className="brief-section-label">{conflictResolved?'Medication discrepancy reconciled':'Important medication discrepancy'}</div><h3>{conflictResolved?primaryIssue.resolution:primaryIssue.title}</h3><div className="conflict-compare">{primaryIssue.sources.slice(0,2).map((issueSource,index)=>{const source=sources.find((candidate)=>candidate.id===issueSource.sourceId);return <span className="conflict-source-wrap" key={issueSource.recordId}>{index===1&&<div className="versus">VS</div>}<button onClick={()=>source&&openSource(source)}><span>{issueSource.label}</span><strong>{issueSource.value}</strong><ExternalLink size={14}/></button></span>})}</div><p className="resolution"><Check size={15}/> Status: <strong>{primaryIssue.status==='resolved'?'Patient reconciled':'Patient confirmation pending'}</strong></p></div>
      </section>:<section className="conflict-panel resolved"><Check size={22}/><div><div className="brief-section-label">Medication reconciliation</div><h3>No active medication conflicts were detected.</h3></div></section>}

      <section className="brief-section full"><div className="brief-section-label">Relevant timeline</div><div className="brief-timeline">{selectedTimeline.map(event=>{const source=sources.find(s=>s.id===event.sourceId);return <div key={event.id}><time>{event.displayDate}</time><span/><div><strong>{event.title}</strong><p>{event.summary}</p>{source&&<button className="source-link" onClick={()=>openSource(source)}>View source <ChevronRight size={13}/></button>}</div></div>})}</div></section>

      <div className="brief-columns lower">
        <section className="brief-section"><div className="brief-section-label">Current medications</div><div className="brief-med-list">{medicationSummaries.map((medication)=>{const source=sources.find((candidate)=>medication.sourceIds.includes(candidate.id));const statusType=medication.status==='conflict'?'conflict':medication.status==='needs_review'?'unverified':'verified';return <button key={medication.canonicalName} onClick={()=>source&&openSource(source)}><div><strong>{medication.name}</strong><span>{medication.status==='conflict'?medication.strength:[medication.strength,medication.directions].filter(Boolean).join(' · ')}</span><small>{medication.sourceCount} linked {medication.sourceCount===1?'source':'sources'}</small></div><StatusBadge type={statusType} label={medication.status==='conflict'?'Conflict':medication.status==='needs_review'?'Review':'Confirmed'}/></button>})}</div></section>
        <section className="brief-section"><div className="brief-section-label">Relevant results</div><div className="result-grid dynamic">{latestLabs.map((lab)=>{const source=sources.find((candidate)=>candidate.id===lab.sourceId);return <button key={lab.id} onClick={()=>source&&openSource(source)}><span>{lab.test}</span><strong>{lab.value}</strong><small>{[lab.unit,lab.abnormalFlag].filter(Boolean).join(' · ')}</small>{lab.trend&&<em>{lab.trend}</em>}</button>})}</div></section>
      </div>

      <section className="brief-section full next-actions-section"><div className="brief-section-label">Open next actions</div>{openTasks.length?<div className="brief-task-grid">{openTasks.slice(0,6).map((task)=><div key={task.id}><ListChecks size={16}/><span><strong>{task.title}</strong><small>{task.detail}</small></span></div>)}</div>:<p className="brief-empty-state">No open follow-up tasks remain.</p>}</section>

      <footer className="brief-footer"><div><ShieldCheck size={17}/><span>Patient-controlled summary · Every structured statement retains source provenance.</span></div><p>Vital Passport organizes patient-provided information. It does not diagnose or replace professional medical care.</p></footer>
    </article>

    <Link to="/" className="floating-edit no-print"><PencilLine size={16}/> Edit reconciled record</Link>
    {shareOpen&&<ShareBriefModal packet={sharePacket} initialMode={shareMode} onClose={()=>setShareOpen(false)}/>} 
  </div>
}