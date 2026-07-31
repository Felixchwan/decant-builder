import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import '@discovery-box/builder/styles.css'
import { selectMerchantApp } from './app/selectMerchantApp.js'

const MerchantApp = selectMerchantApp(import.meta.env.VITE_MERCHANT)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MerchantApp />
  </StrictMode>,
)
