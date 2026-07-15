import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AddHealth } from './pages/AddHealth'
import { Brief } from './pages/Brief'
import { Copilot } from './pages/Copilot'
import { Dashboard } from './pages/Dashboard'
import { OpenEmr } from './pages/OpenEmr'
import { OpenEmrCallback } from './pages/OpenEmrCallback'
import { Prepare } from './pages/Prepare'
import { SharedBrief } from './pages/SharedBrief'
import { Timeline } from './pages/Timeline'
import { Transfer } from './pages/Transfer'

export default function App() {
  return (
    <Routes>
      <Route path="s/:token" element={<SharedBrief />} />
      <Route path="openemr/callback" element={<OpenEmrCallback />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="copilot" element={<Copilot />} />
        <Route path="add" element={<AddHealth />} />
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
