import { useEffect, useMemo, useState } from 'react';
import type { AttendanceNoveltyRow, NoveltyDecisionAction } from '../types/novelties';

interface Props {
  open: boolean;
  row: AttendanceNoveltyRow | null;
  decision: NoveltyDecisionAction | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

export function NoveltyDecisionModal({ open, row, decision, submitting, onClose, onConfirm }: Props) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) {
      setNote('');
      return;
    }
    setNote('');
  }, [open, row?.employee_id, row?.work_date, decision]);

  const title = useMemo(() => {
    if (decision === 'justified') return 'Justificar novedad';
    if (decision === 'rejected') return 'Rechazar novedad';
    return 'Resolver novedad';
  }, [decision]);

  if (!open || !row || !decision) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onConfirm(note);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-300">
              Registra la nota obligatoria para persistir la decisión en el backend.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Empleado</p>
              <p className="mt-2 text-sm font-medium text-white">{row.employee_name}</p>
              <p className="mt-1 text-xs text-slate-400">Código: {row.employee_code ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Fecha</p>
              <p className="mt-2 text-sm font-medium text-white">{formatDate(row.work_date)}</p>
              <p className="mt-1 text-xs text-slate-400">Departamento: {row.department_name ?? '—'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Novedad detectada</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{row.novelty ?? 'Sin detalle.'}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Tipo de decisión</label>
              <input
                readOnly
                value={decision}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Comentario origen</label>
              <input
                readOnly
                value={row.request_comment ?? ''}
                placeholder="Sin comentario de origen"
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="decision-note" className="mb-2 block text-sm font-medium text-slate-200">
              Nota obligatoria
            </label>
            <textarea
              id="decision-note"
              required
              rows={5}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Escribe la justificación o el motivo del rechazo..."
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !note.trim()}
              className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar decisión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
