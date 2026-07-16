import { CheckCircle2, Cloud, CloudOff, Database, FlaskConical, LoaderCircle, LogOut, Mail, RefreshCw, RotateCcw, ShieldCheck, Trash2, TriangleAlert, UserRoundPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloudSync } from '../context/CloudSyncContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { clearPersonalWorkspace, reloadWorkspace } from '../lib/workspace'
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
  const workspace = useWorkspace()

  const label = workspace.isDemo
    ? 'Maria demo'
    : sync.legacyDemoCloud
      ? 'Demo migration needs review'
      : auth.user
        ? sync.status === 'saving' ? 'Saving…' : sync.status === 'error' ? 'Sync needs attention' : 'Cloud saved'
        : auth.configured ? 'Sign in to save' : 'Local record'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setMessage('')
    setActionError('')
    try {
      await auth.sendMagicLink(email)
      setMessage(workspace.isDemo
        ? 'Check your email. Signing in will not upload Maria; you will choose what happens next.'
        : 'Check your email for a secure sign-in link. This personal Passport will move into your account after sign-in.')
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
      setMessage('Signed out. Your current workspace remains available on this device.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Sign-out failed.')
    }
  }

  const syncNow = async () => {
    setActionError('')
    try {
      await sync.syncNow()
      setMessage('The complete personal Vital Passport bundle is saved to the account.')
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

  const copyDemo = () => {
    const warning = sync.hasCloudRecord
      ? 'This will replace your existing cloud Vital Passport with Maria’s synthetic demo bundle. Continue?'
      : 'Copy Maria’s synthetic demo bundle into your account as a clearly labeled sandbox?'
    if (!window.confirm(warning)) return
    workspace.copyDemoToPersonal(auth.user?.id)
  }

  const resetBlank = async () => {
    const warning = sync.legacyDemoCloud
      ? 'Delete the quarantined Maria demo bundle and create a completely blank personal Vital Passport?'
      : 'Replace your personal Vital Passport with a completely blank record? This removes the current cloud bundle and cannot be undone.'
    if (!window.confirm(warning)) return
    setActionError('')
    try {
      await sync.resetToBlank()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The personal record could not be reset.')
    }
  }

  const deleteCloud = async () => {
    if (!window.confirm('Delete the entire cloud copy of this Vital Passport and sign out? This does not delete the Supabase login identity, but the patient record cannot be recovered.')) return
    setActionError('')
    try {
      await sync.deleteCloudRecord()
      await auth.signOut()
      clearPersonalWorkspace()
      reloadWorkspace()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The cloud record could not be deleted.')
    }
  }

  return <>
    <button className={compact ? 'account-button compact' : 'account-button'} onClick={() => setOpen(true)} aria-label="Open account and storage settings">
      <span className={`account-icon ${auth.user && !workspace.isDemo && !sync.legacyDemoCloud ? 'connected' : ''}`}>{workspace.isDemo ? <FlaskConical size={compact ? 17 : 18}/> : sync.legacyDemoCloud ? <TriangleAlert size={compact ? 17 : 18}/> : auth.user ? <Cloud size={compact ? 17 : 18}/> : <CloudOff size={compact ? 17 : 18}/>}</span>
      {!compact&&<span><strong>{label}</strong><small>{workspace.isDemo ? 'Synthetic data · local only' : sync.legacyDemoCloud ? 'Maria was blocked from your personal record' : auth.user?.email || (auth.configured ? 'Supabase account persistence' : 'Stored on this device')}</small></span>}
    </button>

    {open&&<Modal title={workspace.isDemo ? 'Maria demo workspace' : 'Your Vital Passport'} onClose={() => setOpen(false)}>
      <div className="account-status-card">
        <span className={`account-status-icon ${sync.legacyDemoCloud ? 'error' : sync.status}`}>
          {workspace.isDemo ? <FlaskConical size={22}/> : sync.legacyDemoCloud ? <TriangleAlert size={22}/> : sync.status === 'saving' || sync.status === 'loading' ? <LoaderCircle size={22}/> : sync.status === 'error' ? <TriangleAlert size={22}/> : auth.user ? <CheckCircle2 size={22}/> : <CloudOff size={22}/>} 
        </span>
        <div>
          <strong>{workspace.isDemo ? 'Synthetic demo, isolated from your record' : sync.legacyDemoCloud ? 'Legacy Maria demo quarantined' : auth.user ? 'Account-backed patient record' : 'Local-first patient record'}</strong>
          <p>{workspace.isDemo
            ? 'Maria’s records, check-ins, wearable data, and Inbox decisions stay in the demo workspace. They are never uploaded automatically, even when you are signed in.'
            : sync.legacyDemoCloud
              ? 'An older test uploaded Maria’s synthetic bundle to this account. Vital Passport recognized it and did not load it into your personal workspace. Reset the cloud record to continue with a blank Passport.'
              : auth.user ? `Signed in as ${auth.user.email}. Core records, check-ins, Inbox decisions, Copilot memory, signals, and wearable summaries save automatically.` : 'Vital Passport keeps working without an account. Supabase adds authenticated storage and cross-device continuity.'}</p>
          {auth.user&&!workspace.isDemo&&<small>Last cloud activity: {formatSyncTime(sync.lastSyncedAt)} · Bundle schema v{sync.schemaVersion}</small>}
        </div>
      </div>

      {!auth.configured&&<div className="account-setup-note"><ShieldCheck size={18}/><div><strong>Supabase project setup is still required</strong><p>Run <code>supabase/schema.sql</code>, then deploy <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. Local mode remains active until both are present.</p></div></div>}

      {workspace.isDemo&&<div className="workspace-account-card"><FlaskConical size={18}/><div><strong>Choose when you are ready</strong><p>Start a blank personal Passport, or explicitly copy this demo into your account as a sandbox. Keeping the demo open does nothing to your cloud record.</p></div></div>}

      {sync.legacyDemoCloud&&<div className="account-setup-note"><TriangleAlert size={18}/><div><strong>No demo data was imported</strong><p>Your current personal workspace remains blank. Use “Reset cloud to blank” below to delete the older Maria bundle and activate normal synchronization.</p></div></div>}

      {!workspace.isDemo&&workspace.isDemoCopy&&<div className="workspace-account-card"><FlaskConical size={18}/><div><strong>Personal sandbox copied from Maria</strong><p>This account currently contains synthetic demo information. Reset to blank before entering your own information.</p></div></div>}

      {auth.user&&!workspace.isDemo&&!sync.legacyDemoCloud&&<div className="account-module-card"><Database size={18}/><div><strong>{sync.syncedModules.length} synchronized data groups</strong><p>{sync.syncedModules.join(' · ')}</p></div></div>}

      {auth.configured&&!auth.user&&<form className="account-form" onSubmit={submit}>
        <label htmlFor="account-email">Email address</label>
        <div className="account-email-row"><Mail size={17}/><input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required/></div>
        <button className="button primary full" disabled={sending}>{sending?<><LoaderCircle size={16}/> Sending link…</>:<>Send secure sign-in link</>}</button>
      </form>}

      {workspace.isDemo&&<div className="account-actions">
        <button className="button primary" onClick={workspace.startPersonal}><UserRoundPlus size={16}/> Start my blank Passport</button>
        {auth.user&&<button className="button ghost" onClick={copyDemo}><Database size={16}/> Copy demo into account</button>}
        {auth.user&&<button className="button ghost danger-text" onClick={signOut}><LogOut size={16}/> Sign out</button>}
      </div>}

      {auth.user&&!workspace.isDemo&&sync.legacyDemoCloud&&<div className="account-actions">
        <button className="button primary" onClick={resetBlank}><RotateCcw size={16}/> Reset cloud to blank</button>
        <button className="button ghost" onClick={workspace.openDemo}><FlaskConical size={16}/> View Maria in demo mode</button>
        <button className="button ghost danger-text" onClick={signOut}><LogOut size={16}/> Sign out</button>
      </div>}

      {auth.user&&!workspace.isDemo&&!sync.legacyDemoCloud&&<div className="account-actions">
        <button className="button primary" onClick={syncNow} disabled={sync.status === 'saving'}><RefreshCw size={16}/> Save now</button>
        <button className="button ghost" onClick={reloadCloud}><Cloud size={16}/> Reload cloud copy</button>
        <button className="button ghost" onClick={workspace.openDemo}><FlaskConical size={16}/> Open Maria demo</button>
        <button className="button ghost danger-text" onClick={signOut}><LogOut size={16}/> Sign out</button>
      </div>}

      {!workspace.isDemo&&!sync.legacyDemoCloud&&<div className="account-danger-zone">
        <strong>Personal record controls</strong>
        <div className="account-danger-actions">
          <button className="button danger-outline" onClick={resetBlank}><RotateCcw size={16}/> Reset to blank</button>
          {auth.user&&<button className="button danger-outline" onClick={deleteCloud}><Trash2 size={16}/> Delete cloud record</button>}
        </div>
      </div>}

      {(message||actionError||sync.error)&&<div className={`account-message ${actionError||sync.error?'error':''}`}>{actionError || sync.error || message}</div>}
      <p className="account-privacy"><ShieldCheck size={14}/> Personal account rows are restricted by Supabase Auth and database Row Level Security. This remains a prototype and still requires a full privacy, security, retention, HIPAA, and clinical-safety review before real patient use.</p>
    </Modal>}
  </>
}
