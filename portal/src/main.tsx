import React from 'react'
import ReactDOM from 'react-dom/client'
import AppPassV2 from './AppPassV2'
import PassAdminTools from './PassAdminTools'
import PublicPass from './PublicPass'
import './pass.css'
import './pass-extra.css'

const isPublicPass = window.location.pathname.startsWith('/public/pass/')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPublicPass ? <PublicPass /> : <><AppPassV2 /><PassAdminTools /></>}
  </React.StrictMode>,
)
