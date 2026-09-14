import React from 'react'
import ReactDOM from 'react-dom/client'
import AppOSV3 from './AppOSV3'
import AutopilotDock from './AutopilotDock'
import './os-v3.css'
import './autopilot.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppOSV3 />
    <AutopilotDock />
  </React.StrictMode>,
)
