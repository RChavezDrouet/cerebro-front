import React from 'react'
import { Clock } from 'lucide-react'

export default function AttendancePage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-2" style={{ color:'var(--color-text)' }}>Asistencia</h1>
      <p className="text-sm mb-6" style={{ color:'var(--color-muted)' }}>Registro de entradas y salidas</p>
      <div className="flex justify-center py-16">
        <div className="text-center">
          <Clock size={64} style={{ color:'var(--color-primary)' }} className="mx-auto mb-4" />
          <p style={{ color:'var(--color-muted)' }}>Módulo de asistencia con GPS y foto</p>
        </div>
      </div>
    </div>
  )
}
