import { BellRing, Bot, FileUp, FlaskConical, Inbox, PlusCircle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCheckIns } from '../context/CheckInContext'
import { useHealthInbox } from '../context/HealthInboxContext'
import { useVital } from '../context/VitalContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { openCopilotDrawer } from '../lib/copilot-drawer'
import { Dashboard } from './Dashboard'

export function WorkspaceHome() {
  const workspace = useWorkspace()
  const auth = useAuth()
  const vital = useVital()
  const inbox = useHealthInbox()
  const checkIns = useCheckIns()

  if (workspace.isDemo) return <Dashboard />

  const hasRecord = vital.uploads.length > 0 || vital.sources.length > 0 || vital.timelineEvents.length > 0

  return <div className="page personal-empty-home">
    <section className="page-heading split-heading">
      <div><div className="eyebrow">My Vital Passport</div><h1>{hasRecord ? 'Your health story is taking shape.' : 'Start with a clean slate.'}</h1><p>{auth.user ? `Signed in as ${auth.user.email}. Only information you add or confirm belongs in this personal workspace.` : 'This personal workspace is empty and local to this browser until you sign in.'}</p></div>
      <Link className="button primary" to="/add"><PlusCircle size={16}/> Add health information</Link>
    </section>

    <section className="personal-welcome-card">
      <div className="eyebrow">Patient-controlled from the first click</div>
      <h2>{hasRecord ? `${vital.sources.length} source records connected` : 'Nothing from Maria’s demo is in this Passport.'}</h2>
      <p>{hasRecord ? `You have ${vital.timelineEvents.length} timeline events, ${inbox.pendingCount} Inbox items awaiting review, and ${checkIns.responses.length} recorded check-ins.` : 'Add a document, medication photo, symptom note, or question when you are ready. New findings enter Health Inbox before they can change the confirmed record.'}</p>
    </section>

    <section className="personal-start-grid">
      <Link to="/add" className="personal-start-card"><span><FileUp size={20}/></span><strong>Add your first source</strong><p>Upload or enter health information with source provenance and patient confirmation.</p></Link>
      <Link to="/check-ins" className="personal-start-card"><span><BellRing size={20}/></span><strong>Create a check-in</strong><p>Set up a schedule for symptoms, wellbeing, medication experience, or another concern.</p></Link>
      <button className="personal-start-card" onClick={() => openCopilotDrawer('Help me decide what health information to add first.')}><span><Bot size={20}/></span><strong>Ask Health Copilot</strong><p>Plan your Passport without inventing facts or treating remembered context as clinical evidence.</p></button>
    </section>

    <section className="dashboard-inbox-preview">
      <div className="dashboard-inbox-header"><span><Inbox size={21}/></span><div><div className="eyebrow">Health Inbox</div><h2>{inbox.pendingCount ? `${inbox.pendingCount} findings need your review` : 'No findings are waiting'}</h2></div><Link to="/inbox" className="text-link">Open inbox</Link></div>
      <div className="dashboard-inbox-clear"><ShieldCheck size={18}/><span>Only patient-confirmed information enters the shared health story.</span></div>
    </section>

    <section className="workspace-account-card"><FlaskConical size={18}/><div><strong>Maria remains available as a separate demo</strong><p>Open the account and storage panel to explore the synthetic case. Your personal workspace is saved before switching and restored when you return.</p></div></section>
  </div>
}
