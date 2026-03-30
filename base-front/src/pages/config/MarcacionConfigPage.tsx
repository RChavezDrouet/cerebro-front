/**
 * MarcacionConfigPage.tsx — Base PWA v4.8.0
 *
 * Configuración de parámetros de marcación:
 *  - Minutos de gracia para entrada, salida, salida a comer, entrada de comer
 *  - Lógica de marcación (cuándo se considera entrada, salida, comida, novedad)
 *  - Guarda en attendance.config_marcacion (crea si no existe)
 *  - Diseño Ferrari coherente con el resto del sistema
 */
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Save, Loader2, Clock, Settings, Info } from 'lucide-react'

import { supabase, ATT_SCHEMA } from '@/config/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'

// ─── Types ─────────────────────────────────────────────────────────────────────
type MarcacionConfig = {
  grace_entry_minutes:       number   // gracia entrada
  grace_exit_minutes:        number   // gracia salida
  grace_meal_out_minutes:    number   // gracia salida a comer
  grace_meal_in_minutes:     number   // gracia entrada de comer
  entry_is_first_punch:      boolean  // entrada = primera marcación del turno
  exit_is_last_punch:        boolean  // salida = última marcación del turno
  meal_out_window_before:    number   // mins antes de salir a comer
  meal_out_window_after:     number   // mins después de salir a comer
  meal_in_window_before:     number   // mins antes de entrar de comer
  meal_in_window_after:      number   // mins después de entrar de comer
}

const DEFAULTS: MarcacionConfig = {
  grace_entry_minutes:    10,
  grace_exit_minutes:     10,
  grace_meal_out_minutes: 5,
  grace_meal_in_minutes:  5,
  entry_is_first_punch:   true,
  exit_is_last_punch:     true,
  meal_out_window_before: 10,
  meal_out_window_after:  15,
  meal_in_window_before:  10,
  meal_in_window_after:   15,
}

// ─── Fetch / Save ──────────────────────────────────────────────────────────────
async function fetchConfig(tenantId: string): Promise<MarcacionConfig> {
  // Try attendance schema table first
  const { data, error } = await supabase
    .schema(ATT_SCHEMA)
    .from('config_marcacion')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return DEFAULTS
  return { ...DEFAULTS, ...data } as MarcacionConfig
}

async function saveConfig(tenantId: string, cfg: MarcacionConfig) {
  const { error } = await supabase
    .schema(ATT_SCHEMA)
    .from('config_marcacion')
    .upsert({ tenant_id: tenantId, ...cfg }, { onConflict: 'tenant_id' })
  if (error) throw error
}

// ─── UI Helpers ────────────────────────────────────────────────────────────────
const FERRARI_RED = '#DC2626'

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(18,18,24,0.9)' }}>
      <div className="px-5 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(220,38,38,0.15)', background: 'rgba(220,38,38,0.06)' }}>
        <div className="w-1 h-5 rounded-full" style={{ background: FERRARI_RED }} />
        <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: FERRARI_RED }}>
          {title}
        </h3>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function MinutesField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="number" min={0} max={120} value={value}
          onChange={e => onChange(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
          className="w-full rounded-xl px-4 py-2.5 pr-12 text-sm border outline-none transition"
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(220,38,38,0.25)',
            color: '#F1F1F1',
          }}
        />
        <span className="absolute right-3 text-xs font-semibold pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          min
        </span>
      </div>
      {hint && <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
    </div>
  )
}

function ToggleField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 col-span-full">
      <button
        onClick={() => onChange(!value)}
        className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 mt-0.5"
        style={{ background: value ? FERRARI_RED : 'rgba(255,255,255,0.12)' }}>
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
      </button>
      <div>
        <div className="text-sm font-semibold" style={{ color: '#F1F1F1' }}>{label}</div>
        {hint && <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{hint}</div>}
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function MarcacionConfigPage() {
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId
  const qc = useQueryClient()

  const [form, setForm] = useState<MarcacionConfig>(DEFAULTS)
  const [dirty, setDirty] = useState(false)

  const cfgQ = useQuery({
    queryKey: ['marcacion-config', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchConfig(tenantId!),
  })

  useEffect(() => {
    if (cfgQ.data) { setForm(cfgQ.data); setDirty(false) }
  }, [cfgQ.data])

  const f = <K extends keyof MarcacionConfig>(k: K, v: MarcacionConfig[K]) => {
    setForm(p => ({ ...p, [k]: v }))
    setDirty(true)
  }

  const saveM = useMutation({
    mutationFn: () => saveConfig(tenantId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marcacion-config'] })
      toast.success('Configuración de marcación guardada')
      setDirty(false)
    },
    onError: (e: any) => {
      // Si la tabla no existe, mostrar instrucción clara
      if (e.message?.includes('does not exist') || e.message?.includes('42P01')) {
        toast.error('Tabla config_marcacion no encontrada. Ejecuta el SQL de migración.')
      } else {
        toast.error(e.message ?? 'Error al guardar')
      }
    },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-0.5 rounded" style={{ background: FERRARI_RED }} />
            <span className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: FERRARI_RED }}>Configuración</span>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#F1F1F1' }}>
            Parámetros de Marcación
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Define las tolerancias y la lógica de clasificación de cada marcación.
          </p>
        </div>
        <button
          onClick={() => saveM.mutate()}
          disabled={saveM.isPending || !dirty}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40"
          style={{
            background: dirty ? FERRARI_RED : 'rgba(220,38,38,0.2)',
            color: 'white',
          }}>
          {saveM.isPending
            ? <Loader2 size={15} className="animate-spin" />
            : <Save size={15} />}
          Guardar cambios
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Los minutos de gracia se aplican <strong style={{ color: '#F1F1F1' }}>globalmente</strong> a todos
          los empleados, a menos que el horario del turno tenga una configuración específica que la sobreescriba.
          La lógica de marcación determina qué evento se registra para cada punch.
        </p>
      </div>

      {cfgQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: FERRARI_RED }} />
        </div>
      ) : (
        <div className="space-y-4">

          {/* Minutos de gracia */}
          <FieldGroup title="Minutos de gracia">
            <MinutesField
              label="Entrada"
              hint="Marcación válida hasta X minutos después de la hora de entrada"
              value={form.grace_entry_minutes}
              onChange={v => f('grace_entry_minutes', v)}
            />
            <MinutesField
              label="Salida"
              hint="Salida anticipada aceptada hasta X minutos antes de la hora de salida"
              value={form.grace_exit_minutes}
              onChange={v => f('grace_exit_minutes', v)}
            />
            <MinutesField
              label="Salida a comer"
              hint="Tolerancia para la marcación de salida al almuerzo"
              value={form.grace_meal_out_minutes}
              onChange={v => f('grace_meal_out_minutes', v)}
            />
            <MinutesField
              label="Entrada de comer"
              hint="Tolerancia para la marcación de regreso del almuerzo"
              value={form.grace_meal_in_minutes}
              onChange={v => f('grace_meal_in_minutes', v)}
            />
          </FieldGroup>

          {/* Lógica de marcación */}
          <FieldGroup title="Lógica de marcación">
            <ToggleField
              label="Entrada = primera marcación del turno"
              hint="La primera vez que el empleado marca en el día se registra como entrada"
              value={form.entry_is_first_punch}
              onChange={v => f('entry_is_first_punch', v)}
            />
            <ToggleField
              label="Salida = última marcación del turno"
              hint="La última marcación del día se registra como salida"
              value={form.exit_is_last_punch}
              onChange={v => f('exit_is_last_punch', v)}
            />
          </FieldGroup>

          {/* Ventanas para comida */}
          <FieldGroup title="Ventanas de marcación para almuerzo">
            <MinutesField
              label="Salida a comer — antes"
              hint="Minutos ANTES de la hora parametrizada que se acepta la marcación"
              value={form.meal_out_window_before}
              onChange={v => f('meal_out_window_before', v)}
            />
            <MinutesField
              label="Salida a comer — después"
              hint="Minutos DESPUÉS de la hora parametrizada que se acepta la marcación"
              value={form.meal_out_window_after}
              onChange={v => f('meal_out_window_after', v)}
            />
            <MinutesField
              label="Entrada de comer — antes"
              hint="Minutos ANTES de la hora parametrizada que se acepta la marcación"
              value={form.meal_in_window_before}
              onChange={v => f('meal_in_window_before', v)}
            />
            <MinutesField
              label="Entrada de comer — después"
              hint="Minutos DESPUÉS de la hora parametrizada que se acepta la marcación"
              value={form.meal_in_window_after}
              onChange={v => f('meal_in_window_after', v)}
            />
          </FieldGroup>

          {/* Reglas de novedad */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(18,18,24,0.9)', border: '1px solid rgba(220,38,38,0.2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ background: FERRARI_RED }} />
              <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: FERRARI_RED }}>
                Reglas de clasificación
              </h3>
            </div>
            <div className="space-y-3 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {[
                ['Entrada', `Marcación hasta ${form.grace_entry_minutes} min después de la hora de entrada`, '#10B981'],
                ['Atrasado', `Marcación más de ${form.grace_entry_minutes} min después de la hora de entrada`, FERRARI_RED],
                ['Salida a comer', `Marcación ${form.meal_out_window_before} min antes / ${form.meal_out_window_after} min después`, '#F59E0B'],
                ['Entrada de comer', `Marcación ${form.meal_in_window_before} min antes / ${form.meal_in_window_after} min después`, '#3B82F6'],
                ['Salida', `Última marcación, hasta ${form.grace_exit_minutes} min antes de la hora de salida`, '#8B5CF6'],
                ['Novedad', 'Cualquier marcación que no encaja en las reglas anteriores', '#F97316'],
              ].map(([label, desc, color]) => (
                <div key={label as string} className="flex items-start gap-3 rounded-xl px-4 py-2.5"
                  style={{ background: `${color}0A`, border: `1px solid ${color}20` }}>
                  <span className="font-bold w-28 flex-shrink-0" style={{ color: color as string }}>{label}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SQL note */}
          <div className="rounded-2xl px-5 py-4"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Settings size={13} style={{ color: '#F59E0B' }} />
              <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>Tabla requerida en BD</span>
            </div>
            <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Si aparece error al guardar, ejecuta en Supabase SQL Editor:
            </p>
            <pre className="mt-2 text-[10px] rounded-lg p-3 overflow-x-auto"
              style={{ background: 'rgba(0,0,0,0.3)', color: '#10B981' }}>
{`CREATE TABLE IF NOT EXISTS attendance.config_marcacion (
  tenant_id               uuid PRIMARY KEY REFERENCES public.tenants(id),
  grace_entry_minutes     integer NOT NULL DEFAULT 10,
  grace_exit_minutes      integer NOT NULL DEFAULT 10,
  grace_meal_out_minutes  integer NOT NULL DEFAULT 5,
  grace_meal_in_minutes   integer NOT NULL DEFAULT 5,
  entry_is_first_punch    boolean NOT NULL DEFAULT true,
  exit_is_last_punch      boolean NOT NULL DEFAULT true,
  meal_out_window_before  integer NOT NULL DEFAULT 10,
  meal_out_window_after   integer NOT NULL DEFAULT 15,
  meal_in_window_before   integer NOT NULL DEFAULT 10,
  meal_in_window_after    integer NOT NULL DEFAULT 15,
  updated_at              timestamptz DEFAULT now()
);
ALTER TABLE attendance.config_marcacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY marcacion_cfg_policy ON attendance.config_marcacion
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt()->'user_metadata'->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt()->'user_metadata'->>'tenant_id')::uuid);`}
            </pre>
          </div>

        </div>
      )}
    </div>
  )
}
