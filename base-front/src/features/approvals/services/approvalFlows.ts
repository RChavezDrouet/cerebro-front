import { supabase } from '@/config/supabase'
import type {
  ApprovalApproverGroup,
  ApprovalApproverGroupMember,
  ApprovalApproverGroupWithMembers,
  ApprovalFlowCatalogItem,
  ApprovalFlowDefinition,
  ApprovalFlowStep,
  ApprovalFlowStepInput,
  ApprovalFlowSummary,
  ApprovalHistoryPayload,
  ApprovalSetupContext,
  PendingApprovalItem,
  SubmitApprovalRequestInput,
  UpsertApprovalFlowDefinitionInput,
  UpsertApproverGroupInput,
} from '../types'

function ensure<T>(value: T | null, message: string): T {
  if (value == null) {
    throw new Error(message)
  }
  return value
}

const DEMO_TENANT_ID = '00000000-0000-4000-8000-000000000001'
const DEMO_DEFINITION_KEY = 'hrcloud.demo.approval_flow_definitions.v1'
const DEMO_GROUP_KEY = 'hrcloud.demo.approval_groups.v1'

const DEMO_USERS = [
  {
    user_id: '11111111-1111-4111-8111-111111111111',
    employee_id: '21111111-1111-4111-8111-111111111111',
    full_name: 'Carla Gomez',
    employee_code: 'EMP-001',
  },
  {
    user_id: '22222222-2222-4222-8222-222222222222',
    employee_id: '32222222-2222-4222-8222-222222222222',
    full_name: 'Miguel Andrade',
    employee_code: 'EMP-002',
  },
  {
    user_id: '33333333-3333-4333-8333-333333333333',
    employee_id: '43333333-3333-4333-8333-333333333333',
    full_name: 'Daniela Ruiz',
    employee_code: 'EMP-003',
  },
] satisfies ApprovalSetupContext['users']

const DEFAULT_DEMO_GROUPS: ApprovalApproverGroupWithMembers[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    tenant_id: DEMO_TENANT_ID,
    code: 'rrhh_demo',
    name: 'RRHH Demo',
    description: 'Grupo ficticio de RRHH para pruebas visuales',
    group_kind: 'hr_responsible',
    is_active: true,
    member_user_ids: ['33333333-3333-4333-8333-333333333333'],
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    tenant_id: DEMO_TENANT_ID,
    code: 'nomina_demo',
    name: 'Nomina Demo',
    description: 'Grupo ficticio de nomina para pruebas visuales',
    group_kind: 'payroll_responsible',
    is_active: true,
    member_user_ids: ['22222222-2222-4222-8222-222222222222'],
  },
]

const DEMO_CATALOG: ApprovalFlowCatalogItem[] = [
  {
    flow_code: 'attendance_late_justification',
    flow_name: 'Justificacion de atraso',
    applies_to_module: 'attendance',
    source_table: 'attendance_justifications',
    description: 'Flujo para justificar atrasos de marcacion.',
    is_active: true,
    fallback_strategy: [{ step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' }],
  },
  {
    flow_code: 'attendance_absence_justification',
    flow_name: 'Justificacion de falta',
    applies_to_module: 'attendance',
    source_table: 'attendance_justifications',
    description: 'Flujo para justificar faltas.',
    is_active: true,
    fallback_strategy: [{ step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' }],
  },
  {
    flow_code: 'attendance_early_exit_justification',
    flow_name: 'Justificacion de salida anticipada',
    applies_to_module: 'attendance',
    source_table: 'attendance_justifications',
    description: 'Flujo para salida anticipada.',
    is_active: true,
    fallback_strategy: [{ step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' }],
  },
  {
    flow_code: 'attendance_early_break_justification',
    flow_name: 'Justificacion de ingreso anticipado a break',
    applies_to_module: 'attendance',
    source_table: 'attendance_justifications',
    description: 'Flujo para ingreso anticipado a break.',
    is_active: true,
    fallback_strategy: [{ step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' }],
  },
  {
    flow_code: 'permission_request',
    flow_name: 'Solicitud de permisos',
    applies_to_module: 'requests',
    source_table: 'permission_requests',
    description: 'Flujo para permisos personales o medicos.',
    is_active: true,
    fallback_strategy: [{ step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' }],
  },
  {
    flow_code: 'loan_request',
    flow_name: 'Solicitud de prestamos',
    applies_to_module: 'requests',
    source_table: 'loan_requests',
    description: 'Flujo para prestamos internos del colaborador.',
    is_active: true,
    fallback_strategy: [
      { step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' },
      { step_order: 2, step_name: 'Responsable RRHH', approver_type: 'hr_responsible', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'shared_queue' },
    ],
  },
  {
    flow_code: 'salary_advance_request',
    flow_name: 'Solicitud de adelanto de sueldo',
    applies_to_module: 'requests',
    source_table: 'salary_advance_requests',
    description: 'Flujo para adelantos o anticipos de sueldo.',
    is_active: true,
    fallback_strategy: [
      { step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' },
      { step_order: 2, step_name: 'Responsable RRHH', approver_type: 'hr_responsible', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'shared_queue' },
    ],
  },
  {
    flow_code: 'vacation_request',
    flow_name: 'Solicitud de vacaciones',
    applies_to_module: 'requests',
    source_table: 'vacation_requests',
    description: 'Flujo para vacaciones con saldo disponible.',
    is_active: true,
    fallback_strategy: [
      { step_order: 1, step_name: 'Jefe inmediato', approver_type: 'manager', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'first_available' },
      { step_order: 2, step_name: 'Responsable RRHH', approver_type: 'hr_responsible', approver_role_code: null, approver_user_id: null, approver_group_id: null, is_required: true, allow_delegate: false, parallel_group: null, candidate_resolution: 'shared_queue' },
    ],
  },
]

type DemoStoredDefinition = {
  definition: ApprovalFlowDefinition
  steps: ApprovalFlowStep[]
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const storage = getStorage()
    if (!storage) return fallback
    const rawValue = storage.getItem(key)
    if (!rawValue) return fallback
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

function readDemoDefinitions(): Record<string, DemoStoredDefinition> {
  return readJson<Record<string, DemoStoredDefinition>>(DEMO_DEFINITION_KEY, {})
}

function writeDemoDefinitions(value: Record<string, DemoStoredDefinition>): void {
  writeJson(DEMO_DEFINITION_KEY, value)
}

function readDemoGroups(): ApprovalApproverGroupWithMembers[] {
  return readJson<ApprovalApproverGroupWithMembers[]>(DEMO_GROUP_KEY, DEFAULT_DEMO_GROUPS)
}

function writeDemoGroups(value: ApprovalApproverGroupWithMembers[]): void {
  writeJson(DEMO_GROUP_KEY, value)
}

function toApprovalFlowDefinition(input: UpsertApprovalFlowDefinitionInput, existingId?: string): DemoStoredDefinition {
  const now = new Date().toISOString()
  const definitionId = existingId ?? randomId('approval-flow')
  const steps: ApprovalFlowStep[] = input.steps.map((step, index) => ({
    id: randomId('approval-step'),
    flow_definition_id: definitionId,
    tenant_id: DEMO_TENANT_ID,
    step_order: index + 1,
    step_name: step.step_name.trim(),
    approver_type: step.approver_type,
    approver_role_code: step.approver_role_code ?? null,
    approver_user_id: step.approver_user_id ?? null,
    approver_group_id: step.approver_group_id ?? null,
    is_required: step.is_required,
    allow_delegate: step.allow_delegate,
    parallel_group: step.parallel_group ?? null,
    candidate_resolution: step.candidate_resolution,
    auto_rule_enabled: step.auto_rule_enabled ?? false,
    auto_rule: step.auto_rule ?? {},
  }))

  return {
    definition: {
      id: definitionId,
      tenant_id: DEMO_TENANT_ID,
      flow_code: input.flow_code,
      flow_name: input.flow_name.trim(),
      is_active: input.is_active,
      applies_to_module: input.applies_to_module,
      description: input.description?.trim() || null,
      execution_mode: input.execution_mode,
      reject_any_step_closes: input.reject_any_step_closes,
      activate_next_on_approval: input.activate_next_on_approval,
      allow_auto_first_step: input.allow_auto_first_step,
      updated_at: now,
    },
    steps,
  }
}

function buildFallbackSummary(catalog: ApprovalFlowCatalogItem): ApprovalFlowSummary {
  const firstStep = catalog.fallback_strategy[0] ?? null
  return {
    flow_code: catalog.flow_code,
    catalog_flow_name: catalog.flow_name,
    applies_to_module: catalog.applies_to_module,
    source_table: catalog.source_table,
    description: catalog.description,
    flow_definition_id: null,
    tenant_id: null,
    tenant_flow_name: null,
    configured_is_active: null,
    execution_mode: null,
    reject_any_step_closes: null,
    activate_next_on_approval: null,
    allow_auto_first_step: null,
    updated_at: null,
    is_configured: false,
    level_count: catalog.fallback_strategy.length,
    first_step_name: firstStep?.step_name ?? null,
    first_approver_type: firstStep?.approver_type ?? null,
  }
}

function buildDemoSummaries(): ApprovalFlowSummary[] {
  const definitions = readDemoDefinitions()
  return DEMO_CATALOG.map((catalog) => {
    const stored = definitions[catalog.flow_code]
    if (!stored) return buildFallbackSummary(catalog)

    const firstStep = stored.steps[0] ?? null
    return {
      flow_code: catalog.flow_code,
      catalog_flow_name: catalog.flow_name,
      applies_to_module: catalog.applies_to_module,
      source_table: catalog.source_table,
      description: catalog.description,
      flow_definition_id: stored.definition.id,
      tenant_id: stored.definition.tenant_id,
      tenant_flow_name: stored.definition.flow_name,
      configured_is_active: stored.definition.is_active,
      execution_mode: stored.definition.execution_mode,
      reject_any_step_closes: stored.definition.reject_any_step_closes,
      activate_next_on_approval: stored.definition.activate_next_on_approval,
      allow_auto_first_step: stored.definition.allow_auto_first_step,
      updated_at: stored.definition.updated_at,
      is_configured: true,
      level_count: stored.steps.length,
      first_step_name: firstStep?.step_name ?? null,
      first_approver_type: firstStep?.approver_type ?? null,
    }
  })
}

function buildDemoSetupContext(): ApprovalSetupContext {
  const groups = readDemoGroups().map((group) => ({
    id: group.id,
    code: group.code,
    name: group.name,
    description: group.description,
    group_kind: group.group_kind,
    is_active: group.is_active,
    member_count: group.member_user_ids.length,
  }))

  return {
    roles: ['tenant_admin', 'hr_admin', 'payroll_admin', 'manager'],
    users: DEMO_USERS,
    groups,
  }
}

function buildDemoPendingApprovals(): PendingApprovalItem[] {
  return [
    {
      approval_request_id: '66666666-6666-4666-8666-666666666666',
      approval_request_step_id: '77777777-7777-4777-8777-777777777777',
      flow_code: 'vacation_request',
      flow_name: 'Solicitud de vacaciones',
      source_table: 'vacation_requests',
      source_record_id: '88888888-8888-4888-8888-888888888888',
      collaborator_id: DEMO_USERS[0].employee_id,
      collaborator_name: DEMO_USERS[0].full_name,
      requested_at: new Date().toISOString(),
      current_step_order: 1,
      current_step_name: 'Jefe inmediato',
      overall_status: 'en_aprobacion',
      priority_visual: 'media',
      pending_minutes: 95,
    },
  ]
}

export async function listApprovalFlowCatalog(): Promise<ApprovalFlowCatalogItem[]> {
  const { data, error } = await supabase
    .schema('attendance')
    .from('approval_flow_catalog')
    .select('flow_code, flow_name, applies_to_module, source_table, description, fallback_strategy, is_active')
    .eq('is_active', true)
    .order('flow_name')

  if (error || (data ?? []).length === 0) {
    return DEMO_CATALOG
  }

  return (data ?? []) as ApprovalFlowCatalogItem[]
}

export async function listApprovalFlowSummaries(): Promise<ApprovalFlowSummary[]> {
  const { data, error } = await supabase
    .schema('attendance')
    .from('v_approval_flow_summary')
    .select(`
      flow_code,
      catalog_flow_name,
      applies_to_module,
      source_table,
      description,
      flow_definition_id,
      tenant_id,
      tenant_flow_name,
      configured_is_active,
      execution_mode,
      reject_any_step_closes,
      activate_next_on_approval,
      allow_auto_first_step,
      updated_at,
      is_configured,
      level_count,
      first_step_name,
      first_approver_type
    `)
    .order('catalog_flow_name')

  if (error || (data ?? []).length === 0) {
    return buildDemoSummaries()
  }

  return (data ?? []) as ApprovalFlowSummary[]
}

export async function getApprovalFlowDefinition(
  flowCode: string,
): Promise<{ definition: ApprovalFlowDefinition | null; steps: ApprovalFlowStep[] }> {
  const { data: definition, error: definitionError } = await supabase
    .schema('attendance')
    .from('approval_flow_definitions')
    .select(`
      id,
      tenant_id,
      flow_code,
      flow_name,
      is_active,
      applies_to_module,
      description,
      execution_mode,
      reject_any_step_closes,
      activate_next_on_approval,
      allow_auto_first_step,
      updated_at
    `)
    .eq('flow_code', flowCode)
    .maybeSingle()

  if (definitionError) {
    const demoDefinitions = readDemoDefinitions()
    return demoDefinitions[flowCode] ?? { definition: null, steps: [] }
  }

  if (!definition) {
    const demoDefinitions = readDemoDefinitions()
    return demoDefinitions[flowCode] ?? { definition: null, steps: [] }
  }

  const { data: steps, error: stepsError } = await supabase
    .schema('attendance')
    .from('approval_flow_steps')
    .select(`
      id,
      flow_definition_id,
      tenant_id,
      step_order,
      step_name,
      approver_type,
      approver_role_code,
      approver_user_id,
      approver_group_id,
      is_required,
      allow_delegate,
      parallel_group,
      candidate_resolution,
      auto_rule_enabled,
      auto_rule
    `)
    .eq('flow_definition_id', definition.id)
    .order('step_order')

  if (stepsError) {
    const demoDefinitions = readDemoDefinitions()
    return demoDefinitions[flowCode] ?? { definition: null, steps: [] }
  }

  return {
    definition: definition as ApprovalFlowDefinition,
    steps: (steps ?? []) as ApprovalFlowStep[],
  }
}

export async function getApprovalSetupContext(): Promise<ApprovalSetupContext> {
  const { data, error } = await supabase.rpc('rpc_get_approval_setup_context')
  if (error || data == null) {
    return buildDemoSetupContext()
  }
  return data as ApprovalSetupContext
}

export async function listApproverGroups(): Promise<ApprovalApproverGroupWithMembers[]> {
  const { data: groups, error: groupsError } = await supabase
    .schema('attendance')
    .from('approval_approver_groups')
    .select('id, tenant_id, code, name, description, group_kind, is_active')
    .order('name')

  if (groupsError) {
    return readDemoGroups()
  }

  const typedGroups = (groups ?? []) as ApprovalApproverGroup[]
  if (typedGroups.length === 0) {
    return readDemoGroups()
  }

  const groupIds = typedGroups.map((group) => group.id)
  const { data: members, error: membersError } = await supabase
    .schema('attendance')
    .from('approval_approver_group_members')
    .select('id, tenant_id, group_id, user_id')
    .in('group_id', groupIds)

  if (membersError) {
    return readDemoGroups()
  }

  const membersByGroup = new Map<string, string[]>()
  for (const member of (members ?? []) as ApprovalApproverGroupMember[]) {
    const current = membersByGroup.get(member.group_id) ?? []
    current.push(member.user_id)
    membersByGroup.set(member.group_id, current)
  }

  return typedGroups.map((group) => ({
    ...group,
    member_user_ids: membersByGroup.get(group.id) ?? [],
  }))
}

export async function upsertApproverGroup(input: UpsertApproverGroupInput): Promise<string> {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    group_kind: input.group_kind,
    is_active: input.is_active,
  }

  let groupId = input.id

  const tryBackend = async (): Promise<string> => {
    if (groupId) {
      const { error } = await supabase
        .schema('attendance')
        .from('approval_approver_groups')
        .update(payload)
        .eq('id', groupId)

      if (error) throw error
    } else {
      const { data, error } = await supabase
        .schema('attendance')
        .from('approval_approver_groups')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error
      groupId = ensure(data?.id as string | undefined, 'No se pudo crear el grupo aprobador')
    }

    const { error: deleteError } = await supabase
      .schema('attendance')
      .from('approval_approver_group_members')
      .delete()
      .eq('group_id', groupId)

    if (deleteError) throw deleteError

    const uniqueUsers = [...new Set(input.member_user_ids)]
    if (uniqueUsers.length > 0) {
      const { error: insertMembersError } = await supabase
        .schema('attendance')
        .from('approval_approver_group_members')
        .insert(uniqueUsers.map((userId) => ({ group_id: groupId, user_id: userId })))

      if (insertMembersError) throw insertMembersError
    }

    return ensure(groupId ?? null, 'No se pudo resolver el grupo aprobador guardado')
  }

  try {
    return await tryBackend()
  } catch {
    const groups = readDemoGroups()
    const resolvedId = input.id ?? randomId('approval-group')
    const nextGroups = [
      ...groups.filter((group) => group.id !== resolvedId),
      {
        id: resolvedId,
        tenant_id: DEMO_TENANT_ID,
        code: payload.code,
        name: payload.name,
        description: payload.description,
        group_kind: payload.group_kind,
        is_active: payload.is_active,
        member_user_ids: [...new Set(input.member_user_ids)],
      },
    ].sort((left, right) => left.name.localeCompare(right.name))

    writeDemoGroups(nextGroups)
    return resolvedId
  }
}

export async function saveApprovalFlowDefinition(input: UpsertApprovalFlowDefinitionInput): Promise<string> {
  const rpcPayload = {
    p_flow_code: input.flow_code,
    p_flow_name: input.flow_name.trim(),
    p_applies_to_module: input.applies_to_module,
    p_description: input.description?.trim() || null,
    p_is_active: input.is_active,
    p_execution_mode: input.execution_mode,
    p_reject_any_step_closes: input.reject_any_step_closes,
    p_activate_next_on_approval: input.activate_next_on_approval,
    p_allow_auto_first_step: input.allow_auto_first_step,
    p_steps: input.steps.map((step, index) => ({
      ...step,
      step_order: index + 1,
      step_name: step.step_name.trim(),
    })),
  }

  const { data, error } = await supabase.rpc('rpc_upsert_flow_definition', rpcPayload)

  if (!error && data) {
    return ensure(data as string | null, 'No se pudo guardar el flujo')
  }

  const currentDefinitions = readDemoDefinitions()
  const existing = currentDefinitions[input.flow_code]
  currentDefinitions[input.flow_code] = toApprovalFlowDefinition(input, existing?.definition.id)
  writeDemoDefinitions(currentDefinitions)
  return currentDefinitions[input.flow_code].definition.id
}

export async function submitApprovalRequest(input: SubmitApprovalRequestInput): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_submit_approval_request', {
    p_flow_code: input.flow_code,
    p_source_table: input.source_table,
    p_source_record_id: input.source_record_id,
    p_requested_by_user_id: input.requested_by_user_id,
    p_requested_by_employee_id: input.requested_by_employee_id ?? null,
    p_metadata: input.metadata ?? {},
  })

  if (error) throw error
  return ensure(data as string | null, 'No se pudo enviar la solicitud a aprobacion')
}

export async function listPendingApprovals(): Promise<PendingApprovalItem[]> {
  const { data, error } = await supabase.rpc('rpc_get_pending_approvals')
  if (error) {
    return buildDemoPendingApprovals()
  }
  return ((data ?? []) as PendingApprovalItem[]).length > 0 ? (data as PendingApprovalItem[]) : buildDemoPendingApprovals()
}

export async function getApprovalHistory(approvalRequestId: string): Promise<ApprovalHistoryPayload> {
  const { data, error } = await supabase.rpc('rpc_get_approval_history', {
    p_approval_request_id: approvalRequestId,
  })

  if (error) throw error
  return ensure(data as ApprovalHistoryPayload | null, 'No se pudo cargar el historial de aprobacion')
}

export async function approveApprovalRequest(approvalRequestId: string, comment: string): Promise<void> {
  if (comment.trim() === '') {
    throw new Error('La nota de aprobacion es obligatoria')
  }

  const { error } = await supabase.rpc('rpc_approve_request', {
    p_approval_request_id: approvalRequestId,
    p_comment: comment.trim(),
  })

  if (error) throw error
}

export async function rejectApprovalRequest(approvalRequestId: string, comment: string): Promise<void> {
  if (comment.trim() === '') {
    throw new Error('La nota de rechazo es obligatoria')
  }

  const { error } = await supabase.rpc('rpc_reject_request', {
    p_approval_request_id: approvalRequestId,
    p_comment: comment.trim(),
  })

  if (error) throw error
}
