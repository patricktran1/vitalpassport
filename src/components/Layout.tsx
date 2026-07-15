import { ArrowUpFromLine, Bot, CalendarDays, ClipboardList, FileHeart, Home, Menu, PlusCircle, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { patient } from '../data/demo'
import { useVital } from '../context/VitalContext'
import { AccountPanel } from './AccountPanel'
import { Logo } from './Logo'
import { SourceDrawer } from './SourceDrawer'

const navItems = [
  { to: '/', label: 'Health home', icon: Home },
  { to: '/copilot', label: 'Health Copilot', icon: Bot },
  { to: '/add', label: 'Add health info', icon: PlusCircle },
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/prepare', label: 'Prepare for visit', icon: ClipboardList },
  { to: '/brief', label: 'Shareable brief', icon: FileHeart },
  { to: '/transfer', label: 'Transfer center', icon: ArrowUpFromLine },
]

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const { resetDemo } = useVital()

  const handleReset = () => {
    resetDemo()
    setMobileOpen(false)
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
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
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
          <AccountPanel compact />
        </header>
        <Outlet />
      </main>
      {mobileOpen && <button className="sidebar-overlay" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <SourceDrawer />
    </div>
  )
}
