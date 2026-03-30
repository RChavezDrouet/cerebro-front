/**
 * ==============================================
 * CEREBRO SaaS - Página 404
 * ==============================================
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'

const NotFoundPage = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        {/* Ilustración 404 */}
        <div className="relative mb-8">
          <div className="text-9xl font-black text-slate-100">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
              <Search className="w-12 h-12 text-primary-500" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Página no encontrada
        </h1>
        <p className="text-slate-500 mb-8">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="btn-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <Link to="/dashboard" className="btn-primary">
            <Home className="w-4 h-4" />
            Ir al Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
