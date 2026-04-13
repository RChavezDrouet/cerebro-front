import type { AttendanceNoveltyRow } from '../types/novelties';

interface Props {
  rows: AttendanceNoveltyRow[];
  deciding: boolean;
  allowRedecide?: boolean;
  onJustify: (row: AttendanceNoveltyRow) => void;
  onReject: (row: AttendanceNoveltyRow) => void;
}

type NoveltyTagTone =
  | 'amber'
  | 'sky'
  | 'rose'
  | 'violet'
  | 'emerald'
  | 'slate';

type NoveltyTag = {
  key: string;
  label: string;
  tone: NoveltyTagTone;
};

function badgeClass(value: string | null | undefined) {
  const normalized = (value ?? '').toLowerCase();

  if (normalized.includes('justified') || normalized.includes('justificada')) {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/20';
  }
  if (normalized.includes('rejected') || normalized.includes('rechazada')) {
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/20';
  }
  if (normalized.includes('pending') || normalized.includes('pendiente')) {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/20';
  }

  return 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/20';
}

function noveltyTagClass(tone: NoveltyTagTone) {
  switch (tone) {
    case 'amber':
      return 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/20';
    case 'sky':
      return 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/20';
    case 'rose':
      return 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/20';
    case 'violet':
      return 'bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-400/20';
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/20';
    default:
      return 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/20';
  }
}

function formatDecision(value: AttendanceNoveltyRow['decision_status']) {
  switch (value) {
    case 'justified':
      return 'Justified';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

function formatDate(value: string) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

function truncate(text: string | null | undefined, max = 70) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function extractNoveltyTags(novelty: string | null | undefined): NoveltyTag[] {
  const text = (novelty ?? '').toLowerCase();
  const tags: NoveltyTag[] = [];

  const pushTag = (key: string, label: string, tone: NoveltyTagTone) => {
    if (!tags.some((tag) => tag.key === key)) {
      tags.push({ key, label, tone });
    }
  };

  if (!text) {
    return [{ key: 'novedad', label: 'Novedad', tone: 'slate' }];
  }

  if (text.includes('sin marcación de entrada') || text.includes('sin marcacion de entrada')) {
    pushTag('entrada', 'Entrada', 'amber');
  }

  if (text.includes('sin marcación de salida') || text.includes('sin marcacion de salida')) {
    pushTag('salida', 'Salida', 'sky');
  }

  if (text.includes('fuera de horario')) {
    pushTag('horario', 'Horario', 'rose');
  }

  if (text.includes('fuera de corte')) {
    pushTag('corte', 'Corte', 'violet');
  }

  if (text.includes('turno no autorizado')) {
    pushTag('turno', 'Turno', 'emerald');
  }

  if (text.includes('ausent')) {
    pushTag('ausencia', 'Ausencia', 'rose');
  }

  if (text.includes('inconsisten')) {
    pushTag('inconsistencia', 'Inconsistencia', 'violet');
  }

  if (!tags.length) {
    pushTag('novedad', 'Novedad', 'slate');
  }

  return tags;
}

export function NoveltiesTable({
  rows,
  deciding,
  allowRedecide = false,
  onJustify,
  onReject,
}: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-14 text-center text-slate-300">
        No hay novedades para los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_16px_44px_rgba(0,0,0,0.22)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-200">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Tipo de novedad</th>
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3">Decisión</th>
              <th className="px-4 py-3">Nota</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {rows.map((row) => {
              const locked: boolean =
                !allowRedecide &&
                (row.decision_status === 'justified' || row.decision_status === 'rejected');

              const noveltyTags = extractNoveltyTags(row.novelty);

              return (
                <tr
                  key={`${row.employee_id}-${row.work_date}`}
                  className="align-top hover:bg-white/[0.03]"
                >
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(row.work_date)}</td>

                  <td className="px-4 py-4 font-medium text-white">{row.employee_name}</td>

                  <td className="whitespace-nowrap px-4 py-4">{row.employee_code ?? '—'}</td>

                  <td className="whitespace-nowrap px-4 py-4">{row.department_name ?? '—'}</td>

                  <td className="px-4 py-4">
                    <div className="flex min-w-[180px] flex-wrap gap-2">
                      {noveltyTags.map((tag) => (
                        <span
                          key={tag.key}
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${noveltyTagClass(
                            tag.tone,
                          )}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td
                    className="max-w-[340px] px-4 py-4 text-slate-300"
                    title={row.novelty ?? ''}
                  >
                    <div className="whitespace-pre-line leading-6">
                      {truncate(row.novelty, 180)}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(
                        row.decision_status,
                      )}`}
                    >
                      {formatDecision(row.decision_status)}
                    </span>
                  </td>

                  <td
                    className="max-w-[260px] px-4 py-4 text-slate-300"
                    title={row.decision_comment ?? row.request_comment ?? ''}
                  >
                    {truncate(row.decision_comment ?? row.request_comment, 140)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex min-w-[220px] flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={Boolean(deciding || locked)}
                        onClick={() => onJustify(row)}
                        className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Justificar
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(deciding || locked)}
                        onClick={() => onReject(row)}
                        className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Rechazar
                      </button>
                    </div>

                    {locked ? (
                      <p className="mt-2 text-[11px] text-slate-400">Solo lectura: ya resuelta.</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}