import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AddHealth } from './pages/AddHealth'
import { Brief } from './pages/Brief'
import { Dashboard } from './pages/Dashboard'
import { Prepare } from './pages/Prepare'
import { Timeline } from './pages/Timeline'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add" element={<AddHealth />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="prepare" element={<Prepare />} />
        <Route path="brief" element={<Brief />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
