import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, Plus, Save, Settings2, Sparkles, Users, Workflow } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantContext } from '@/hooks/useTenantContext'
import { ApprovalFlowQuickSetupModal } from '@/features/approvals/components/ApprovalFlowQuickSetupModal'
import { ApprovalGroupManager } from '@/features/approvals/components/ApprovalGroupManager'
import { ApprovalFlowStepEditor } from '@/features/approvals/components/ApprovalFlowStepEditor'
import {
  APPROVER_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  EXECUTION_MODE_OPTIONS,
} from '@/features/approvals/constants'
import {
  getApprovalFlowDefinition,
  getApprovalSetupContext,
  listApprovalFlowCatalog,
  listApprovalFlowSummaries,
  listApproverGroups,
  saveApprovalFlowDefinition,
  upsertApproverGroup,
} from '@/features/approvals/services/approvalFlows'
import type { QuickSetupResult } from '@/features/approvals/quickSetup'
import { buildQuickApproverSeed, buildQuickSetupResult } from '@/features/approvals/quickSetup'
import { buildEmptyStep, getApproverDescriptor, reorderSteps } from '@/features/approvals/utils'
import type {
  ApprovalFlowCatalogItem,
  ApprovalFlowStepInput,
  ApprovalFlowSummary,
  ApprovalSetupContext,
  UpsertApprovalFlowDefinitionInput,
  UpsertApproverGroupInput,
} from '@/features/approvals/types'

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
        checked
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
          : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)]'
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full px-1 transition ${
          checked ? 'justify-end bg-emerald-500/70' : 'justify-start bg-white/10'
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </button>
  )
}

function ensureManagerFirst(steps: ApprovalFlowStepInput[]): ApprovalFlowStepInput[] {
  const nextSteps = steps.length > 0 ? [...steps] : [buildEmptyStep(1)]

  return nextSteps.map((step, index) => {
    if (index === 0) {
      return {
        ...step,
        step_order: 1,
        step_name: step.step_name.trim() || 'Jefe inmediato',
        approver_type: 'manager',
        approver_role_code: null,
        approver_user_id: null,
        approver_group_id: null,
      }
    }

    return {
      ...step,
      step_order: index + 1,
      step_name: step.step_name.trim() || `Nivel ${index + 1}`,
    }
  })
}

function buildDraftFromCatalog(
  catalogItem: ApprovalFlowCatalogItem,
  summary: ApprovalFlowSummary | undefined,
  definitionData: Awaited<ReturnType<typeof getApprovalFlowDefinition>>,
): UpsertApprovalFlowDefinitionInput {
  if (definitionData.definition) {
    return {
      flow_code: definitionData.definition.flow_code,
      flow_name: definitionData.definition.flow_name,
      applies_to_module: definitionData.definition.applies_to_module,
      description: definitionData.definition.description,
      is_active: definitionData.definition.is_active,
      execution_mode: definitionData.definition.execution_mode,
      reject_any_step_closes: definitionData.definition.reject_any_step_closes,
      activate_next_on_approval: definitionData.definition.activate_next_on_approval,
      allow_auto_first_step: definitionData.definition.allow_auto_first_step,
      steps: ensureManagerFirst(definitionData.steps.map((step) => ({
        step_order: step.step_order,
        step_name: step.step_name,
        approver_type: step.approver_type,
        approver_role_code: step.approver_role_code,
        approver_user_id: step.approver_user_id,
        approver_group_id: step.approver_group_id,
        is_required: step.is_required,
        allow_delegate: step.allow_delegate,
        parallel_group: step.parallel_group,
        candidate_resolution: step.candidate_resolution,
        auto_rule_enabled: step.auto_rule_enabled,
        auto_rule: step.auto_rule,
      }))),
    }
  }

  const fallbackSteps: ApprovalFlowStepInput[] = (catalogItem.fallback_strategy ?? []).map((step, index) => ({
    step_order: step.step_order ?? index + 1,
    step_name: step.step_name || `Nivel ${index + 1}`,
    approver_type: step.approver_type,
    approver_role_code: step.approver_role_code ?? null,
    approver_user_id: step.approver_user_id ?? null,
    approver_group_id: step.approver_group_id ?? null,
    is_required: step.is_required ?? true,
    allow_delegate: step.allow_delegate ?? false,
    parallel_group: step.parallel_group ?? null,
    candidate_resolution: step.candidate_resolution ?? 'shared_queue',
    auto_rule_enabled: step.auto_rule_enabled ?? false,
    auto_rule: step.auto_rule ?? {},
  }))

  return {
    flow_code: catalogItem.flow_code,
    flow_name: summary?.tenant_flow_name || catalogItem.flow_name,
    applies_to_module: catalogItem.applies_to_module,
    description: catalogItem.description,
    is_active: summary?.configured_is_active ?? true,
    execution_mode: summary?.execution_mode ?? 'sequential',
    reject_any_step_closes: summary?.reject_any_step_closes ?? true,
    activate_next_on_approval: summary?.activate_next_on_approval ?? true,
    allow_auto_first_step: summary?.allow_auto_first_step ?? false,
    steps: ensureManagerFirst(fallbackSteps),
  }
}

export default function ApprovalFlowsPage() {
  const qc = useQueryClient()
  const dragIndexRef = React.useRef<number | null>(null)

  const { user } = useAuth()
  const tenantContext = useTenantContext(user?.id)

  const catalogQuery = useQuery({
    queryKey: ['approval-flow-catalog'],
    queryFn: listApprovalFlowCatalog,
  })

  const summaryQuery = useQuery({
    queryKey: ['approval-flow-summary'],
    queryFn: listApprovalFlowSummaries,
  })

  const setupContextQuery = useQuery({
    queryKey: ['approval-setup-context'],
    queryFn: getApprovalSetupContext,
  })

  const groupsQuery = useQuery({
    queryKey: ['approval-approver-groups'],
    queryFn: listApproverGroups,
  })

  const [selectedFlowCode, setSelectedFlowCode] = React.useState<string>('')
  const [draft, setDraft] = React.useState<UpsertApprovalFlowDefinitionInput | null>(null)
  const [quickSetupOpen, setQuickSetupOpen] = React.useState(false)
  const [quickSetupByFlow, setQuickSetupByFlow] = React.useState<Record<string, QuickSetupResult>>({})

  React.useEffect(() => {
    if (!selectedFlowCode && (catalogQuery.data?.length ?? 0) > 0) {
      setSelectedFlowCode(catalogQuery.data?.[0]?.flow_code ?? '')
    }
  }, [catalogQuery.data, selectedFlowCode])

  const selectedCatalogItem = React.useMemo(
    () => catalogQuery.data?.find((item) => item.flow_code === selectedFlowCode),
    [catalogQuery.data, selectedFlowCode],
  )

  const selectedSummary = React.useMemo(
    () => summaryQuery.data?.find((item) => item.flow_code === selectedFlowCode),
    [selectedFlowCode, summaryQuery.data],
  )

  const definitionQuery = useQuery({
    queryKey: ['approval-flow-definition', selectedFlowCode],
    enabled: !!selectedFlowCode,
    queryFn: () => getApprovalFlowDefinition(selectedFlowCode),
  })

  React.useEffect(() => {
    if (!selectedCatalogItem || !definitionQuery.data) return
    setDraft(buildDraftFromCatalog(selectedCatalogItem, selectedSummary, definitionQuery.data))
  }, [definitionQuery.data, selectedCatalogItem, selectedSummary])

  const saveFlowMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No hay flujo seleccionado')
      if (draft.steps.length === 0) throw new Error('Agrega al menos un nivel')
      if (draft.steps[0]?.approver_type !== 'manager') {
        throw new Error('El nivel 1 debe mantenerse como jefe inmediato')
      }

      for (const step of draft.steps) {
        if (step.step_name.trim() === '') throw new Error('Todos los niveles deben tener nombre')
        if (step.approver_type === 'role' && !step.approver_role_code) throw new Error('Selecciona un rol para cada nivel por rol')
        if (step.approver_type === 'specific_user' && !step.approver_user_id) throw new Error('Selecciona un usuario especifico')
        if (step.approver_type === 'approver_group' && !step.approver_group_id) throw new Error('Selecciona un grupo aprobador')
      }

      await saveApprovalFlowDefinition({
        ...draft,
        steps: ensureManagerFirst(draft.steps),
      })
    },
    onSuccess: async () => {
      toast.success('Flujo guardado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['approval-flow-summary'] }),
        qc.invalidateQueries({ queryKey: ['approval-flow-definition', selectedFlowCode] }),
      ])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo guardar el flujo')
    },
  })

  const saveGroupMutation = useMutation({
    mutationFn: async (input: UpsertApproverGroupInput) => {
      await upsertApproverGroup(input)
    },
    onSuccess: async () => {
      toast.success('Grupo aprobador guardado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['approval-approver-groups'] }),
        qc.invalidateQueries({ queryKey: ['approval-setup-context'] }),
      ])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo guardar el grupo')
    },
  })

  const handleStepChange = React.useCallback((index: number, patch: Partial<ApprovalFlowStepInput>) => {
    setDraft((current) => {
      if (!current) return current
      const nextSteps = current.steps.map((step, stepIndex) => (
        stepIndex === index ? { ...step, ...patch } : step
      ))
      return { ...current, steps: ensureManagerFirst(nextSteps) }
    })
  }, [])

  const handleMoveStep = React.useCallback((fromIndex: number, toIndex: number) => {
    setDraft((current) => {
      if (!current) return current
      if (fromIndex === 0 || toIndex === 0) return current
      return { ...current, steps: ensureManagerFirst(reorderSteps(current.steps, fromIndex, toIndex)) }
    })
  }, [])

  const handleAddStep = React.useCallback(() => {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        steps: ensureManagerFirst([...current.steps, buildEmptyStep(current.steps.length + 1)]),
      }
    })
  }, [])

  const handleRemoveStep = React.useCallback((index: number) => {
    setDraft((current) => {
      if (!current) return current
      if (index === 0) return current
      const next = current.steps.filter((_, stepIndex) => stepIndex !== index)
      return {
        ...current,
        steps: ensureManagerFirst(next),
      }
    })
  }, [])

  const handleApplyQuickSetup = React.useCallback((result: QuickSetupResult) => {
    if (!selectedFlowCode) return

    setQuickSetupByFlow((current) => ({
      ...current,
      [selectedFlowCode]: result,
    }))

    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        execution_mode: 'sequential',
        activate_next_on_approval: true,
        steps: ensureManagerFirst(result.steps),
      }
    })
  }, [selectedFlowCode])

  const context: ApprovalSetupContext | null = setupContextQuery.data ?? null
  const groups = groupsQuery.data ?? []

  const configuredCount = (summaryQuery.data ?? []).filter((item) => item.is_configured).length
  const fallbackCount = (summaryQuery.data ?? []).filter((item) => !item.is_configured).length
  const currentQuickSetup = React.useMemo(() => {
    if (!selectedFlowCode) return null
    return quickSetupByFlow[selectedFlowCode] ?? buildQuickSetupResult(
      buildQuickApproverSeed(Math.min(Math.max(selectedSummary?.level_count ?? 2, 1), 4)),
    )
  }, [quickSetupByFlow, selectedFlowCode, selectedSummary?.level_count])

  if (tenantContext.isLoading || catalogQuery.isLoading || summaryQuery.isLoading || setupContextQuery.isLoading || groupsQuery.isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-[#08111d]/92 px-5 py-6 shadow-soft sm:px-6">
        <div className="pointer-events-none absolute -right-20 top-0 h-52 w-52 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-20 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="warn">Configuracion comercial</Badge>
              <Badge tone="good">Nivel 1 obligatorio</Badge>
              <Badge tone="info">Demo lista para pruebas</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.2rem]">Flujos de aprobacion</h1>
              <p className="max-w-3xl text-sm leading-6 text-white/72 sm:text-base">
                Ahora la configuracion incluye un asistente rapido con datos ficticios para demos y pruebas. El primer nivel
                siempre queda como jefe inmediato y luego puedes definir cuantos niveles necesitas antes de bajar al editor
                tecnico.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button leftIcon={<Sparkles size={16} />} onClick={() => setQuickSetupOpen(true)} disabled={!selectedFlowCode}>
                Configuracion rapida
              </Button>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/72">
                La opcion guiada soporta de 1 a 4 niveles para presentacion comercial.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
                  <Workflow size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Procesos configurables</div>
                <p className="mt-1 text-sm text-white/60">8 procesos listos para configurar por tenant.</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
                  <Users size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Con flujo propio</div>
                <p className="mt-1 text-sm text-white/60">{configuredCount} procesos ya tienen definicion especifica.</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
                  <Settings2 size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Fallback activo</div>
                <p className="mt-1 text-sm text-white/60">{fallbackCount} procesos dependen aun del fallback del catalogo.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <Card
              title="Plantilla demo para presentacion"
              subtitle={selectedCatalogItem ? selectedCatalogItem.flow_name : 'Selecciona un proceso'}
              className="rounded-[2rem] border-white/10 bg-white/7 text-white"
              actions={<Badge tone="info">{currentQuickSetup?.level_count ?? 1} nivel(es)</Badge>}
            >
              <div className="space-y-3">
                {(currentQuickSetup?.approvers ?? []).map((approver) => (
                  <div key={approver.step_order} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={approver.step_order === 1 ? 'good' : 'neutral'}>Nivel {approver.step_order}</Badge>
                      <span className="text-sm font-semibold">{approver.job_title}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
                      <Mail size={14} />
                      {approver.email}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Regla base del motor"
              subtitle="Esto queda fijo incluso en modo demo."
              className="rounded-[2rem]"
              actions={<Badge tone="good">Obligatorio</Badge>}
            >
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                Siempre debe existir al menos un nivel de aprobacion y el primer nivel se reserva para el jefe inmediato.
                Luego el asistente abre una ventana para capturar por separado el correo y el cargo de los aprobadores demo.
              </div>
            </Card>
          </div>
        </div>
      </section>

      <Card title="Procesos configurables" subtitle="Cada tarjeta resume estado, niveles y aprobador inicial del proceso.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(summaryQuery.data ?? []).map((summary) => {
            const selected = summary.flow_code === selectedFlowCode
            return (
              <button
                key={summary.flow_code}
                type="button"
                onClick={() => setSelectedFlowCode(summary.flow_code)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selected
                    ? 'border-cyan-400/40 bg-cyan-400/10 shadow-soft'
                    : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:border-cyan-400/20 hover:bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{summary.catalog_flow_name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{summary.applies_to_module}</div>
                  </div>
                  <Badge tone={summary.is_configured ? 'good' : 'neutral'}>
                    {summary.is_configured ? (summary.configured_is_active ? 'Configurado' : 'Inactivo') : 'Fallback'}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                  <div>{summary.level_count} nivel(es)</div>
                  <div>Inicio: {summary.first_step_name ?? 'Sin definir'}</div>
                  <div>Aprobador inicial: {summary.first_approver_type ? APPROVER_TYPE_LABELS[summary.first_approver_type] : 'Sin definir'}</div>
                  <div>
                    Actualizado:{' '}
                    {summary.updated_at
                      ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(summary.updated_at))
                      : 'Sin cambios'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {draft && selectedCatalogItem ? (
        <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
          <div className="space-y-5">
            <Card
              title={draft.flow_name}
              subtitle={`Codigo: ${draft.flow_code}`}
              actions={
                <Button leftIcon={<Save size={15} />} onClick={() => saveFlowMutation.mutate()} disabled={saveFlowMutation.isPending}>
                  {saveFlowMutation.isPending ? 'Guardando...' : 'Guardar flujo'}
                </Button>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Nombre del flujo</label>
                  <input
                    value={draft.flow_name}
                    onChange={(event) => setDraft((current) => (current ? { ...current, flow_name: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Descripcion</label>
                  <textarea
                    value={draft.description ?? ''}
                    onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                    rows={3}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Modo de ejecucion</label>
                  <select
                    value={draft.execution_mode}
                    onChange={(event) =>
                      setDraft((current) => current ? {
                        ...current,
                        execution_mode: event.target.value as UpsertApprovalFlowDefinitionInput['execution_mode'],
                        activate_next_on_approval: event.target.value === 'parallel' ? false : current.activate_next_on_approval,
                      } : current)
                    }
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  >
                    {EXECUTION_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[var(--color-header)] text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle label="Flujo activo" checked={draft.is_active} onChange={(next) => setDraft((current) => current ? { ...current, is_active: next } : current)} />
                  <Toggle
                    label="Rechazo cierra"
                    checked={draft.reject_any_step_closes}
                    onChange={(next) => setDraft((current) => current ? { ...current, reject_any_step_closes: next } : current)}
                  />
                  <Toggle
                    label="Siguiente nivel tras aprobar"
                    checked={draft.activate_next_on_approval}
                    onChange={(next) => setDraft((current) => current ? { ...current, activate_next_on_approval: next } : current)}
                  />
                  <Toggle
                    label="Auto primer nivel"
                    checked={draft.allow_auto_first_step}
                    onChange={(next) => setDraft((current) => current ? { ...current, allow_auto_first_step: next } : current)}
                  />
                </div>
              </div>
            </Card>

            <Card
              title="Editor de niveles"
              subtitle="El nivel 1 queda fijo como jefe inmediato. Desde el nivel 2 puedes ajustar la configuracion tecnica."
              actions={<Button size="sm" leftIcon={<Plus size={14} />} onClick={handleAddStep}>Agregar nivel</Button>}
            >
              <div className="space-y-4">
                {draft.steps.map((step, index) => (
                  <ApprovalFlowStepEditor
                    key={`${selectedFlowCode}-${index}`}
                    step={step}
                    index={index}
                    totalSteps={draft.steps.length}
                    roles={context?.roles ?? []}
                    users={context?.users ?? []}
                    groups={groups}
                    lockAsImmediateManager={index === 0}
                    disableMoveUp={index === 0 || index === 1}
                    disableMoveDown={index === 0}
                    disableRemove={index === 0}
                    onChange={(patch) => handleStepChange(index, patch)}
                    onMoveUp={() => handleMoveStep(index, Math.max(index - 1, 0))}
                    onMoveDown={() => handleMoveStep(index, Math.min(index + 1, draft.steps.length - 1))}
                    onRemove={() => handleRemoveStep(index)}
                    onDragStart={(dragIndex) => {
                      dragIndexRef.current = dragIndex
                    }}
                    onDragOver={() => undefined}
                    onDrop={(dropIndex) => {
                      const dragIndex = dragIndexRef.current
                      if (dragIndex == null || dragIndex === dropIndex) return
                      handleMoveStep(dragIndex, dropIndex)
                      dragIndexRef.current = null
                    }}
                  />
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card
              title="Vista previa"
              subtitle="Lo que el motor ejecutara cuando este proceso se envie a aprobacion."
              actions={<Workflow size={18} className="text-cyan-300" />}
            >
              <div className="space-y-3">
                {draft.steps.map((step) => (
                  <div key={`${step.step_order}-${step.step_name}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                    <div className="flex items-center gap-2">
                      <Badge tone={step.step_order === 1 ? 'good' : 'info'}>Nivel {step.step_order}</Badge>
                      <div className="text-sm font-semibold">{step.step_name}</div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-secondary)]">
                      {getApproverDescriptor(step, context ?? null)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {step.is_required ? 'Requerido' : 'Opcional'} - {step.candidate_resolution === 'shared_queue' ? 'Bandeja compartida' : 'Primer usuario'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Comportamiento del flujo" actions={<Settings2 size={18} className="text-white/50" />}>
              <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                  Modo: <span className="font-semibold">{draft.execution_mode === 'parallel' ? 'Paralela' : 'Secuencial'}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                  Estado por defecto del motor: <span className="font-semibold">{APPROVAL_STATUS_LABELS.en_aprobacion}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                  Rechazo inmediato: <span className="font-semibold">{draft.reject_any_step_closes ? 'Si' : 'No'}</span>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                  Fallback catalogo: <span className="font-semibold">{selectedCatalogItem.flow_name}</span>
                </div>
              </div>
            </Card>

            <ApprovalGroupManager
              groups={groups}
              users={context?.users ?? []}
              saving={saveGroupMutation.isPending}
              onSave={async (input) => saveGroupMutation.mutateAsync(input)}
            />
          </div>
        </div>
      ) : null}

      <ApprovalFlowQuickSetupModal
        open={quickSetupOpen}
        flowName={selectedCatalogItem?.flow_name ?? 'Flujo de aprobacion'}
        initialLevelCount={Math.min(Math.max(draft?.steps.length ?? selectedSummary?.level_count ?? 2, 1), 4)}
        onClose={() => setQuickSetupOpen(false)}
        onApply={handleApplyQuickSetup}
      />
    </div>
  )
}
