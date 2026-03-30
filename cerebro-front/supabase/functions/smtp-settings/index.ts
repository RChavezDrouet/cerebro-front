import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

type Payload = {
  host?: string
  port?: number
  username?: string
  from_email?: string
  from_name?: string
  secure?: boolean
  password?: string
  secret_name?: string
}

async function upsertVaultSecret(secretName: string, secretValue: string) {
  const supabase = getAdminClient()

  // Intento 1: vault.secrets (columna "secret")
  try {
    const { error } = await supabase
      // @ts-ignore
      .from('vault.secrets')
      .upsert(
        {
          name: secretName,
          secret: secretValue,
          description: 'Cerebro SMTP global password',
        },
        { onConflict: 'name' },
      )
    if (!error) return
  } catch {
    // ignore
  }

  // Intento 2: vault.secrets (columna "value")
  try {
    const { error } = await supabase
      // @ts-ignore
      .from('vault.secrets')
      .upsert(
        {
          name: secretName,
          value: secretValue,
          description: 'Cerebro SMTP global password',
        },
        { onConflict: 'name' },
      )
    if (!error) return
  } catch {
    // ignore
  }

  throw new Error('No se pudo escribir el secreto en Vault (verifica extensión Vault)')
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = (await req.json()) as Payload

    const host = String(body.host || '').trim()
    const port = Number(body.port || 0)
    const username = body.username ? String(body.username).trim() : null
    const from_email = body.from_email ? String(body.from_email).trim() : null
    const from_name = body.from_name ? String(body.from_name).trim() : null
    const secure = Boolean(body.secure)
    const secret_name = String(body.secret_name || 'cerebro_smtp_password').trim()
    const password = body.password ? String(body.password) : ''

    if (!host || !port) {
      return new Response(JSON.stringify({ error: 'host/port requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getAdminClient()

    // 1) Upsert metadata SMTP
    const { error: upErr } = await supabase.from('smtp_settings').upsert(
      {
        id: 1,
        host,
        port,
        username,
        from_email,
        from_name,
        secure,
        secret_name,
        // has_secret se ajusta abajo si hay password
      },
      { onConflict: 'id' },
    )
    if (upErr) throw upErr

    // 2) Guardar secreto en Vault (si se envía password)
    if (password && password.length) {
      await upsertVaultSecret(secret_name, password)
      const { error: flagErr } = await supabase.from('smtp_settings').update({ has_secret: true }).eq('id', 1)
      if (flagErr) throw flagErr
    }

    return new Response(JSON.stringify({ ok: true, has_secret: Boolean(password && password.length) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
