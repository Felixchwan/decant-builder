import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import '@discovery-box/builder/styles.css'
import DiscoveryDecantsApp from './app/DiscoveryDecantsApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DiscoveryDecantsApp />
  </StrictMode>,
)
