// src/types/index.ts  ·  CEREBRO v4.3.3
// Schema real confirmado 2026-02-26 desde Supabase

// ─── Tenant ───────────────────────────────────────────────────────────────────
// Columnas reales en public.tenants (confirmadas):
//   id, created_at, name, slug, plan, status, ruc, contact_email,
//   grace_days, pause_after_grace, bio_serial, bio_location,
//   billing_period, paused_message, business_name
// Columnas añadidas por migration_tenants_v433.sql:
//   legal_rep_name, legal_rep_email, contact_name, contact_phone,
//   plan_type, notes, current_balance, total_users,
//   is_suspended, suspension_reason, suspension_date
export interface Tenant {
  // ── Columnas originales ──────────────────────────────
  id:                string
  created_at:        string
  name:              string           // nombre canónico en DB
  business_name:     string           // alias legible (= name en datos existentes)
  slug:              string
  plan:              string           // código del plan en DB ('basic', 'enterprise'…)
  status:            'active' | 'paused' | 'suspended' | string
  ruc:               string
  contact_email:     string
  grace_days:        number
  pause_after_grace: boolean
  bio_serial:        string | null
  bio_location:      string | null
  billing_period:    string
  paused_message:    string | null

  // ── Columnas añadidas por migration ──────────────────
  legal_rep_name:    string | null
  legal_rep_email:   string | null
  contact_name:      string | null
  contact_phone:     string | null
  plan_type:         string | null    // sincronizado con "plan" via trigger
  notes:             string | null
  current_balance:   number
  total_users:       number
  is_suspended:      boolean          // sincronizado con status='suspended'
  suspension_reason: string | null
  suspension_date:   string | null
}

// ─── Invoice ─────────────────────────────────────────────────────────────────
export interface Invoice {
  id:                   string
  created_at:           string
  tenant_id:            string
  invoice_number:       string | null
  billing_period_start: string | null
  billing_period_end:   string | null
  subtotal:             number
  tax:                  number
  total:                number
  status:               'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | string
  due_date:             string | null
  paid_date:            string | null
  notes:                string | null
  generated_by:         string | null
}

// ─── Plan (subscription_plans) ────────────────────────────────────────────────
// Columnas reales confirmadas: code, name, description, price, price_model
export interface Plan {
  code:         string
  name:         string
  description:  string | null
  price:        number
  price_model:  string | null    // 'mensual', 'por_usuario', 'negociado'
  is_active?:   boolean          // opcional — puede no existir
}

// ─── UserRole ─────────────────────────────────────────────────────────────────
export interface UserRole {
  id?:        string
  email:      string
  role:       'admin' | 'assistant' | 'maintenance' | string
  user_id:    string | null
  full_name:  string | null
  is_active:  boolean
  created_at: string
}

// ─── RolePermissions ─────────────────────────────────────────────────────────
export interface RolePermissions {
  role:        string
  permissions: string[]
  updated_at?: string
}

// ─── AppSettings ─────────────────────────────────────────────────────────────
export interface AppSettings {
  id:                        number
  company_name:              string | null
  company_ruc:               string | null
  company_logo:              string | null
  primary_color:             string | null
  suspension_days_threshold: number | null
  paused_title:              string | null
  paused_body:               string | null
}

// ─── BiometricDevice ─────────────────────────────────────────────────────────
export interface BiometricDevice {
  id:            string
  created_at:    string
  serial_number: string
  name:          string | null
  tenant_id:     string | null
  is_active:     boolean
  last_sync:     string | null
  location:      string | null
}

// ─── AuditLog ────────────────────────────────────────────────────────────────
export interface AuditLog {
  id:         string
  created_at: string
  user_id:    string | null
  user_email: string | null
  action:     string
  table_name: string | null
  record_id:  string | null
  old_value:  Record<string, any> | null
  new_value:  Record<string, any> | null
  ip_address: string | null
}
