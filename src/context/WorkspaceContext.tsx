import { createContext, useContext, type ReactNode } from 'react'
import { ArrowRight, FlaskConical, HeartHandshake, ShieldCheck } from 'lucide-react'
import {
  activateWorkspace,
  PERSONAL_SANDBOX_KEY,
  readWorkspaceMode,
  reloadWorkspace,
  resetWorkspace,
  type WorkspaceMode,
} from '../lib/workspace'

interface WorkspaceContextValue {
  mode: WorkspaceMode
  isDemo: boolean
  isDemoCopy: boolean
  startPersonal: () => void
  openDemo: () => void
  copyDemoToPersonal: (cloudUserId?: string) => void
  resetCurrent: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function WorkspaceProvider({ mode, children }: { mode: WorkspaceMode; children: ReactNode }) {
  const value: WorkspaceContextValue = {
    mode,
    isDemo: mode === 'demo',
    isDemoCopy: mode === 'personal' && window.localStorage.getItem(PERSONAL_SANDBOX_KEY) === 'true',
    startPersonal: () => {
      activateWorkspace('personal')
      reloadWorkspace()
    },
    openDemo: () => {
      activateWorkspace('demo')
      reloadWorkspace()
    },
    copyDemoToPersonal: (cloudUserId?: string) => {
      activateWorkspace('personal', { copyCurrent: true, cloudUserId })
      reloadWorkspace()
    },
    resetCurrent: () => {
      resetWorkspace(mode)
      reloadWorkspace()
    },
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function WorkspaceOnboarding() {
  const choose = (mode: WorkspaceMode) => {
    activateWorkspace(mode, { preserveCurrent: false })
    reloadWorkspace()
  }

  return <main className="workspace-onboarding">
    <section className="workspace-onboarding-card">
      <div className="workspace-brand-mark"><HeartHandshake size={28}/></div>
      <div className="eyebrow">Vital Passport</div>
      <h1>Your health story should start with your choice.</h1>
      <p className="workspace-lead">Create a clean personal Passport or explore Maria Santos’ fully synthetic demonstration. Demo information is kept separate and never becomes your cloud health record unless you explicitly copy it.</p>

      <div className="workspace-choice-grid">
        <button className="workspace-choice primary-choice" onClick={() => choose('personal')}>
          <span className="workspace-choice-icon"><ShieldCheck size={24}/></span>
          <strong>Create my Vital Passport</strong>
          <p>Begin with an empty, private record and add only the information you choose.</p>
          <em>Start fresh <ArrowRight size={16}/></em>
        </button>
        <button className="workspace-choice" onClick={() => choose('demo')}>
          <span className="workspace-choice-icon"><FlaskConical size={24}/></span>
          <strong>Explore Maria’s demo</strong>
          <p>See the complete product using synthetic records, check-ins, conflicts, and wearable patterns.</p>
          <em>Open demo <ArrowRight size={16}/></em>
        </button>
      </div>

      <small className="workspace-disclosure">Vital Passport is a prototype. Do not enter identifiable patient information until privacy, security, retention, HIPAA, and clinical-safety requirements are completed.</small>
    </section>
  </main>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return context
}

export { readWorkspaceMode }
