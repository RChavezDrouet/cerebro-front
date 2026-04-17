import { CalendarDays } from 'lucide-react'

export default function PayrollPeriodsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Períodos de Nómina</h1>
        <p className="text-gray-500 text-sm mt-1">
          Crea y administra los períodos mensuales de liquidación.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 gap-4">
        <CalendarDays className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Módulo en construcción</p>
        <p className="text-xs max-w-xs">
          Aquí se listarán los períodos de nómina con sus estados:
          DRAFT → CALCULATING → CALCULATED → CLOSED.
        </p>
      </div>
    </div>
  )
}
