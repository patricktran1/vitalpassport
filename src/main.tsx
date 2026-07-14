import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { VitalProvider } from './context/VitalContext'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <VitalProvider>
        <App />
      </VitalProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
