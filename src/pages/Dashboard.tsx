import { ArrowRight, CalendarClock, CheckCircle2, ChevronRight, CircleCheck, CircleDashed, FileText, HeartPulse, Pill, ScanSearch, Sparkles, TestTube2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressRing } from '../components/ProgressRing'
import { useVital } from '../context/VitalContext'
import { patient, timeline } from '../data/demo'

const uploadIcons = { medication: Pill, document: FileText, lab: TestTube2, voice: FileText, symptom: HeartPulse, question: FileText, photo: FileText }

export function Dashboard() {
  const { readiness, uploads, reviewGaps, openGapCount, resolvedCount } = useVital()

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
          <div><strong>{openGapCount ? 'Your visit brief is taking shape' : 'Your visit brief is ready'}</strong><span>{openGapCount ? `${openGapCount} important ${openGapCount === 1 ? 'detail still needs' : 'details still need'} your confirmation.` : 'All four patient-confirmed details are complete.'}</span></div>
        </div>
      </section>

      <section className="agent-review-card">
        <div className="agent-review-intro">
          <span className="agent-review-icon"><ScanSearch size={22}/></span>
          <div>
            <div className="eyebrow">Agent review</div>
            <h2>Vital Passport compared Maria’s records and found four details worth resolving.</h2>
            <p>Each finding connects back to the source material. Nothing is silently guessed or overwritten.</p>
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
          <span>{openGapCount ? `Resolve ${openGapCount} remaining ${openGapCount === 1 ? 'gap' : 'gaps'} in a guided interview.` : 'The patient-confirmed story is ready for clinician review.'}</span>
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
            <div className={reviewGaps.find((gap) => gap.key === 'dose')?.resolved ? '' : 'attention'}><Sparkles size={17}/><span>{reviewGaps.find((gap) => gap.key === 'dose')?.resolved ? 'Metoprolol dose confirmed by patient' : 'Metoprolol dose needs confirmation'}</span></div>
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
          {timeline.slice(-4).map((event) => <div key={event.id} className="mini-event"><div className="mini-date">{event.displayDate}</div><span className={`timeline-dot ${event.category}`}/><div><strong>{event.title}</strong><p>{event.summary}</p></div></div>)}
        </div>
      </section>
    </div>
  )
}
