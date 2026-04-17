import { Play } from 'lucide-react'

export default function PayrollRunsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ejecuciones de Nómina</h1>
        <p className="text-gray-500 text-sm mt-1">
          Calcula, revisa y cierra las corridas de nómina por período.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 gap-4">
        <Play className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Módulo en construcción</p>
        <p className="text-xs max-w-xs">
          Aquí se gestionarán las ejecuciones de nómina: cálculo de ingresos,
          deducciones IESS, impuesto a la renta, provisiones y cierre de período.
        </p>
      </div>
    </div>
  )
}
