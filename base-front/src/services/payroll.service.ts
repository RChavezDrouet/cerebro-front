import { supabase } from "@/config/supabase";
import { resolveTenantId } from "@/lib/tenant";

export type PayrollPeriodType = "weekly" | "biweekly" | "monthly" | "special";
export type PayrollPeriodStatus = "draft" | "open" | "processing" | "closed" | "cancelled";

export type PayrollRunType = "normal" | "adjustment" | "termination" | "bonus" | "special";
export type PayrollRunStatus =
  | "draft"
  | "processing"
  | "calculated"
  | "approved"
  | "posted"
  | "cancelled";

export type PayrollPeriod = {
  id: string;
  tenant_id: string;
  code: string;
  name: string | null;
  period_type: PayrollPeriodType;
  start_date: string;
  end_date: string;
  payment_date: string | null;
  status: PayrollPeriodStatus;
  closed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollRun = {
  id: string;
  tenant_id: string;
  period_id: string;
  code: string;
  run_type: PayrollRunType;
  status: PayrollRunStatus;
  processed_at: string | null;
  processed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollConceptType =
  | "earning"
  | "deduction"
  | "provision"
  | "employer_contribution"
  | "informative";

export type PayrollConceptCalculationType =
  | "fixed"
  | "percentage"
  | "formula"
  | "days"
  | "hours"
  | "manual";

export type PayrollConcept = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  concept_type: PayrollConceptType;
  calculation_type: PayrollConceptCalculationType;
  taxable: boolean;
  affects_iess: boolean;
  affects_income_tax: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PayrollNoveltyStatus = "draft" | "approved" | "rejected" | "applied";
export type PayrollNoveltySourceModule = "manual" | "attendance" | "novelties" | "loans" | "system";

export type PayrollNovelty = {
  id: string;
  tenant_id: string;
  employee_id: string;
  period_id: string;
  novelty_type: string;
  concept_code: string;
  quantity: number;
  rate: number;
  amount: number;
  notes: string | null;
  source_module: PayrollNoveltySourceModule;
  source_ref_id: string | null;
  status: PayrollNoveltyStatus;
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

export type AppliedNoveltyRow = {
  out_run_id: string;
  out_employee_id: string;
  out_employee_name: string;
  out_concept_code: string;
  out_concept_name: string;
  out_amount: number;
  out_source_module: string;
};

export type PayrollSummaryRow = {
  out_run_id: string;
  out_employee_id: string;
  out_employee_name: string;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
};

export type CreatePayrollPeriodInput = {
  tenant_id: string;
  code: string;
  name?: string | null;
  period_type?: PayrollPeriodType;
  start_date: string;
  end_date: string;
  payment_date?: string | null;
  status?: PayrollPeriodStatus;
};

export type UpdatePayrollPeriodInput = Partial<
  Pick<PayrollPeriod, "name" | "payment_date" | "status">
>;

export type CreatePayrollRunInput = {
  tenant_id: string;
  period_id: string;
  code: string;
  run_type?: PayrollRunType;
  status?: PayrollRunStatus;
  notes?: string | null;
};

export type UpdatePayrollRunInput = Partial<
  Pick<PayrollRun, "status" | "notes" | "processed_at" | "processed_by">
>;

export type CreatePayrollNoveltyInput = {
  tenant_id: string;
  employee_id: string;
  period_id: string;
  novelty_type: string;
  concept_code: string;
  quantity?: number;
  rate?: number;
  amount: number;
  notes?: string | null;
  source_module?: PayrollNoveltySourceModule;
  source_ref_id?: string | null;
  status?: PayrollNoveltyStatus;
};

function throwIfError(error: unknown): never {
  if (error instanceof Error) throw error;
  throw new Error("Se produjo un error inesperado al consultar nómina.");
}

function ensureData<T>(data: T | null, error: unknown): T {
  if (error) throwIfError(error);
  if (data == null) {
    throw new Error("No se recibió respuesta del servidor.");
  }
  return data;
}

async function resolveRequiredTenantId(preferredTenantId?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throwIfError(error);

  const userId = data.user?.id ?? null;
  if (userId) {
    const tenantId = await resolveTenantId(userId);
    if (tenantId) return tenantId;
  }

  if (preferredTenantId) return preferredTenantId;

  throw new Error("No se pudo resolver el tenant activo para nómina.");
}

export const payrollService = {
  async getPeriods(tenantId?: string): Promise<PayrollPeriod[]> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("tenant_id", scopedTenantId)
      .order("start_date", { ascending: false });

    return ensureData(data, error);
  },

  async getPeriodById(periodId: string, tenantId?: string): Promise<PayrollPeriod> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", periodId)
      .eq("tenant_id", scopedTenantId)
      .single();

    return ensureData(data, error);
  },

  async createPeriod(payload: CreatePayrollPeriodInput): Promise<PayrollPeriod> {
    const scopedTenantId = await resolveRequiredTenantId(payload.tenant_id);
    const { data, error } = await supabase
      .from("payroll_periods")
      .insert({
        tenant_id: scopedTenantId,
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

  async updatePeriod(id: string, payload: UpdatePayrollPeriodInput, tenantId?: string): Promise<PayrollPeriod> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_periods")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", scopedTenantId)
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async deletePeriod(id: string, tenantId?: string): Promise<void> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { error } = await supabase
      .from("payroll_periods")
      .delete()
      .eq("id", id)
      .eq("tenant_id", scopedTenantId);
    if (error) throwIfError(error);
  },

  async getRuns(tenantId?: string): Promise<PayrollRun[]> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("tenant_id", scopedTenantId)
      .order("created_at", { ascending: false });

    return ensureData(data, error);
  },

  async getRunsByPeriod(periodId: string, tenantId?: string): Promise<PayrollRun[]> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("period_id", periodId)
      .eq("tenant_id", scopedTenantId)
      .order("created_at", { ascending: false });

    return ensureData(data, error);
  },

  async getRunById(runId: string, tenantId?: string): Promise<PayrollRun> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("id", runId)
      .eq("tenant_id", scopedTenantId)
      .single();

    return ensureData(data, error);
  },

  async createRun(payload: CreatePayrollRunInput): Promise<PayrollRun> {
    const scopedTenantId = await resolveRequiredTenantId(payload.tenant_id);
    const { data, error } = await supabase
      .from("payroll_runs")
      .insert({
        tenant_id: scopedTenantId,
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

  async updateRun(id: string, payload: UpdatePayrollRunInput, tenantId?: string): Promise<PayrollRun> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_runs")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", scopedTenantId)
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async deleteRun(id: string, tenantId?: string): Promise<void> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { error } = await supabase
      .from("payroll_runs")
      .delete()
      .eq("id", id)
      .eq("tenant_id", scopedTenantId);
    if (error) throwIfError(error);
  },

  async getConcepts(tenantId?: string): Promise<PayrollConcept[]> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_concepts")
      .select("*")
      .eq("tenant_id", scopedTenantId)
      .order("display_order", { ascending: true });

    return ensureData(data, error);
  },

  async getNoveltiesByPeriod(periodId: string, tenantId?: string): Promise<PayrollNovelty[]> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_novelties")
      .select("*")
      .eq("period_id", periodId)
      .eq("tenant_id", scopedTenantId)
      .order("created_at", { ascending: false });

    return ensureData(data, error);
  },

  async createNovelty(payload: CreatePayrollNoveltyInput): Promise<PayrollNovelty> {
    const scopedTenantId = await resolveRequiredTenantId(payload.tenant_id);
    const { data, error } = await supabase
      .from("payroll_novelties")
      .insert({
        tenant_id: scopedTenantId,
        employee_id: payload.employee_id,
        period_id: payload.period_id,
        novelty_type: payload.novelty_type,
        concept_code: payload.concept_code,
        quantity: payload.quantity ?? 1,
        rate: payload.rate ?? 0,
        amount: payload.amount,
        notes: payload.notes ?? null,
        source_module: payload.source_module ?? "manual",
        source_ref_id: payload.source_ref_id ?? null,
        status: payload.status ?? "approved",
      })
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async updateNovelty(
    noveltyId: string,
    payload: Partial<
      Pick<
        PayrollNovelty,
        "quantity" | "rate" | "amount" | "notes" | "status" | "concept_code" | "novelty_type"
      >
    >,
    tenantId?: string
  ): Promise<PayrollNovelty> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { data, error } = await supabase
      .from("payroll_novelties")
      .update(payload)
      .eq("id", noveltyId)
      .eq("tenant_id", scopedTenantId)
      .select("*")
      .single();

    return ensureData(data, error);
  },

  async deleteNovelty(noveltyId: string, tenantId?: string): Promise<void> {
    const scopedTenantId = await resolveRequiredTenantId(tenantId);
    const { error } = await supabase
      .from("payroll_novelties")
      .delete()
      .eq("id", noveltyId)
      .eq("tenant_id", scopedTenantId);
    if (error) throwIfError(error);
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

  async recalculateAndLoadSummary(runId: string): Promise<PayrollSummaryRow[]> {
    await this.calculateRun(runId);
    return this.getSummary(runId);
  },

  async applyNoveltiesAndLoadSummary(runId: string): Promise<PayrollSummaryRow[]> {
    await this.applyNovelties(runId);
    return this.getSummary(runId);
  },

  async getRunFullContext(runId: string): Promise<{
    run: PayrollRun;
    period: PayrollPeriod;
    summary: PayrollSummaryRow[];
  }> {
    const scopedTenantId = await resolveRequiredTenantId();
    const [run, summary] = await Promise.all([
      this.getRunById(runId, scopedTenantId),
      this.getSummary(runId),
    ]);

    const period = await this.getPeriodById(run.period_id, scopedTenantId);

    return { run, period, summary };
  },
};
