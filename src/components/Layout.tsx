import { ArrowUpFromLine, Bot, CalendarDays, ClipboardList, FileHeart, Home, Menu, PlusCircle, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { patient } from '../data/demo'
import { useVital } from '../context/VitalContext'
import { COPILOT_DRAWER_EVENT, type CopilotDrawerRequest } from '../lib/copilot-drawer'
import { AccountPanel } from './AccountPanel'
import { CopilotDrawer } from './CopilotDrawer'
import { Logo } from './Logo'
import { SourceDrawer } from './SourceDrawer'

const navItems = [
  { to: '/', label: 'Health home', icon: Home },
  { to: '/add', label: 'Add health info', icon: PlusCircle },
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/prepare', label: 'Prepare for visit', icon: ClipboardList },
  { to: '/brief', label: 'Shareable brief', icon: FileHeart },
  { to: '/transfer', label: 'Transfer center', icon: ArrowUpFromLine },
]

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [promptRequest, setPromptRequest] = useState({ id: 0, prompt: '' })
  const navigate = useNavigate()
  const location = useLocation()
  const { resetDemo } = useVital()

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

  const handleReset = () => {
    resetDemo()
    setMobileOpen(false)
    setCopilotOpen(false)
    navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Home size={19}/><span>Health home</span>
          </NavLink>
          <button className={`nav-item copilot-nav-trigger ${copilotOpen ? 'active' : ''}`} onClick={() => openCopilot()}>
            <Bot size={19}/><span>Health Copilot</span><Sparkles size={14}/>
          </button>
          {navItems.slice(1).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account"><AccountPanel /></div>

        <button className="demo-reset" onClick={handleReset}>
          <RotateCcw size={16} />
          <span><strong>Reset demo</strong><small>Return Maria to the starting state</small></span>
        </button>

        <div className="sidebar-trust">
          <ShieldCheck size={18} />
          <div>
            <strong>Patient controlled</strong>
            <span>Your information stays yours.</span>
          </div>
        </div>

        <div className="patient-mini">
          <div className="avatar">{patient.initials}</div>
          <div>
            <strong>{patient.name}</strong>
            <span>Personal health profile</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <Logo compact />
          <button className="mobile-copilot-button" onClick={() => openCopilot()} aria-label="Open Health Copilot"><Bot size={20}/></button>
        </header>
        <Outlet />
      </main>
      {mobileOpen && <button className="sidebar-overlay" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      {location.pathname !== '/copilot' && !copilotOpen && (
        <button className="copilot-drawer-launcher" onClick={() => openCopilot()} aria-label="Open Health Copilot">
          <span><Bot size={21}/></span><strong>Ask Health Copilot</strong><Sparkles size={15}/>
        </button>
      )}
      <CopilotDrawer open={copilotOpen} promptRequest={promptRequest} onClose={() => setCopilotOpen(false)} />
      <SourceDrawer />
    </div>
  )
}
