import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Calculator, FileSpreadsheet, Plus, Sparkles } from "lucide-react";
import { payrollService, PayrollPeriod, PayrollRun, PayrollSummaryRow } from "@/services/payroll.service";

const tenantId = "8cb84ecf-4d74-4aac-84cc-0c66da4aa656";

type RunType = "normal" | "adjustment" | "termination" | "bonus" | "special";
type RunStatus = "draft" | "processing" | "calculated" | "approved" | "posted" | "cancelled";

type RunForm = {
  period_id: string;
  code: string;
  run_type: RunType;
  status: RunStatus;
  notes: string;
};

const INPUT = [
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-white/5 border border-white/10 text-white placeholder-white/30",
  "focus:outline-none focus:ring-2 focus:ring-blue-500/60",
].join(" ");

const LABEL = "block text-xs font-medium text-white/50 mb-1";

export default function PayrollRunsPage() {
  const location = useLocation();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [summary, setSummary] = useState<PayrollSummaryRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRun, setSavingRun] = useState(false);
  const [busyRunId, setBusyRunId] = useState<string | null>(null);

  const defaultPeriodId = (location.state as { periodId?: string } | null)?.periodId ?? "";

  const [form, setForm] = useState<RunForm>({
    period_id: defaultPeriodId,
    code: "",
    run_type: "normal",
    status: "draft",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [periodsData, runsData] = await Promise.all([
        payrollService.getPeriods(),
        payrollService.getRuns(),
      ]);
      setPeriods(periodsData);
      setRuns(runsData);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar las ejecuciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const loadSummary = async (runId: string) => {
    try {
      const data = await payrollService.getSummary(runId);
      setSummary(data);
      setSelectedRunId(runId);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar el resumen.");
    }
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.period_id) {
      toast.error("Debes seleccionar un período.");
      return;
    }
    if (!form.code.trim()) {
      toast.error("El código de la corrida es obligatorio.");
      return;
    }

    setSavingRun(true);
    try {
      const created = await payrollService.createRun({
        tenant_id: tenantId,
        period_id: form.period_id,
        code: form.code,
        run_type: form.run_type,
        status: form.status,
        notes: form.notes || null,
      });

      toast.success("Corrida creada.");
      setForm((prev) => ({ ...prev, code: "", notes: "" }));
      await load();
      await loadSummary(created.id);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear la corrida.");
    } finally {
      setSavingRun(false);
    }
  };

  const handleCalculate = async (runId: string) => {
    setBusyRunId(runId);
    try {
      await payrollService.calculateRun(runId);
      await load();
      await loadSummary(runId);
      toast.success("Corrida calculada.");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo calcular la corrida.");
    } finally {
      setBusyRunId(null);
    }
  };

  const handleApplyNovelties = async (runId: string) => {
    setBusyRunId(runId);
    try {
      await payrollService.applyNovelties(runId);
      await load();
      await loadSummary(runId);
      toast.success("Novedades aplicadas.");
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron aplicar las novedades.");
    } finally {
      setBusyRunId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ejecuciones de Nómina</h1>
        <p className="mt-1 text-sm text-white/40">
          Crea corridas, ejecuta cálculo y revisa el resumen por colaborador.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Nueva corrida</h2>
          </div>

          <form onSubmit={handleCreateRun} className="space-y-4">
            <div>
              <label className={LABEL}>Período</label>
              <select
                className={INPUT}
                value={form.period_id}
                onChange={(e) => setForm((prev) => ({ ...prev, period_id: e.target.value }))}
              >
                <option value="" className="bg-[#1a1f2e]">
                  Selecciona un período
                </option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1a1f2e]">
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Código de corrida</label>
              <input
                className={INPUT}
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="Ej. RUN-2026-06-001"
              />
            </div>

            <div>
              <label className={LABEL}>Tipo</label>
              <select
                className={INPUT}
                value={form.run_type}
                onChange={(e) => setForm((prev) => ({ ...prev, run_type: e.target.value as RunType }))}
              >
                <option value="normal" className="bg-[#1a1f2e]">Normal</option>
                <option value="adjustment" className="bg-[#1a1f2e]">Ajuste</option>
                <option value="termination" className="bg-[#1a1f2e]">Liquidación</option>
                <option value="bonus" className="bg-[#1a1f2e]">Bono</option>
                <option value="special" className="bg-[#1a1f2e]">Especial</option>
              </select>
            </div>

            <div>
              <label className={LABEL}>Notas</label>
              <textarea
                rows={3}
                className={INPUT}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Observaciones de la corrida"
              />
            </div>

            <button
              type="submit"
              disabled={savingRun}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {savingRun ? "Guardando..." : "Crear corrida"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-xs uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 text-left">Código</th>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Procesado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center text-white/30">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center text-white/30">
                      No hay corridas creadas.
                    </td>
                  </tr>
                )}

                {!loading &&
                  runs.map((run) => (
                    <tr
                      key={run.id}
                      className={`border-t border-white/5 ${
                        selectedRunId === run.id ? "bg-blue-500/10" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-5 py-3 text-white">{run.code}</td>
                      <td className="px-5 py-3 text-white/70">{run.run_type}</td>
                      <td className="px-5 py-3 text-white/70">{run.status}</td>
                      <td className="px-5 py-3 text-white/50">
                        {run.processed_at ? new Date(run.processed_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => loadSummary(run.id)}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                          >
                            Ver resumen
                          </button>
                          <button
                            onClick={() => handleCalculate(run.id)}
                            disabled={busyRunId === run.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                            Calcular
                          </button>
                          <button
                            onClick={() => handleApplyNovelties(run.id)}
                            disabled={busyRunId === run.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Novedades
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                {selectedRun ? `Resumen · ${selectedRun.code}` : "Resumen"}
              </h2>
            </div>

            {!selectedRunId ? (
              <p className="text-sm text-white/30">Selecciona una corrida para ver el resumen.</p>
            ) : summary.length === 0 ? (
              <p className="text-sm text-white/30">La corrida no tiene resultados todavía.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-white/40">
                      <th className="px-3 py-2">Colaborador</th>
                      <th className="px-3 py-2">Ingresos</th>
                      <th className="px-3 py-2">Deducciones</th>
                      <th className="px-3 py-2">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.out_employee_id} className="border-b border-white/5 last:border-b-0">
                        <td className="px-3 py-2 text-white">{row.out_employee_name}</td>
                        <td className="px-3 py-2 text-emerald-300">{row.total_earnings.toFixed(2)}</td>
                        <td className="px-3 py-2 text-red-300">{row.total_deductions.toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold text-white">{row.net_pay.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}