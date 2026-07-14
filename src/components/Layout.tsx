import { CalendarDays, ClipboardList, FileHeart, Home, Menu, PlusCircle, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from './Logo'
import { SourceDrawer } from './SourceDrawer'
import { patient } from '../data/demo'

const navItems = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/add', label: 'Add health info', icon: PlusCircle },
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/prepare', label: 'Prepare for visit', icon: ClipboardList },
  { to: '/brief', label: 'Clinician brief', icon: FileHeart },
]

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

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
          <div className="avatar small">{patient.initials}</div>
        </header>
        <Outlet />
      </main>
      {mobileOpen && <button className="sidebar-overlay" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <SourceDrawer />
    </div>
  )
}
