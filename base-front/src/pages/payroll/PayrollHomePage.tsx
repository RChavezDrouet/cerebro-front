import { Link } from "react-router-dom";
import { CalendarDays, PlayCircle, Wallet } from "lucide-react";

const cards = [
  {
    title: "Períodos",
    description: "Administra períodos mensuales, quincenales, semanales o especiales.",
    to: "/payroll/periods",
    icon: CalendarDays,
  },
  {
    title: "Ejecuciones",
    description: "Crea corridas, calcula nómina y aplica novedades por período.",
    to: "/payroll/runs",
    icon: PlayCircle,
  },
];

export default function PayrollHomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nómina</h1>
        <p className="mt-1 text-sm text-white/40">
          Módulo de administración de períodos, ejecuciones y resultados de nómina.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-blue-500/40 hover:bg-white/[0.05]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-white/50">{card.description}</p>
              <div className="mt-4 text-sm font-medium text-blue-400 group-hover:text-blue-300">
                Abrir módulo
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Estado del backend</h3>
            <p className="text-sm text-white/45">
              Ya están operativas las funciones de cálculo, aplicación de novedades y resumen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}