import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AddHealth } from './pages/AddHealth'
import { AppleHealthDemo } from './pages/AppleHealthDemo'
import { Brief } from './pages/Brief'
import { CheckIns } from './pages/CheckIns'
import { Copilot } from './pages/Copilot'
import { Documents } from './pages/Documents'
import { HealthInbox } from './pages/HealthInbox'
import { HealthSignals } from './pages/HealthSignals'
import { Memory } from './pages/Memory'
import { OpenEmr } from './pages/OpenEmr'
import { OpenEmrCallback } from './pages/OpenEmrCallback'
import { Prepare } from './pages/Prepare'
import { SharedBrief } from './pages/SharedBrief'
import { Timeline } from './pages/Timeline'
import { Transfer } from './pages/Transfer'
import { WorkspaceHome } from './pages/WorkspaceHome'

export default function App() {
  return (
    <Routes>
      <Route path="s/:token" element={<SharedBrief />} />
      <Route path="openemr/callback" element={<OpenEmrCallback />} />
      <Route element={<Layout />}>
        <Route index element={<WorkspaceHome />} />
        <Route path="copilot" element={<Copilot />} />
        <Route path="memory" element={<Memory />} />
        <Route path="inbox" element={<HealthInbox />} />
        <Route path="check-ins" element={<CheckIns />} />
        <Route path="signals" element={<HealthSignals />} />
        <Route path="apple-health" element={<AppleHealthDemo />} />
        <Route path="add" element={<AddHealth />} />
        <Route path="documents" element={<Documents />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="prepare" element={<Prepare />} />
        <Route path="brief" element={<Brief />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="openemr" element={<OpenEmr />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
