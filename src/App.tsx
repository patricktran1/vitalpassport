import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AddHealth } from './pages/AddHealth'
import { Brief } from './pages/Brief'
import { Dashboard } from './pages/Dashboard'
import { Prepare } from './pages/Prepare'
import { SharedBrief } from './pages/SharedBrief'
import { Timeline } from './pages/Timeline'
import { Transfer } from './pages/Transfer'

export default function App() {
  return (
    <Routes>
      <Route path="s/:token" element={<SharedBrief />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add" element={<AddHealth />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="prepare" element={<Prepare />} />
        <Route path="brief" element={<Brief />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}