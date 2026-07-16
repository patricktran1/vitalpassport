import { ArrowUpFromLine, Check, ChevronRight, Download, ExternalLink, FileText, ListChecks, PencilLine, Printer, QrCode, Share2, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShareBriefModal } from '../components/ShareBriefModal'
import { StatusBadge } from '../components/StatusBadge'
import { usePatientProfile } from '../context/PatientProfileContext'
import { useVital } from '../context/VitalContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { buildSharedBriefPacket } from '../lib/briefPacket'
import { formatPatientDob, profileDisplayName } from '../lib/patientProfile'

function parsePriorities(value: string, demo: boolean) {
  const source = value || (demo ? 'Could my medication be contributing to the dizziness? Do I need additional testing? What symptoms should make me seek urgent care?' : '')
  return source.split(/\n|\?\s+/).map((item)=>item.trim()).filter(Boolean).map((item)=>item.endsWith('?')?item:`${item}?`).slice(0,3)
}

function safeFileName(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'') || 'Patient'
}

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
  const { profile, age } = usePatientProfile()
  const workspace = useWorkspace()
  const [shareOpen,setShareOpen]=useState(false)
  const [shareMode,setShareMode]=useState<'link'|'qr'>('link')
  const priorities=parsePriorities(answers.priorities,workspace.isDemo)
  const primaryIssue=[...reconciliationIssues].sort((a,b)=>a.status===b.status?b.createdAt.localeCompare(a.createdAt):a.status==='open'?-1:1)[0]
  const conflictResolved=primaryIssue?.status==='resolved'
  const selectedTimeline=[...timelineEvents].sort((a,b)=>a.date.localeCompare(b.date)).slice(-7)
  const latestEvent=selectedTimeline[selectedTimeline.length-1]
  const reason=workspace.isDemo
    ? 'Dizziness and fatigue beginning around June 20, with a possible temporal overlap with a metoprolol dose change.'
    : latestEvent?.summary || (sources.length ? `${sources.length} patient-confirmed ${sources.length===1?'source has':'sources have'} been organized for clinical review.` : 'No confirmed health information has been added yet.')
  const reasonSource=latestEvent?.sourceId ? sources.find((source)=>source.id===latestEvent.sourceId) : sources[0]
  const openTasks=careTasks.filter((task)=>task.status==='open')
  const profileComplete=Boolean(profile.name)
  const readyToShare=profileComplete&&sources.length>0&&openGapCount===0&&openReconciliationCount===0
  const preparedDate=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date())
  const patientLine=[age!==null?`${age} years old`:'',profile.dob?`DOB ${formatPatientDob(profile.dob)}`:'',profile.pronouns].filter(Boolean).join(' · ')

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
    profile,
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
  }),[profile,answers,readiness,openGapCount,resolvedCount,openReconciliationCount,medicationSummaries,labResults,reconciliationIssues,careTasks,sources,timelineEvents])

  const downloadBrief=()=>{
    const medicationText=medicationSummaries.map((medication)=>`- ${medication.name}: ${medication.strength}${medication.directions?` · ${medication.directions}`:''} [${medication.status}]`).join('\n')||'- No confirmed medications.'
    const labText=latestLabs.map((lab)=>`- ${lab.test}: ${lab.value} ${lab.unit} ${lab.abnormalFlag}${lab.trend?` (${lab.trend})`:''}`).join('\n')||'- No confirmed laboratory results.'
    const issueText=reconciliationIssues.map((issue)=>`- ${issue.title}: ${issue.status==='resolved'?issue.resolution:issue.detail}`).join('\n')||'- No active medication conflicts detected.'
    const taskText=openTasks.map((task)=>`- ${task.title}: ${task.detail}`).join('\n')||'- No open follow-up tasks.'
    const priorityText=priorities.length?priorities.map((priority,index)=>`${index+1}. ${priority}`).join('\n'):'- No visit priorities added.'
    const text=`VITAL PASSPORT CLINICIAN BRIEF\n\nPatient: ${profile.name||'Profile incomplete'}${patientLine?` · ${patientLine}`:''}\nSummary: ${reason}\n\nPATIENT PRIORITIES\n${priorityText}\n\nCURRENT MEDICATIONS\n${medicationText}\n\nRECONCILIATION\n${issueText}\n\nRELEVANT RESULTS\n${labText}\n\nOPEN NEXT ACTIONS\n${taskText}\n\nThis patient-controlled summary organizes source-linked information. Verify against original records before clinical use.`
    const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${safeFileName(profile.name)}-Vital-Passport-Brief.txt`; a.click(); URL.revokeObjectURL(url)
  }

  const openSharing=(mode:'link'|'qr')=>{setShareMode(mode);setShareOpen(true)}

  return <div className="page brief-page">
    <section className="page-heading split-heading"><div><div className="eyebrow">Clinician-ready handoff</div><h1>Visit brief</h1><p>A concise, source-linked summary generated from the reconciled patient record.</p></div><div className={`readiness-chip ${readyToShare?'complete':''}`}><ShieldCheck size={18}/><span><strong>{!profileComplete?'Profile needed':readyToShare?'Ready to share':`${readiness}% ready`}</strong> · Patient controlled</span></div></section>

    {!profileComplete&&<section className="profile-setup-card no-print"><div><strong>Add the patient name before sharing</strong><span>The brief will never substitute a demo identity for an incomplete personal profile.</span></div><Link className="button ghost" to="/profile"><UserRound size={16}/> Edit profile</Link></section>}

    <div className="brief-toolbar no-print">
      <button className="button ghost" disabled={!profileComplete||!sources.length} onClick={()=>openSharing('link')}><Share2 size={16}/> Share clinic link</button>
      <button className="button ghost" disabled={!profileComplete||!sources.length} onClick={()=>openSharing('qr')}><QrCode size={16}/> Visit QR code</button>
      <Link className="button ghost transfer-link" to="/transfer"><ArrowUpFromLine size={16}/> Export packet</Link>
      <button className="button ghost" onClick={downloadBrief}><Download size={16}/> Quick text</button>
      <button className="button ghost" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    </div>

    <article className="clinical-brief">
      <header className="brief-header">
        <div><div className="brief-brand">VITAL PASSPORT</div><h2>{profileDisplayName(profile)}</h2><p>{patientLine||'Name and demographic details have not been completed.'}</p></div>
        <div className="brief-meta"><span>Prepared {preparedDate}</span><strong>Patient-controlled clinical handoff</strong></div>
      </header>

      <section className={`brief-verification ${readyToShare?'complete':''}`}>
        <div><ShieldCheck size={19}/><span><strong>{resolvedCount} of 4 interview details confirmed</strong><small>{!profileComplete?'The patient profile needs a name before sharing.':openReconciliationCount?`${openReconciliationCount} source conflict ${openReconciliationCount===1?'remains':'remain'} unresolved.`:openGapCount?`${openGapCount} patient detail ${openGapCount===1?'still needs':'details still need'} review.`:'The patient interview and source reconciliation are complete.'}</small></span></div>
        <Link to={!profileComplete?'/profile':openReconciliationCount?'/':'/prepare'}>{!profileComplete?'Complete profile':openReconciliationCount?'Open reconciliation center':openGapCount?'Finish interview':'Review record'} <ChevronRight size={14}/></Link>
      </section>

      <section className="brief-highlight">
        <div className="section-number">01</div><div><div className="brief-section-label">Summary for visit</div><h3>{reason}</h3>{reasonSource&&<div className="inline-tags"><StatusBadge type="patient" label="Patient confirmed"/><button className="source-link" onClick={()=>openSource(reasonSource)}><FileText size={14}/> View source</button></div>}</div>
      </section>

      <div className="brief-columns">
        <section className="brief-section"><div className="brief-section-label">Patient priorities</div>{priorities.length?<ol className="priority-list">{priorities.map((priority,index)=><li key={priority}><span>{index+1}</span>{priority}</li>)}</ol>:<p className="brief-empty-state">No visit priorities have been added.</p>}</section>
        <section className="brief-section"><div className="brief-section-label">Relevant history</div>{profile.conditions.length?<div className="history-pills">{profile.conditions.map((condition)=><span key={condition}>{condition}</span>)}</div>:<p className="brief-empty-state">No conditions added.</p>}<div className="allergy-line"><strong>Allergies</strong><span>{profile.allergies.length?profile.allergies.join(', '):'Not entered'}</span></div></section>
      </div>

      {primaryIssue?<section className={`conflict-panel ${conflictResolved?'resolved':''}`}>
        {conflictResolved?<Check size={22}/>:<TriangleAlert size={22}/>}<div><div className="brief-section-label">{conflictResolved?'Medication discrepancy reconciled':'Important medication discrepancy'}</div><h3>{conflictResolved?primaryIssue.resolution:primaryIssue.title}</h3><div className="conflict-compare">{primaryIssue.sources.slice(0,2).map((issueSource,index)=>{const source=sources.find((candidate)=>candidate.id===issueSource.sourceId);return <span className="conflict-source-wrap" key={issueSource.recordId}>{index===1&&<div className="versus">VS</div>}<button onClick={()=>source&&openSource(source)}><span>{issueSource.label}</span><strong>{issueSource.value}</strong><ExternalLink size={14}/></button></span>})}</div><p className="resolution"><Check size={15}/> Status: <strong>{primaryIssue.status==='resolved'?'Patient reconciled':'Patient confirmation pending'}</strong></p></div>
      </section>:<section className="conflict-panel resolved"><Check size={22}/><div><div className="brief-section-label">Medication reconciliation</div><h3>No active medication conflicts were detected.</h3></div></section>}

      <section className="brief-section full"><div className="brief-section-label">Relevant timeline</div>{selectedTimeline.length?<div className="brief-timeline">{selectedTimeline.map((event)=>{const source=sources.find((candidate)=>candidate.id===event.sourceId);return <div key={event.id}><time>{event.displayDate}</time><span/><div><strong>{event.title}</strong><p>{event.summary}</p>{source&&<button className="source-link" onClick={()=>openSource(source)}>View source <ChevronRight size={13}/></button>}</div></div>})}</div>:<p className="brief-empty-state">No confirmed timeline events yet.</p>}</section>

      <div className="brief-columns lower">
        <section className="brief-section"><div className="brief-section-label">Current medications</div>{medicationSummaries.length?<div className="brief-med-list">{medicationSummaries.map((medication)=>{const source=sources.find((candidate)=>medication.sourceIds.includes(candidate.id));const statusType=medication.status==='conflict'?'conflict':medication.status==='needs_review'?'unverified':'verified';return <button key={medication.canonicalName} onClick={()=>source&&openSource(source)}><div><strong>{medication.name}</strong><span>{medication.status==='conflict'?medication.strength:[medication.strength,medication.directions].filter(Boolean).join(' · ')}</span><small>{medication.sourceCount} linked {medication.sourceCount===1?'source':'sources'}</small></div><StatusBadge type={statusType} label={medication.status==='conflict'?'Conflict':medication.status==='needs_review'?'Review':'Confirmed'}/></button>})}</div>:<p className="brief-empty-state">No confirmed medications.</p>}</section>
        <section className="brief-section"><div className="brief-section-label">Relevant results</div>{latestLabs.length?<div className="result-grid dynamic">{latestLabs.map((lab)=>{const source=sources.find((candidate)=>candidate.id===lab.sourceId);return <button key={lab.id} onClick={()=>source&&openSource(source)}><span>{lab.test}</span><strong>{lab.value}</strong><small>{[lab.unit,lab.abnormalFlag].filter(Boolean).join(' · ')}</small>{lab.trend&&<em>{lab.trend}</em>}</button>})}</div>:<p className="brief-empty-state">No confirmed laboratory results.</p>}</section>
      </div>

      <section className="brief-section full next-actions-section"><div className="brief-section-label">Open next actions</div>{openTasks.length?<div className="brief-task-grid">{openTasks.slice(0,6).map((task)=><div key={task.id}><ListChecks size={16}/><span><strong>{task.title}</strong><small>{task.detail}</small></span></div>)}</div>:<p className="brief-empty-state">No open follow-up tasks remain.</p>}</section>

      <footer className="brief-footer"><div><ShieldCheck size={17}/><span>Patient-controlled summary · Every structured statement retains source provenance.</span></div><p>Vital Passport organizes patient-provided information. It does not diagnose or replace professional medical care.</p></footer>
    </article>

    <Link to="/profile" className="floating-edit no-print"><PencilLine size={16}/> Edit patient profile</Link>
    {shareOpen&&<ShareBriefModal packet={sharePacket} initialMode={shareMode} onClose={()=>setShareOpen(false)}/>} 
  </div>
}
