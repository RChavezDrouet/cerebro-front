import { supabase } from '../../../config/supabase';
import type {
  AttendanceNoveltyRow,
  DecideNoveltyInput,
  NoveltyDecisionStatus,
  OrgNotificationRow,
} from '../types/novelties';

const attendanceClient = typeof supabase.schema === 'function' ? supabase.schema('attendance') : supabase;

type DecideTenantNoveltyInput = DecideNoveltyInput & {
  tenantId: string;
};

function normalizeDecisionStatus(value: unknown): NoveltyDecisionStatus {
  if (value === 'justified' || value === 'rejected') return value;
  return 'pending';
}

function normalizeNoveltyRow(row: Record<string, unknown>): AttendanceNoveltyRow {
  return {
    employee_id: String(row.employee_id ?? ''),
    employee_code: row.employee_code ? String(row.employee_code) : null,
    employee_name: String(row.employee_name ?? ''),
    department_name: row.department_name ? String(row.department_name) : null,
    work_date: String(row.work_date ?? ''),
    entry_status: row.entry_status ? String(row.entry_status) : null,
    exit_status: row.exit_status ? String(row.exit_status) : null,
    day_status: row.day_status ? String(row.day_status) : null,
    novelty: row.novelty ? String(row.novelty) : null,
    decision_status: normalizeDecisionStatus(row.decision_status),
    request_comment: row.request_comment ? String(row.request_comment) : null,
    decision_comment: row.decision_comment ? String(row.decision_comment) : null,
    decided_at: row.decided_at ? String(row.decided_at) : null,
  };
}

function formatRpcError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (typeof error === 'object' && error && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message ?? 'Error desconocido en RPC'));
  }

  return new Error('Error desconocido en RPC');
}

/**
 * Modo admin del tenant:
 * devuelve TODAS las novedades del tenant para el rango indicado.
 */
export async function listTenantNovelties(
  tenantId: string,
  from: string,
  to: string,
): Promise<AttendanceNoveltyRow[]> {
  const { data, error } = await attendanceClient.rpc('get_tenant_novelties', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });

  if (error) throw formatRpcError(error);

  return Array.isArray(data)
    ? data.map((row) => normalizeNoveltyRow((row ?? {}) as Record<string, unknown>))
    : [];
}

/**
 * Modo admin del tenant:
 * justifica o rechaza una novedad con nota obligatoria.
 */
export async function decideTenantNovelty(input: DecideTenantNoveltyInput): Promise<void> {
  const payload = {
    p_tenant_id: input.tenantId,
    p_employee_id: input.employeeId,
    p_work_date: input.workDate,
    p_decision: input.decision,
    p_request_comment: input.requestComment,
    p_decision_comment: input.decisionComment,
  };

  const { error } = await attendanceClient.rpc('decide_tenant_novelty', payload);

  if (error) throw formatRpcError(error);
}

/**
 * Se dejan las funciones antiguas por compatibilidad/futuro,
 * pero el hook admin-first ya no las hook admin-first ya no las usa.
 */
export async function listMyVisibleNovelties(from: string, to: string): Promise<AttendanceNoveltyRow[]> {
  const { data, error } = await attendanceClient.rpc('get_my_visible_novelties', {
    p_from: from,
    p_to: to,
  });

  if (error) throw formatRpcError(error);

  return Array.isArray(data)
    ? data.map((row) => normalizeNoveltyRow((row ?? {}) as Record<string, unknown>))
    : [];
}

export async function listMyOrgNotifications(from: string, to: string): Promise<OrgNotificationRow[]> {
  const { data, error } = await attendanceClient.rpc('get_my_org_notifications', {
    p_from: from,
    p_to: to,
  });

  if (error) throw formatRpcError(error);

  return Array.isArray(data) ? (data as OrgNotificationRow[]) : [];
}

export async function decideVisibleNovelty(input: DecideNoveltyInput): Promise<void> {
  const payload = {
    p_employee_id: input.employeeId,
    p_work_date: input.workDate,
    p_decision: input.decision,
    p_request_comment: input.requestComment,
    p_decision_comment: input.decisionComment,
  };

  const { error } = await attendanceClient.rpc('decide_visible_novelty', payload);

  if (error) throw formatRpcError(error);
}