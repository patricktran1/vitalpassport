import { Activity, ArrowUpFromLine, BellRing, Bot, Brain, CalendarDays, ChevronRight, ClipboardList, FileHeart, FlaskConical, FolderLock, Home, Inbox as InboxIcon, LoaderCircle, Menu, PlusCircle, RotateCcw, ShieldCheck, Sparkles, UserRound, Watch, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppleHealthDemo } from '../context/AppleHealthDemoContext'
import { useAuth } from '../context/AuthContext'
import { useCheckIns } from '../context/CheckInContext'
import { useCloudSync } from '../context/CloudSyncContext'
import { useCopilotMemory } from '../context/CopilotMemoryContext'
import { useHealthInbox } from '../context/HealthInboxContext'
import { useHealthSignals } from '../context/HealthSignalsContext'
import { usePatientProfile } from '../context/PatientProfileContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { COPILOT_DRAWER_EVENT, type CopilotDrawerRequest } from '../lib/copilot-drawer'
import { AccountPanel } from './AccountPanel'
import { CheckInPrompt } from './CheckInPrompt'
import { CopilotDrawer } from './CopilotDrawer'
import { Logo } from './Logo'
import { SourceDrawer } from './SourceDrawer'

const navItems = [
  { to: '/add', label: 'Add health info', icon: PlusCircle },
  { to: '/documents', label: 'Private sources', icon: FolderLock },
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/prepare', label: 'Prepare for visit', icon: ClipboardList },
  { to: '/brief', label: 'Shareable brief', icon: FileHeart },
  { to: '/transfer', label: 'Transfer center', icon: ArrowUpFromLine },
]

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [promptRequest, setPromptRequest] = useState({ id: 0, prompt: '' })
  const [resetting, setResetting] = useState(false)
  const location = useLocation()
  const workspace = useWorkspace()
  const auth = useAuth()
  const cloudSync = useCloudSync()
  const patientProfile = usePatientProfile()
  const { pendingCount } = useHealthInbox()
  const { dueCount } = useCheckIns()
  const { activeMemories } = useCopilotMemory()
  const { pendingSignalCount } = useHealthSignals()
  const { status: appleHealthStatus } = useAppleHealthDemo()

  const openCopilot = (prompt = '') => {
    setPromptRequest({ id: Date.now(), prompt })
    setCopilotOpen(true)
    setMobileOpen(false)
  }

  useEffect(() => {
    const handleOpen = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<CopilotDrawerRequest>
      openCopilot(event.detail?.prompt || '')
    }
    window.addEventListener(COPILOT_DRAWER_EVENT, handleOpen)
    return () => window.removeEventListener(COPILOT_DRAWER_EVENT, handleOpen)
  }, [])

  const resetUsesCloud = !workspace.isDemo && Boolean(auth.user) && cloudSync.storageMode === 'cloud'

  const handleReset = async () => {
    const label = workspace.isDemo
      ? 'Restore the synthetic demo to its original state?'
      : resetUsesCloud
        ? 'Permanently reset this Passport everywhere? This deletes the cloud health record, Health Inbox, private source files, share links, and the local copy. Your login remains active.'
        : 'Reset this local personal workspace to a blank Passport?'
    if (!window.confirm(label)) return

    if (workspace.isDemo || !resetUsesCloud) {
      workspace.resetCurrent()
      return
    }

    setResetting(true)
    try {
      await cloudSync.resetToBlank()
    } catch (caught) {
      setResetting(false)
      window.alert(caught instanceof Error ? caught.message : 'The Passport could not be reset.')
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <NavLink to="/profile" onClick={() => setMobileOpen(false)} className={({ isActive }) => `patient-mini patient-mini-top ${isActive ? 'active' : ''}`}>
          {patientProfile.profile.photoDataUrl
            ? <img className="avatar patient-avatar-photo" src={patientProfile.profile.photoDataUrl} alt="Patient profile"/>
            : <div className="avatar">{patientProfile.initials}</div>}
          <div>
            <strong>{patientProfile.profile.name || (workspace.isDemo ? 'Synthetic patient' : 'Set up my profile')}</strong>
            <span>{workspace.isDemo ? 'Synthetic demonstration' : patientProfile.profile.name ? 'View or edit patient details' : 'Add identity and contact details'}</span>
          </div>
        </NavLink>

        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Home size={19}/><span>Health home</span>
          </NavLink>
          <NavLink to="/profile" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserRound size={19}/><span>My profile</span>
          </NavLink>
          <button className={`nav-item copilot-nav-trigger ${copilotOpen ? 'active' : ''}`} onClick={() => openCopilot()} aria-expanded={copilotOpen}>
            <Bot size={19}/><span>Health Copilot</span><Sparkles size={14}/>
          </button>
          <NavLink to="/memory" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Brain size={19}/><span>Copilot memory</span>{activeMemories.length > 0 && <small className="nav-memory-badge">{activeMemories.length}</small>}
          </NavLink>
          <NavLink to="/inbox" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <InboxIcon size={19}/><span>Health Inbox</span>{pendingCount > 0 && <small className="nav-inbox-badge">{pendingCount}</small>}
          </NavLink>
          <NavLink to="/check-ins" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BellRing size={19}/><span>Check-ins</span>{dueCount > 0 && <small className="nav-checkin-badge">{dueCount}</small>}
          </NavLink>
          <NavLink to="/signals" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Activity size={19}/><span>Health signals</span>{pendingSignalCount > 0 && <small className="nav-signals-badge">{pendingSignalCount}</small>}
          </NavLink>
          {workspace.isDemo&&<NavLink to="/apple-health" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Watch size={19}/><span>Apple Health demo</span>{appleHealthStatus === 'connected' && <small className="nav-health-badge">On</small>}
          </NavLink>}
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account"><AccountPanel /></div>

        <button className="demo-reset" onClick={()=>void handleReset()} disabled={resetting}>
          {resetting ? <LoaderCircle className="spin" size={16}/> : <RotateCcw size={16} />}
          <span><strong>{workspace.isDemo ? 'Reset synthetic demo' : resetUsesCloud ? 'Reset cloud Passport' : 'Reset local workspace'}</strong><small>{workspace.isDemo ? 'Return synthetic data to the start' : resetUsesCloud ? 'Delete cloud and local health data' : 'Start a blank personal Passport'}</small></span>
        </button>

        <div className="sidebar-trust">
          <ShieldCheck size={18} />
          <div>
            <strong>Patient controlled</strong>
            <span>Your information stays yours.</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {workspace.isDemo&&<div className="demo-mode-banner"><FlaskConical size={17}/><div><strong>Synthetic demo mode</strong><span>You are viewing entirely fictional information. This workspace does not sync to your account automatically.</span></div><button onClick={workspace.startPersonal}>Start my own Passport</button></div>}
        {!workspace.isDemo&&workspace.isDemoCopy&&<div className="demo-mode-banner personal-sandbox-banner"><FlaskConical size={17}/><div><strong>Synthetic sandbox copied into this workspace</strong><span>Reset to blank before entering your own health information.</span></div><button onClick={()=>void handleReset()}>Reset to blank</button></div>}
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <Logo compact />
          <button className="mobile-copilot-button" onClick={() => openCopilot()} aria-label="Open Health Copilot"><Bot size={20}/></button>
        </header>
        <Outlet />
      </main>
      {mobileOpen && <button className="sidebar-overlay" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      {location.pathname !== '/copilot' && !copilotOpen && (
        <button className="copilot-drawer-launcher" onClick={() => openCopilot()} aria-label="Open Health Copilot" aria-expanded="false">
          <span><Bot size={21}/></span><strong>Health Copilot</strong><Sparkles size={15}/>
        </button>
      )}
      {location.pathname !== '/copilot' && copilotOpen && (
        <button className="copilot-drawer-collapse-tab" onClick={() => setCopilotOpen(false)} aria-label="Collapse Health Copilot" aria-expanded="true">
          <ChevronRight size={20}/><span>Close</span>
        </button>
      )}
      <CopilotDrawer open={copilotOpen} promptRequest={promptRequest} onClose={() => setCopilotOpen(false)} />
      <CheckInPrompt />
      <SourceDrawer />
    </div>
  )
}
