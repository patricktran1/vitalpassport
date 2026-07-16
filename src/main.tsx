import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FileDropGuard } from './components/FileDropGuard'
import { AppleHealthDemoProvider } from './context/AppleHealthDemoContext'
import { AuthProvider } from './context/AuthContext'
import { CheckInProvider } from './context/CheckInContext'
import { CloudSyncProvider } from './context/CloudSyncContext'
import { CopilotMemoryProvider } from './context/CopilotMemoryContext'
import { HealthInboxProvider } from './context/HealthInboxContext'
import { HealthSignalsProvider } from './context/HealthSignalsContext'
import { PatientProfileProvider } from './context/PatientProfileContext'
import { VitalProvider } from './context/VitalContext'
import { WorkspaceOnboarding, WorkspaceProvider, readWorkspaceMode } from './context/WorkspaceContext'
import { hydrateSessionFromLocalRecord } from './lib/recordStorage'
import './styles/index.css'

function ProductApp() {
  const mode = readWorkspaceMode()
  const publicRoute = window.location.pathname.startsWith('/s/') || window.location.pathname === '/openemr/callback'

  if (publicRoute) {
    return <BrowserRouter><App /></BrowserRouter>
  }

  if (!mode) return <WorkspaceOnboarding />

  hydrateSessionFromLocalRecord()

  return (
    <WorkspaceProvider mode={mode}>
      <PatientProfileProvider>
        <BrowserRouter>
          <AuthProvider>
            <VitalProvider>
              <HealthInboxProvider>
                <CopilotMemoryProvider>
                  <CheckInProvider>
                    <AppleHealthDemoProvider>
                      <HealthSignalsProvider>
                        <CloudSyncProvider>
                          <App />
                        </CloudSyncProvider>
                      </HealthSignalsProvider>
                    </AppleHealthDemoProvider>
                  </CheckInProvider>
                </CopilotMemoryProvider>
              </HealthInboxProvider>
            </VitalProvider>
          </AuthProvider>
        </BrowserRouter>
      </PatientProfileProvider>
    </WorkspaceProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FileDropGuard />
    <ProductApp />
  </React.StrictMode>,
)
