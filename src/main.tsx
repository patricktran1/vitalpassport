import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CloudSyncProvider } from './context/CloudSyncContext'
import { HealthInboxProvider } from './context/HealthInboxContext'
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
            <CloudSyncProvider>
              <App />
            </CloudSyncProvider>
          </HealthInboxProvider>
        </VitalProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
