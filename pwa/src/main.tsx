import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/globals.css'

registerSW({
  immediate: true,
  onNeedRefresh() {
    const accept = window.confirm('Hay una nueva versión de HRCloud disponible. ¿Deseas actualizar ahora?')
    if (accept) window.location.reload()
  },
  onOfflineReady() {
    console.info('HRCloud PWA lista para trabajar con shell offline.')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)