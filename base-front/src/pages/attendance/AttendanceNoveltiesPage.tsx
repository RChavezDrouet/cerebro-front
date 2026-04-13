import { useMemo, useState } from 'react';
import { RefreshCcw, Download, Bell } from 'lucide-react';
import { useAttendanceNovelties } from '../../features/attendance/hooks/useAttendanceNovelties';
import { NoveltyDecisionModal } from '../../features/attendance/components/NoveltyDecisionModal';
import { NoveltiesSummaryCards } from '../../features/attendance/components/NoveltiesSummaryCards';
import { NoveltiesTable } from '../../features/attendance/components/NoveltiesTable';
import type {
  AttendanceNoveltyRow,
  NoveltyDecisionAction,
} from '../../features/attendance/types/novelties';

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

function exportRows(rows: AttendanceNoveltyRow[]) {
  return rows.map((row) => ({
    Fecha: formatDate(row.work_date),
    Empleado: row.employee_name,
    Codigo: row.employee_code ?? '',
    Departamento: row.department_name ?? '',
    Entrada: row.entry_status ?? '',
    Salida: row.exit_status ?? '',
    EstadoDia: row.day_status ?? '',
    Novedad: row.novelty ?? '',
    Decision: row.decision_status ?? 'pending',
    Nota: row.decision_comment ?? row.request_comment ?? '',
    DecididoAt: row.decided_at ?? '',
  }));
}

async function downloadExcel(rows: AttendanceNoveltyRow[]) {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(exportRows(rows));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Novedades');
  XLSX.writeFile(workbook, `reporte-novedades-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function downloadPdf(rows: AttendanceNoveltyRow[]) {
  const jsPDF = (await import('jspdf')).default;
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text('Reporte de novedades', 40, 40);
  doc.setFontSize(10);
  doc.text('Consulta y resolución de novedades de asistencia de los subordinados según organigrama.', 40, 58);

  (doc as any).autoTable({
    startY: 76,
    styles: { fontSize: 8 },
    head: [[
      'Fecha',
      'Empleado',
      'Código',
      'Departamento',
      'Entrada',
      'Salida',
      'Estado día',
      'Novedad',
      'Decisión',
      'Nota',
    ]],
    body: rows.map((row) => [
      formatDate(row.work_date),
      row.employee_name,
      row.employee_code ?? '',
      row.department_name ?? '',
      row.entry_status ?? '',
      row.exit_status ?? '',
      row.day_status ?? '',
      row.novelty ?? '',
      row.decision_status ?? 'pending',
      row.decision_comment ?? row.request_comment ?? '',
    ]),
  });

  doc.save(`reporte-novedades-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function AttendanceNoveltiesPage() {
  const {
    rows,
    filters,
    departments,
    kpis,
    notificationsCount,
    loading,
    refreshing,
    deciding,
    errorMessage,
    setFilters,
    resetFilters,
    refresh,
    submitDecision,
  } = useAttendanceNovelties();

  const [selectedRow, setSelectedRow] = useState<AttendanceNoveltyRow | null>(null);
  const [decisionAction, setDecisionAction] = useState<NoveltyDecisionAction | null>(null);

  const modalOpen = Boolean(selectedRow && decisionAction);

  const titleBadge = useMemo(() => {
    return notificationsCount > 0 ? `${notificationsCount} notificaciones del organigrama` : 'Sin notificaciones nuevas';
  }, [notificationsCount]);

  const openDecision = (row: AttendanceNoveltyRow, action: NoveltyDecisionAction) => {
    setSelectedRow(row);
    setDecisionAction(action);
  };

  const closeModal = () => {
    setSelectedRow(null);
    setDecisionAction(null);
  };

  const handleConfirmDecision = async (note: string) => {
    if (!selectedRow || !decisionAction) return;
    await submitDecision(selectedRow, decisionAction, note);
    closeModal();
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
              <Bell size={14} />
              {titleBadge}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Reporte de novedades</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Consulta y resolución de novedades de asistencia de los subordinados según organigrama.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refrescar
            </button>
            <button
              type="button"
              onClick={() => void downloadExcel(rows)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              <Download size={16} />
              Excel
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf(rows)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </section>

        <NoveltiesSummaryCards kpis={kpis} />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_16px_44px_rgba(0,0,0,0.20)] backdrop-blur">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Filtros</h2>
              <p className="text-sm text-slate-300">La visibilidad y el cálculo operativo siguen viniendo exclusivamente del backend.</p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="self-start rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Buscar</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters({ search: event.target.value })}
                placeholder="Empleado, código, novedad..."
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Desde</span>
              <input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters({ from: event.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Hasta</span>
              <input
                type="date"
                value={filters.to}
                onChange={(event) => setFilters({ to: event.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Departamento / jefatura</span>
              <select
                value={filters.department}
                onChange={(event) => setFilters({ department: event.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
              >
                <option value="all">Todos</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Estado de decisión</span>
              <select
                value={filters.decisionStatus}
                onChange={(event) => setFilters({ decisionStatus: event.target.value as typeof filters.decisionStatus })}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
              >
                <option value="all">Todos</option>
                <option value="pending">Pending</option>
                <option value="justified">Justified</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Error cargando novedades: {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-14 text-center text-slate-300">
            Cargando reporte de novedades...
          </div>
        ) : (
          <NoveltiesTable
            rows={rows}
            deciding={deciding}
            onJustify={(row) => openDecision(row, 'justified')}
            onReject={(row) => openDecision(row, 'rejected')}
          />
        )}
      </div>

      <NoveltyDecisionModal
        open={modalOpen}
        row={selectedRow}
        decision={decisionAction}
        submitting={deciding}
        onClose={closeModal}
        onConfirm={handleConfirmDecision}
      />
    </div>
  );
}
