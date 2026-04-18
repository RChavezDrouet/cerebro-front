// src/services/payroll.service.ts
import { supabase } from "@/config/supabase";

export type PayrollPeriod = {
  id: string;
  tenant_id: string;
  code: string;
  name: string | null;
  period_type: "weekly" | "biweekly" | "monthly" | "special";
  start_date: string;
  end_date: string;
  payment_date: string | null;
  status: "draft" | "open" | "processing" | "closed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type PayrollRun = {
  id: string;
  tenant_id: string;
  period_id: string;
  code: string;
  run_type: "normal" | "adjustment" | "termination" | "bonus" | "special";
  status: "draft" | "processing" | "calculated" | "approved" | "posted" | "cancelled";
  processed_at: string | null;
  processed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CalculatePayrollRow = {
  out_run_id: string;
  out_employee_id: string;
  out_employee_name: string;
  out_concept_code: string;
  out_concept_name: string;
  out_amount: number;
};

export type PayrollSummaryRow = {
  out_run_id: string;
  out_employee_id: string;
  out_employee_name: string;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
};

export type AppliedNoveltyRow = {
  out_run_id: string;
  out_employee_id: string;
  out_employee_name: string;
  out_concept_code: string;
  out_concept_name: string;
  out_amount: number;
  out_source_module: string;
};

function ensureData<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  if (data == null) throw new Error("No se recibió respuesta del servidor.");
  return data;
}

export const payrollService = {
  async getPeriods(): Promise<PayrollPeriod[]> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .select("*")
      .order("start_date", { ascending: false });

    return ensureData(data, error);
  },

  async createPeriod(payload: {
    code: string;
    name?: string;
    period_type?: PayrollPeriod["period_type"];
    start_date: string;
    end_date: string;
    payment_date?: string | null;
    status?: PayrollPeriod["status"];
  }): Promise<PayrollPeriod> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .insert({
        code: payload.code,
        name: payload.name ?? null,
        period_type: payload.period_type ?? "monthly",
        start_date: payload.start_date,
        end_date: payload.end_date,
        payment_date: payload.payment_date ?? null,
        status: payload.status ?? "draft",
      })
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async updatePeriod(
    id: string,
    payload: Partial<Pick<PayrollPeriod, "name" | "payment_date" | "status">>
  ): Promise<PayrollPeriod> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async getRuns(): Promise<PayrollRun[]> {
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .order("created_at", { ascending: false });

    return ensureData(data, error);
  },

  async createRun(payload: {
    period_id: string;
    code: string;
    run_type?: PayrollRun["run_type"];
    status?: PayrollRun["status"];
    notes?: string | null;
  }): Promise<PayrollRun> {
    const { data, error } = await supabase
      .from("payroll_runs")
      .insert({
        period_id: payload.period_id,
        code: payload.code,
        run_type: payload.run_type ?? "normal",
        status: payload.status ?? "draft",
        notes: payload.notes ?? null,
      })
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async calculateRun(runId: string): Promise<CalculatePayrollRow[]> {
    const { data, error } = await supabase.rpc("calculate_payroll_run", {
      p_run_id: runId,
    });

    return ensureData(data, error);
  },

  async applyNovelties(runId: string): Promise<AppliedNoveltyRow[]> {
    const { data, error } = await supabase.rpc("apply_novelties_to_payroll", {
      p_run_id: runId,
    });

    return ensureData(data, error);
  },

  async getSummary(runId: string): Promise<PayrollSummaryRow[]> {
    const { data, error } = await supabase.rpc("get_payroll_summary", {
      p_run_id: runId,
    });

    return ensureData(data, error);
  },

  async getRunWithPeriod(runId: string): Promise<PayrollRun & { period?: PayrollPeriod | null }> {
    const { data, error } = await supabase
      .from("payroll_runs")
      .select(`
        *,
        period:payroll_periods(*)
      `)
      .eq("id", runId)
      .single();

    return ensureData(data, error);
  },
};