import React from 'react'
import ReactDOM from 'react-dom/client'
import AppOSV5 from './AppOSV5'
import './os-v4.css'
import './overview-v5.css'
import './stage-guides.css'
import './voice-conversation-stable'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppOSV5 />
  </React.StrictMode>,
)
