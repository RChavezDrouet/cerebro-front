import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarDays, ChevronRight, Pencil, Plus, X } from "lucide-react";
import { payrollService, PayrollPeriod } from "@/services/payroll.service";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";

type PeriodStatus = "draft" | "open" | "processing" | "closed" | "cancelled";
type PeriodType = "weekly" | "biweekly" | "monthly" | "special";

type PeriodForm = {
  code: string;
  name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  payment_date: string;
  status: PeriodStatus;
};

const INPUT = [
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-white/5 border border-white/10 text-white placeholder-white/30",
  "focus:outline-none focus:ring-2 focus:ring-blue-500/60",
].join(" ");

const LABEL = "block text-xs font-medium text-white/50 mb-1";

const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
  { value: "special", label: "Especial" },
];

const STATUS_STYLES: Record<PeriodStatus, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-white/10 text-gray-300" },
  open: { label: "Abierto", cls: "bg-blue-500/20 text-blue-300" },
  processing: { label: "Procesando", cls: "bg-yellow-500/20 text-yellow-300" },
  closed: { label: "Cerrado", cls: "bg-emerald-500/20 text-emerald-300" },
  cancelled: { label: "Cancelado", cls: "bg-red-500/20 text-red-300" },
};

function buildDefaultForm(): PeriodForm {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const firstDay = `${y}-${m}-01`;
  const code = `${y}-${m}`;

  return {
    code,
    name: `Nómina ${code}`,
    period_type: "monthly",
    start_date: firstDay,
    end_date: new Date(y, Number(m), 0).toISOString().slice(0, 10),
    payment_date: "",
    status: "draft",
  };
}

function normalizeForm(period?: PayrollPeriod | null): PeriodForm {
  if (!period) return buildDefaultForm();

  return {
    code: period.code,
    name: period.name ?? "",
    period_type: period.period_type,
    start_date: period.start_date,
    end_date: period.end_date,
    payment_date: period.payment_date ?? "",
    status: period.status,
  };
}

interface PeriodModalProps {
  tenantId: string | null;
  initialPeriod?: PayrollPeriod | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function PeriodModal({ tenantId, initialPeriod, onClose, onSaved }: PeriodModalProps) {
  const [form, setForm] = useState<PeriodForm>(normalizeForm(initialPeriod));
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initialPeriod?.id);

  const setField = <K extends keyof PeriodForm>(key: K, value: PeriodForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.code.trim()) {
      toast.error("El código es obligatorio.");
      return false;
    }
    if (!form.start_date) {
      toast.error("La fecha de inicio es obligatoria.");
      return false;
    }
    if (!form.end_date) {
      toast.error("La fecha de fin es obligatoria.");
      return false;
    }
    if (form.end_date < form.start_date) {
      toast.error("La fecha fin no puede ser menor que la fecha inicio.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (isEdit && initialPeriod?.id) {
        await payrollService.updatePeriod(initialPeriod.id, {
          name: form.name || null,
          payment_date: form.payment_date || null,
          status: form.status,
        }, tenantId ?? undefined);
        toast.success("Período actualizado.");
      } else {
        if (!tenantId) {
          throw new Error("No se pudo resolver el tenant activo.");
        }
        await payrollService.createPeriod({
          tenant_id: tenantId,
          code: form.code,
          name: form.name || null,
          period_type: form.period_type,
          start_date: form.start_date,
          end_date: form.end_date,
          payment_date: form.payment_date || null,
          status: form.status,
        });
        toast.success("Período creado.");
      }

      await onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el período.";
      toast.error(message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1f2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">
              {isEdit ? "Editar período" : "Nuevo período"}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/40 transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className={LABEL}>Código</label>
            <input
              className={INPUT}
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
              placeholder="Ej. 2026-04"
              disabled={isEdit}
            />
          </div>

          <div>
            <label className={LABEL}>Nombre</label>
            <input
              className={INPUT}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ej. Nómina Abril 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Fecha Inicio</label>
              <input
                type="date"
                className={INPUT}
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                disabled={isEdit}
              />
            </div>
            <div>
              <label className={LABEL}>Fecha Fin</label>
              <input
                type="date"
                className={INPUT}
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
                disabled={isEdit}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Fecha de pago</label>
              <input
                type="date"
                className={INPUT}
                value={form.payment_date}
                onChange={(e) => setField("payment_date", e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Tipo</label>
              <select
                className={INPUT}
                value={form.period_type}
                onChange={(e) => setField("period_type", e.target.value as PeriodType)}
                disabled={isEdit}
              >
                {PERIOD_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value} className="bg-[#1a1f2e]">
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Estado</label>
            <select
              className={INPUT}
              value={form.status}
              onChange={(e) => setField("status", e.target.value as PeriodStatus)}
            >
              {Object.entries(STATUS_STYLES).map(([value, meta]) => (
                <option key={value} value={value} className="bg-[#1a1f2e]">
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear período"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PayrollPeriodsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantContext = useTenantContext(user?.id);
  const tenantId = tenantContext.data?.tenantId ?? null;
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; period: PayrollPeriod | null }>({
    open: false,
    period: null,
  });

  const load = useCallback(async () => {
    if (!tenantId) {
      setPeriods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await payrollService.getPeriods(tenantId);
      setPeriods(data);
    } catch (err) {
      toast.error("Error al cargar períodos.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    void load();
  }, [load, tenantId]);

  useEffect(() => {
    if (!tenantContext.isLoading && !tenantId) {
      setLoading(false);
    }
  }, [tenantContext.isLoading, tenantId]);

  const openCreate = () => setModal({ open: true, period: null });
  const openEdit = (period: PayrollPeriod) => setModal({ open: true, period });
  const closeModal = () => setModal({ open: false, period: null });

  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => {
      if (a.start_date === b.start_date) return b.created_at.localeCompare(a.created_at);
      return b.start_date.localeCompare(a.start_date);
    });
  }, [periods]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Períodos de Nómina</h1>
          <p className="mt-1 text-sm text-white/40">Administra los períodos mensuales de liquidación.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo período
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-xs uppercase tracking-widest text-white/40">
              <th className="px-5 py-3 text-left font-medium">Código</th>
              <th className="px-5 py-3 text-left font-medium">Período</th>
              <th className="px-5 py-3 text-left font-medium">Fechas</th>
              <th className="px-5 py-3 text-left font-medium">Pago</th>
              <th className="px-5 py-3 text-left font-medium">Tipo</th>
              <th className="px-5 py-3 text-left font-medium">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-sm text-white/30">
                  Cargando…
                </td>
              </tr>
            )}

            {!loading && sortedPeriods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-white/30">
                    <CalendarDays className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No hay períodos creados</p>
                    <button
                      onClick={openCreate}
                      className="text-xs text-blue-400 transition-colors hover:text-blue-300"
                    >
                      Crear el primero
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              sortedPeriods.map((p, i) => {
                const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft;
                const canEdit = p.status === "draft";

                return (
                  <tr
                    key={p.id}
                    className={[
                      "border-t border-white/5 transition-colors",
                      i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]",
                      "hover:bg-white/5",
                    ].join(" ")}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-white/80">{p.code}</td>
                    <td className="px-5 py-3 text-white">{p.name || p.code}</td>
                    <td className="px-5 py-3 text-xs text-white/50">
                      {p.start_date} → {p.end_date}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/50">
                      {p.payment_date || <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/50">
                      {PERIOD_TYPES.find((pt) => pt.value === p.period_type)?.label ?? p.period_type}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            onClick={() => openEdit(p)}
                            title="Editar"
                            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            navigate("/payroll/runs", {
                              state: { periodId: p.id, periodCode: p.code },
                            })
                          }
                          className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white"
                          title="Ver ejecuciones"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && sortedPeriods.length > 0 && (
        <p className="text-right text-xs text-white/25">
          {sortedPeriods.length} período{sortedPeriods.length !== 1 ? "s" : ""}
        </p>
      )}

      {modal.open && (
        <PeriodModal
          tenantId={tenantId}
          initialPeriod={modal.period}
          onClose={closeModal}
          onSaved={load}
        />
      )}
    </div>
  );
}
