export type ApprovalFlowCode =
  | 'attendance_late_justification'
  | 'attendance_absence_justification'
  | 'attendance_early_exit_justification'
  | 'attendance_early_break_justification'
  | 'permission_request'
  | 'loan_request'
  | 'salary_advance_request'
  | 'vacation_request'
  | string

export type ApproverType =
  | 'role'
  | 'manager'
  | 'manager_of_manager'
  | 'hr_responsible'
  | 'payroll_responsible'
  | 'specific_user'
  | 'approver_group'

export type FlowExecutionMode = 'sequential' | 'parallel'

export type ApprovalOverallStatus =
  | 'borrador'
  | 'pendiente'
  | 'en_aprobacion'
  | 'aprobado'
  | 'rechazado'
  | 'cancelado'

export type ApprovalStepStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'omitido'

export type CandidateResolution = 'shared_queue' | 'first_available'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

export interface ApprovalFlowCatalogItem {
  flow_code: ApprovalFlowCode
  flow_name: string
  applies_to_module: string
  source_table: string
  description: string | null
  fallback_strategy: ApprovalFlowStepInput[]
  is_active?: boolean
}

export interface ApprovalFlowSummary {
  flow_code: ApprovalFlowCode
  catalog_flow_name: string
  applies_to_module: string
  source_table: string
  description: string | null
  flow_definition_id: string | null
  tenant_id: string | null
  tenant_flow_name: string | null
  configured_is_active: boolean | null
  execution_mode: FlowExecutionMode | null
  reject_any_step_closes: boolean | null
  activate_next_on_approval: boolean | null
  allow_auto_first_step: boolean | null
  updated_at: string | null
  is_configured: boolean
  level_count: number
  first_step_name: string | null
  first_approver_type: ApproverType | null
}

export interface ApprovalFlowDefinition {
  id: string
  tenant_id: string
  flow_code: ApprovalFlowCode
  flow_name: string
  is_active: boolean
  applies_to_module: string
  description: string | null
  execution_mode: FlowExecutionMode
  reject_any_step_closes: boolean
  activate_next_on_approval: boolean
  allow_auto_first_step: boolean
  updated_at: string
}

export interface ApprovalFlowStep {
  id: string
  flow_definition_id: string
  tenant_id: string
  step_order: number
  step_name: string
  approver_type: ApproverType
  approver_role_code: string | null
  approver_user_id: string | null
  approver_group_id: string | null
  is_required: boolean
  allow_delegate: boolean
  parallel_group: string | null
  candidate_resolution: CandidateResolution
  auto_rule_enabled: boolean
  auto_rule: JsonObject
}

export interface ApprovalFlowStepInput {
  step_order: number
  step_name: string
  approver_type: ApproverType
  approver_role_code: string | null
  approver_user_id: string | null
  approver_group_id: string | null
  is_required: boolean
  allow_delegate: boolean
  parallel_group: string | null
  candidate_resolution: CandidateResolution
  auto_rule_enabled?: boolean
  auto_rule?: JsonObject
}

export interface UpsertApprovalFlowDefinitionInput {
  flow_code: ApprovalFlowCode
  flow_name: string
  applies_to_module: string
  description: string | null
  is_active: boolean
  execution_mode: FlowExecutionMode
  reject_any_step_closes: boolean
  activate_next_on_approval: boolean
  allow_auto_first_step: boolean
  steps: ApprovalFlowStepInput[]
}

export interface ApprovalSetupUser {
  user_id: string
  employee_id: string
  full_name: string
  employee_code: string | null
}

export interface ApprovalSetupGroupSummary {
  id: string
  code: string
  name: string
  description: string | null
  group_kind: 'generic' | 'hr_responsible' | 'payroll_responsible'
  is_active: boolean
  member_count: number
}

export interface ApprovalSetupContext {
  roles: string[]
  users: ApprovalSetupUser[]
  groups: ApprovalSetupGroupSummary[]
}

export interface ApprovalApproverGroup {
  id: string
  tenant_id: string
  code: string
  name: string
  description: string | null
  group_kind: 'generic' | 'hr_responsible' | 'payroll_responsible'
  is_active: boolean
}

export interface ApprovalApproverGroupMember {
  id: string
  tenant_id: string
  group_id: string
  user_id: string
}

export interface ApprovalApproverGroupWithMembers extends ApprovalApproverGroup {
  member_user_ids: string[]
}

export interface UpsertApproverGroupInput {
  id?: string
  code: string
  name: string
  description: string | null
  group_kind: 'generic' | 'hr_responsible' | 'payroll_responsible'
  is_active: boolean
  member_user_ids: string[]
}

export interface PendingApprovalItem {
  approval_request_id: string
  approval_request_step_id: string
  flow_code: ApprovalFlowCode
  flow_name: string
  source_table: string
  source_record_id: string
  collaborator_id: string | null
  collaborator_name: string
  requested_at: string
  current_step_order: number
  current_step_name: string
  overall_status: ApprovalOverallStatus
  priority_visual: 'normal' | 'media' | 'alta' | string
  pending_minutes: number
}

export interface ApprovalHistoryStep {
  id: string
  step_order: number
  step_name: string
  approver_type: ApproverType
  assigned_user_id: string | null
  assigned_user_name: string | null
  assigned_role_code: string | null
  assigned_group_id: string | null
  status: ApprovalStepStatus
  activated_at: string | null
  acted_at: string | null
  acted_by_user_id: string | null
  acted_by_user_name: string | null
  comments: string | null
  candidate_user_ids: string[]
  candidate_user_names: string[]
}

export interface ApprovalHistoryAuditItem {
  id: string
  action: 'submit' | 'approve' | 'reject' | 'cancel' | 'reassign' | 'auto_approve' | string
  acted_by_user_id: string | null
  acted_by_user_name: string | null
  comments: string | null
  metadata: JsonObject
  created_at: string
}

export interface ApprovalHistoryPayload {
  request: {
    id: string
    flow_code: ApprovalFlowCode
    source_table: string
    source_record_id: string
    requested_by_user_id: string
    requested_by_employee_id: string | null
    current_step_order: number | null
    overall_status: ApprovalOverallStatus
    execution_mode: FlowExecutionMode
    reject_any_step_closes: boolean
    activate_next_on_approval: boolean
    final_decision_at: string | null
    final_decision_by: string | null
    metadata: JsonObject
    created_at: string
    updated_at: string
  }
  source_record: JsonObject
  steps: ApprovalHistoryStep[]
  audit: ApprovalHistoryAuditItem[]
}

export interface SubmitApprovalRequestInput {
  flow_code: ApprovalFlowCode
  source_table: string
  source_record_id: string
  requested_by_user_id: string
  requested_by_employee_id?: string | null
  metadata?: JsonObject
}
