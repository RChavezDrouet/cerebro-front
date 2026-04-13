import type { NoveltiesKpis } from '../types/novelties';

interface Props {
  kpis: NoveltiesKpis;
}

const cards = [
  { key: 'total', label: 'Total novedades' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'justified', label: 'Justificadas' },
  { key: 'rejected', label: 'Rechazadas' },
] as const;

export function NoveltiesSummaryCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.20)] backdrop-blur"
        >
          <p className="text-sm text-slate-300">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {kpis[card.key].toLocaleString('es-EC')}
          </p>
        </div>
      ))}
    </div>
  );
}
