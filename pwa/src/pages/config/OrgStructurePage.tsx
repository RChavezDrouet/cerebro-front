import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, BarChart3, Building2, Plus, Save, Sparkles } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OrgTree } from '@/components/org/OrgTree'
import { OrgUnitForm } from '@/components/org/OrgUnitForm'
import { OrgChart3D } from '@/components/org/OrgChart3D'
import {
  ORG_MIGRATION_HINT,
  defaultOrgLevels,
  fetchEmployeeLookup,
  fetchOrgLevelDefinitions,
  fetchOrgUnits,
  isMissingOrgSchemaError,
  saveOrgLevelDefinitions,
  softDeleteOrgUnit,
  type OrgLevelDefinition,
  type OrgUnit,
  upsertOrgUnit,
} from '@/lib/orgStructure'

type ViewMode = 'graphic' | 'list'

export default function OrgStructurePage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const tctx = useTenantContext(user?.id)
  const tenantId = tctx.data?.tenantId

  const [editingLevels, setEditingLevels] = React.useState<OrgLevelDefinition[]>([])
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedUnit, setSelectedUnit] = React.useState<OrgUnit | null>(null)
  const [viewMode, setViewMode] = React.useState<ViewMode>('graphic')

  const levelsQuery = useQuery({
    queryKey: ['org-levels', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchOrgLevelDefinitions(tenantId!),
  })

  const unitsQuery = useQuery({
    queryKey: ['org-units', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchOrgUnits(tenantId!),
  })

  const employeesQuery = useQuery({
    queryKey: ['org-employee-lookup', tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchEmployeeLookup(tenantId!),
  })

  React.useEffect(() => {
    if (levelsQuery.data) {
      setEditingLevels(levelsQuery.data)
    } else if (tenantId) {
      setEditingLevels(defaultOrgLevels(tenantId))
    }
  }, [levelsQuery.data, tenantId])

  const saveLevelsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant')
      await saveOrgLevelDefinitions(tenantId, editingLevels)
    },
    onSuccess: async () => {
      toast.success('Niveles organizacionales guardados')
      await qc.invalidateQueries({ queryKey: ['org-levels', tenantId] })
      setViewMode('graphic')
    },
    onError: (error: any) => {
      toast.error(isMissingOrgSchemaError(error) ? ORG_MIGRATION_HINT : error?.message || 'No se pudo guardar')
    },
  })

  const saveUnitMutation = useMutation({
    mutationFn: async (payload: Partial<OrgUnit>) => {
      if (!tenantId) throw new Error('Sin tenant')
      if (!payload.name?.trim()) throw new Error('El nombre es obligatorio')
      if (!payload.code?.trim()) throw new Error('El código es obligatorio')
      if (!payload.level_no) throw new Error('Selecciona el nivel')
      await upsertOrgUnit(tenantId, { ...payload, id: selectedUnit?.id })
    },
    onSuccess: async () => {
      toast.success(selectedUnit ? 'Unidad actualizada' : 'Unidad creada')
      setModalOpen(false)
      setSelectedUnit(null)
      await qc.invalidateQueries({ queryKey: ['org-units', tenantId] })
      setViewMode('graphic')
    },
    onError: (error: any) => {
      toast.error(isMissingOrgSchemaError(error) ? ORG_MIGRATION_HINT : error?.message || 'No se pudo guardar la unidad')
    },
  })

  const deleteUnitMutation = useMutation({
    mutationFn: async (unit: OrgUnit) => {
      if (!tenantId) throw new Error('Sin tenant')
      await softDeleteOrgUnit(tenantId, unit.id)
    },
    onSuccess: async () => {
      toast.success('Unidad desactivada')
      await qc.invalidateQueries({ queryKey: ['org-units', tenantId] })
    },
    onError: (error: any) => {
      toast.error(isMissingOrgSchemaError(error) ? ORG_MIGRATION_HINT : error?.message || 'No se pudo eliminar')
    },
  })

  const schemaHint =
    levelsQuery.error && isMissingOrgSchemaError(levelsQuery.error)
      ? ORG_MIGRATION_HINT
      : unitsQuery.error && isMissingOrgSchemaError(unitsQuery.error)
        ? ORG_MIGRATION_HINT
        : null

  const activeLevels = editingLevels.filter((row) => row.is_enabled)
  const activeUnits = (unitsQuery.data ?? []).filter((row) => row.is_active !== false)

  const openCreateModal = React.useCallback(() => {
    setSelectedUnit(null)
    setModalOpen(true)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold">Organigrama / Estructura organizacional</h1>
          <p className="mt-1 text-sm text-white/60">
            Define los niveles jerárquicos y luego crea las unidades reales del organigrama. Ahora incluye una vista gráfica con profundidad y colores vivos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" leftIcon={<Sparkles size={16} />} onClick={() => setViewMode('graphic')}>
            Vista gráfica
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={openCreateModal}>
            Nueva unidad
          </Button>
        </div>
      </div>

      {schemaHint && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Migración requerida</div>
            <div className="text-amber-100/80">{schemaHint}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 xl:col-span-1">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Resumen</div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-3xl font-black text-white">{activeLevels.length}</div>
              <div className="text-sm text-white/60">niveles habilitados</div>
            </div>
            <div>
              <div className="text-3xl font-black text-white">{activeUnits.length}</div>
              <div className="text-sm text-white/60">unidades registradas</div>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
              Guardar niveles <b>no crea nodos</b>. Eso solo define los nombres de los niveles. Para que el organigrama se vea, debes crear unidades con <b>“Nueva unidad”</b>.
            </div>
          </div>
        </div>

        <div className="xl:col-span-3">
          <Card title="Definición de niveles" actions={<Building2 size={18} className="text-white/60" />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {editingLevels.map((row, idx) => (
                <div key={row.level_no} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Nivel {row.level_no}</div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingLevels((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, is_enabled: !item.is_enabled } : item)),
                        )
                      }
                      className={`flex h-6 w-11 items-center rounded-full px-1 transition ${row.is_enabled ? 'justify-end bg-emerald-500/70' : 'justify-start bg-white/15'}`}
                    >
                      <span className="h-4 w-4 rounded-full bg-white" />
                    </button>
                  </div>
                  <Input
                    label="Nombre visible"
                    value={row.display_name}
                    onChange={(e) =>
                      setEditingLevels((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, display_name: e.target.value } : item)),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                leftIcon={<Save size={16} />}
                onClick={() => saveLevelsMutation.mutate()}
                disabled={saveLevelsMutation.isPending}
              >
                {saveLevelsMutation.isPending ? 'Guardando…' : 'Guardar niveles'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Organigrama gráfico"
        subtitle="Vista visual 3D con colores intensos, jerarquía clara y profundidad"
        actions={<Sparkles size={18} className="text-fuchsia-300" />}
      >
        <OrgChart3D
          units={unitsQuery.data ?? []}
          levels={editingLevels}
          employees={employeesQuery.data ?? []}
        />
      </Card>

      <Card
        title="Administración de unidades"
        subtitle="Aquí creas, editas o desactivas los nodos reales que alimentan el organigrama"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('graphic')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'graphic' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <span className="inline-flex items-center gap-1.5"><Sparkles size={13} /> Gráfico</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'list' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              <span className="inline-flex items-center gap-1.5"><BarChart3 size={13} /> Lista</span>
            </button>
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={openCreateModal}>
              Nueva unidad
            </Button>
          </div>
        }
      >
        {viewMode === 'graphic' ? (
          <OrgChart3D
            units={unitsQuery.data ?? []}
            levels={editingLevels}
            employees={employeesQuery.data ?? []}
          />
        ) : (
          <OrgTree
            units={unitsQuery.data ?? []}
            onEdit={(unit) => {
              setSelectedUnit(unit)
              setModalOpen(true)
            }}
            onDelete={(unit) => deleteUnitMutation.mutate(unit)}
          />
        )}
      </Card>

      <OrgUnitForm
        open={modalOpen}
        initial={selectedUnit}
        levels={editingLevels}
        parents={unitsQuery.data ?? []}
        employees={employeesQuery.data ?? []}
        onClose={() => {
          setModalOpen(false)
          setSelectedUnit(null)
        }}
        onSave={(payload) => saveUnitMutation.mutate(payload)}
        saving={saveUnitMutation.isPending}
      />
    </div>
  )
}
