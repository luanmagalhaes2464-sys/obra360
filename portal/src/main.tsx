import React from 'react'
import ReactDOM from 'react-dom/client'
import AppOSV4 from './AppOSV4'
import './os-v4.css'
import './overview-v5.css'
import './voice-enhancer.css'
import './voice-enhancer'
import './voice-quality'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppOSV4 />
  </React.StrictMode>,
)
