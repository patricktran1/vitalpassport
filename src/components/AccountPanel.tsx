import { CheckCircle2, Cloud, CloudOff, Database, LoaderCircle, LogOut, Mail, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloudSync } from '../context/CloudSyncContext'
import { Modal } from './Modal'

function formatSyncTime(value: string | null) {
  if (!value) return 'Not synced yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently synced'
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(date)
}

export function AccountPanel({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const auth = useAuth()
  const sync = useCloudSync()

  const label = auth.user
    ? sync.status === 'saving' ? 'Saving…' : sync.status === 'error' ? 'Sync needs attention' : 'Cloud saved'
    : auth.configured ? 'Sign in to save' : 'Local record'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setMessage('')
    setActionError('')
    try {
      await auth.sendMagicLink(email)
      setMessage('Check your email for a secure sign-in link. This browser record will move into your account after you sign in.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The sign-in link could not be sent.')
    } finally {
      setSending(false)
    }
  }

  const signOut = async () => {
    setActionError('')
    try {
      await auth.signOut()
      window.sessionStorage.removeItem('vital-cloud-loaded-user')
      setMessage('Signed out. The current record remains available locally on this device.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Sign-out failed.')
    }
  }

  const syncNow = async () => {
    setActionError('')
    try {
      await sync.syncNow()
      setMessage('The complete Vital Passport bundle is saved to the account.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The record could not be saved.')
    }
  }

  const reloadCloud = async () => {
    setActionError('')
    try {
      await sync.reloadFromCloud()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The cloud record could not be loaded.')
    }
  }

  return <>
    <button className={compact ? 'account-button compact' : 'account-button'} onClick={() => setOpen(true)} aria-label="Open account and storage settings">
      <span className={`account-icon ${auth.user ? 'connected' : ''}`}>{auth.user ? <Cloud size={compact ? 17 : 18}/> : <CloudOff size={compact ? 17 : 18}/>}</span>
      {!compact&&<span><strong>{label}</strong><small>{auth.user?.email || (auth.configured ? 'Supabase account persistence' : 'Stored on this device')}</small></span>}
    </button>

    {open&&<Modal title="Your Vital Passport" onClose={() => setOpen(false)}>
      <div className="account-status-card">
        <span className={`account-status-icon ${sync.status}`}>
          {sync.status === 'saving' || sync.status === 'loading' ? <LoaderCircle size={22}/> : sync.status === 'error' ? <TriangleAlert size={22}/> : auth.user ? <CheckCircle2 size={22}/> : <CloudOff size={22}/>} 
        </span>
        <div>
          <strong>{auth.user ? 'Account-backed patient record' : 'Local-first patient record'}</strong>
          <p>{auth.user ? `Signed in as ${auth.user.email}. Core records, check-ins, Inbox decisions, Copilot memory, signals, and wearable summaries save automatically.` : 'Vital Passport keeps working without an account. Supabase adds encrypted transport, authenticated storage, and cross-device continuity.'}</p>
          {auth.user&&<small>Last cloud save: {formatSyncTime(sync.lastSyncedAt)} · Bundle schema v{sync.schemaVersion}</small>}
        </div>
      </div>

      {!auth.configured&&<div className="account-setup-note"><ShieldCheck size={18}/><div><strong>Supabase project setup is still required</strong><p>Create a Supabase project, run <code>supabase/schema.sql</code>, then add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel. Local mode remains active until both variables are deployed.</p></div></div>}

      {auth.user&&<div className="account-module-card"><Database size={18}/><div><strong>{sync.syncedModules.length} synchronized data groups</strong><p>{sync.syncedModules.join(' · ')}</p></div></div>}

      {auth.configured&&!auth.user&&<form className="account-form" onSubmit={submit}>
        <label htmlFor="account-email">Email address</label>
        <div className="account-email-row"><Mail size={17}/><input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required/></div>
        <button className="button primary full" disabled={sending}>{sending?<><LoaderCircle size={16}/> Sending link…</>:<>Send secure sign-in link</>}</button>
      </form>}

      {auth.user&&<div className="account-actions">
        <button className="button primary" onClick={syncNow} disabled={sync.status === 'saving'}><RefreshCw size={16}/> Save now</button>
        <button className="button ghost" onClick={reloadCloud}><Cloud size={16}/> Reload cloud copy</button>
        <button className="button ghost danger-text" onClick={signOut}><LogOut size={16}/> Sign out</button>
      </div>}

      {(message||actionError||sync.error)&&<div className={`account-message ${actionError||sync.error?'error':''}`}>{actionError || sync.error || message}</div>}
      <p className="account-privacy"><ShieldCheck size={14}/> Account rows are restricted by Supabase Auth and database Row Level Security. This remains a prototype and still requires a full privacy, security, retention, HIPAA, and clinical-safety review before real patient use.</p>
    </Modal>}
  </>
}
