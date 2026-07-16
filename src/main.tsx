import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppleHealthDemoProvider } from './context/AppleHealthDemoContext'
import { AuthProvider } from './context/AuthContext'
import { CheckInProvider } from './context/CheckInContext'
import { CloudSyncProvider } from './context/CloudSyncContext'
import { CopilotMemoryProvider } from './context/CopilotMemoryContext'
import { HealthInboxProvider } from './context/HealthInboxContext'
import { HealthSignalsProvider } from './context/HealthSignalsContext'
import { VitalProvider } from './context/VitalContext'
import { hydrateSessionFromLocalRecord } from './lib/recordStorage'
import './styles/index.css'

hydrateSessionFromLocalRecord()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
  </React.StrictMode>,
)
