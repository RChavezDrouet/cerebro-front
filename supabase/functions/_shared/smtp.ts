import { getAdminClient } from './supabaseAdmin.ts'

// SMTP client (Deno)
// Nota: Supabase Edge Functions usa Deno; este paquete es un SMTP simple.
// Si tu proveedor requiere STARTTLS específico, ajusta aquí.
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

export type SmtpConfig = {
  host: string
  port: number
  username?: string | null
  from_email?: string | null
  from_name?: string | null
  secure?: boolean
  secret_name?: string | null
}

async function tryReadVaultSecretByName(secretName: string): Promise<string | null> {
  const supabase = getAdminClient()

  // 1) Vista usual del Vault
  try {
    const { data, error } = await supabase
      // @ts-ignore - esquema con punto es válido en PostgREST
      .from('vault.decrypted_secrets')
      .select('secret')
      .eq('name', secretName)
      .maybeSingle()
    if (!error && data?.secret) return String(data.secret)
  } catch {
    // ignore
  }

  // 2) Tabla secrets (algunas versiones exponen columna "secret" directamente)
  try {
    const { data, error } = await supabase
      // @ts-ignore
      .from('vault.secrets')
      .select('secret')
      .eq('name', secretName)
      .maybeSingle()
    if (!error && (data as any)?.secret) return String((data as any).secret)
  } catch {
    // ignore
  }

  // 3) Fallback opcional: smtp_settings.smtp_password_encrypted (no se crea por defecto)
  try {
    const { data, error } = await supabase
      .from('smtp_settings')
      .select('smtp_password_encrypted')
      .eq('id', 1)
      .maybeSingle()
    if (!error && (data as any)?.smtp_password_encrypted) return String((data as any).smtp_password_encrypted)
  } catch {
    // ignore
  }

  return null
}

export async function loadSmtpConfigAndPassword() {
  const supabase = getAdminClient()
  const { data, error } = await supabase.from('smtp_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) throw new Error('SMTP settings not configured')

  const cfg: SmtpConfig = {
    host: data.host,
    port: Number(data.port || 0),
    username: data.username,
    from_email: data.from_email,
    from_name: data.from_name,
    secure: Boolean(data.secure),
    secret_name: data.secret_name,
  }
  if (!cfg.host || !cfg.port) throw new Error('SMTP host/port missing')

  const secretName = String(cfg.secret_name || 'cerebro_smtp_password')
  const password = await tryReadVaultSecretByName(secretName)
  if (!password) throw new Error('SMTP password secret not found in Vault')

  return { cfg, password }
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
}) {
  const { cfg, password } = await loadSmtpConfigAndPassword()

  const client = new SmtpClient()

  // Conexión: TLS implícito si secure=true; si usas STARTTLS en 587, cambia a connectTLS igualmente.
  if (cfg.secure) {
    await client.connectTLS({ hostname: cfg.host, port: cfg.port, username: cfg.username ?? undefined, password })
  } else {
    await client.connect({ hostname: cfg.host, port: cfg.port, username: cfg.username ?? undefined, password })
  }

  const fromName = (cfg.from_name || 'Cerebro').trim()
  const fromEmail = (cfg.from_email || cfg.username || '').trim()
  if (!fromEmail) throw new Error('SMTP from_email missing')

  const content = html || text || ''
  await client.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    content,
    html: html ? content : undefined,
    text: text ? content : undefined,
    replyTo,
  } as any)

  await client.close()
}

export function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim())
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
