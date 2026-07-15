import { ArrowRight, CalendarClock, CheckCircle2, ChevronRight, CircleCheck, CircleDashed, FileText, GitCompareArrows, HeartPulse, ListChecks, Pill, ScanSearch, Sparkles, TestTube2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressRing } from '../components/ProgressRing'
import { useVital } from '../context/VitalContext'
import { patient } from '../data/demo'

const uploadIcons = { medication: Pill, document: FileText, lab: TestTube2, voice: FileText, symptom: HeartPulse, question: FileText, photo: FileText }

export function Dashboard() {
  const {
    readiness,
    uploads,
    reviewGaps,
    openGapCount,
    resolvedCount,
    reconciliationIssues,
    openReconciliationCount,
    resolveReconciliation,
    careTasks,
    toggleTask,
    medicationSummaries,
    timelineEvents,
  } = useVital()
  const openTasks=careTasks.filter((task)=>task.status==='open')
  const metoprololIssue=reconciliationIssues.find((issue)=>issue.id==='issue-metoprolol')
  const displayedIssues=[...reconciliationIssues].sort((a,b)=>a.status===b.status?b.createdAt.localeCompare(a.createdAt):a.status==='open'?-1:1).slice(0,3)

  return (
    <div className="page dashboard-page">
      <section className="page-heading split-heading">
        <div><div className="eyebrow">Tuesday, July 14</div><h1>Good afternoon, {patient.firstName}.</h1><p>Your next visit is four days away. Let’s make sure your story is ready.</p></div>
        <Link className="button ghost desktop-only" to="/add">Add health information</Link>
      </section>

      <section className="hero-card">
        <div className="hero-copy">
          <div className="appointment-pill"><CalendarClock size={16}/> Upcoming appointment</div>
          <h2>Primary care with Dr. Jordan Kim</h2>
          <p>Saturday, July 18 · 10:30 AM<br/>Bayview Medical Group · Oakland</p>
          <div className="hero-actions">
            <Link to="/prepare" className="button primary">{openGapCount ? 'Continue visit preparation' : 'Review completed brief'} <ArrowRight size={17}/></Link>
            <Link to="/brief" className="button light">Preview clinician brief</Link>
          </div>
        </div>
        <div className="readiness-panel">
          <ProgressRing value={readiness}/>
          <div><strong>{openGapCount || openReconciliationCount ? 'Your visit brief is taking shape' : 'Your visit brief is ready'}</strong><span>{openReconciliationCount ? `${openReconciliationCount} clinical ${openReconciliationCount===1?'conflict needs':'conflicts need'} reconciliation.` : openGapCount ? `${openGapCount} patient ${openGapCount===1?'detail needs':'details need'} confirmation.` : 'The patient-controlled story is ready to share.'}</span></div>
        </div>
      </section>

      <section className="reconciliation-center">
        <div className="reconciliation-header">
          <span className="agent-review-icon"><GitCompareArrows size={22}/></span>
          <div><div className="eyebrow">Clinical reconciliation engine</div><h2>One record, every source preserved.</h2><p>Vital Passport compares newly confirmed facts with the existing patient record, flags contradictions, and turns documented follow-up into actionable tasks.</p></div>
          <div className="reconciliation-stats"><div><strong>{openReconciliationCount}</strong><span>open conflicts</span></div><div><strong>{openTasks.length}</strong><span>open tasks</span></div><div><strong>{medicationSummaries.length}</strong><span>medications</span></div></div>
        </div>

        <div className="reconciliation-layout">
          <div className="issue-stack">
            <div className="section-mini-heading"><GitCompareArrows size={17}/><strong>Source conflicts</strong><span>Choose the instructions the patient is currently following.</span></div>
            {displayedIssues.length===0&&<div className="empty-reconciliation"><CircleCheck size={20}/><div><strong>No unresolved conflicts</strong><span>New uploads will be checked automatically.</span></div></div>}
            {displayedIssues.map((issue)=><article className={`reconciliation-issue ${issue.status}`} key={issue.id}>
              <div className="issue-title-row"><span className={issue.status==='open'?'issue-alert':'issue-resolved'}>{issue.status==='open'?<GitCompareArrows size={17}/>:<CircleCheck size={17}/>}</span><div><strong>{issue.title}</strong><p>{issue.status==='resolved'?issue.resolution:issue.detail}</p></div><small>{issue.status==='open'?'Needs patient confirmation':'Reconciled'}</small></div>
              {issue.status==='open'&&<><div className="issue-question">{issue.question}</div><div className="source-choice-grid">{issue.sources.map((source)=><button key={source.recordId} onClick={()=>resolveReconciliation(issue.id,source.recordId)}><span>{source.label}</span><strong>{source.value}</strong><small>Confirm this version</small></button>)}</div></>}
              {issue.status==='resolved'&&<div className="resolved-note"><CheckCircle2 size={15}/><span>The unselected source remains in the audit trail as superseded information.</span></div>}
            </article>)}
          </div>

          <div className="task-stack">
            <div className="section-mini-heading"><ListChecks size={17}/><strong>Next actions</strong><span>Generated from source instructions, abnormal results, and conflicts.</span></div>
            <div className="care-task-list">
              {careTasks.slice(0,6).map((task)=><button className={`care-task ${task.status}`} key={task.id} onClick={()=>toggleTask(task.id)}>
                {task.status==='done'?<CircleCheck size={18}/>:<CircleDashed size={18}/>}<span><strong>{task.title}</strong><small>{task.detail}</small>{task.dueLabel&&<em>{task.dueLabel}</em>}</span>
              </button>)}
            </div>
          </div>
        </div>
      </section>

      <section className="agent-review-card">
        <div className="agent-review-intro">
          <span className="agent-review-icon"><ScanSearch size={22}/></span>
          <div>
            <div className="eyebrow">Patient interview</div>
            <h2>Vital Passport found four patient-reported details worth clarifying.</h2>
            <p>Clinical reconciliation handles source conflicts. The guided interview fills the context that documents cannot provide.</p>
          </div>
          <div className="agent-review-score"><strong>{resolvedCount}/4</strong><span>confirmed</span></div>
        </div>
        <div className="review-gap-grid">
          {reviewGaps.map((gap) => (
            <div className={`review-gap ${gap.resolved ? 'resolved' : 'open'}`} key={gap.key}>
              {gap.resolved ? <CircleCheck size={18}/> : <CircleDashed size={18}/>} 
              <div><strong>{gap.label}</strong><p>{gap.detail}</p><span>{gap.source}</span></div>
            </div>
          ))}
        </div>
        <div className="agent-review-action">
          <span>{openGapCount ? `Resolve ${openGapCount} remaining ${openGapCount === 1 ? 'gap' : 'gaps'} in a guided interview.` : 'The patient-confirmed context is ready for clinician review.'}</span>
          <Link to={openGapCount ? '/prepare' : '/brief'} className="button primary">{openGapCount ? 'Review findings' : 'Open clinician brief'} <ChevronRight size={16}/></Link>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card active-concern-card">
          <div className="card-heading"><div><div className="eyebrow">Active concern</div><h2>Dizziness and fatigue</h2></div><span className="soft-icon"><HeartPulse size={20}/></span></div>
          <p>Symptoms started around June 20 and may overlap with a medication change.</p>
          <div className="finding-list">
            <div><CheckCircle2 size={17}/><span>Urgent care summary added</span></div>
            <div><CheckCircle2 size={17}/><span>Lab report reviewed</span></div>
            <div className={metoprololIssue?.status==='resolved' ? '' : 'attention'}><Sparkles size={17}/><span>{metoprololIssue?.status==='resolved' ? 'Metoprolol discrepancy reconciled' : 'Metoprolol instructions need confirmation'}</span></div>
          </div>
          <Link to="/prepare" className="text-link">Continue preparation <ChevronRight size={16}/></Link>
        </section>

        <section className="card recent-card">
          <div className="card-heading"><div><div className="eyebrow">Recent</div><h2>Health uploads</h2></div><Link to="/add" className="text-link">Add new</Link></div>
          <div className="upload-list">
            {uploads.slice(0,3).map((upload) => { const Icon = uploadIcons[upload.type]; return <div className="upload-row" key={upload.id}><div className="source-icon"><Icon size={18}/></div><div><strong>{upload.name}</strong><span>{upload.summary}</span></div><small>{upload.date}</small></div> })}
          </div>
        </section>
      </div>

      <section className="card timeline-preview">
        <div className="card-heading"><div><div className="eyebrow">Your health story</div><h2>Recent timeline</h2></div><Link to="/timeline" className="text-link">View full timeline <ChevronRight size={16}/></Link></div>
        <div className="mini-timeline">
          {timelineEvents.slice(-4).map((event) => <div key={event.id} className="mini-event"><div className="mini-date">{event.displayDate}</div><span className={`timeline-dot ${event.category}`}/><div><strong>{event.title}</strong><p>{event.summary}</p></div></div>)}
        </div>
      </section>
    </div>
  )
}
