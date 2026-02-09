import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendEmail, isValidEmail } from '../_shared/smtp.ts'

type Payload = { to_email?: string }

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = (await req.json()) as Payload
    const to_email = String(body.to_email || '').trim()
    if (!isValidEmail(to_email)) {
      return new Response(JSON.stringify({ error: 'Email destino inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await sendEmail({
      to: to_email,
      subject: 'Cerebro | Test SMTP',
      html: `<div style="font-family:system-ui;line-height:1.4">
        <h2>✅ SMTP OK</h2>
        <p>Este correo confirma que la configuración SMTP global de Cerebro está funcionando.</p>
        <p style="color:#64748b">${new Date().toISOString()}</p>
      </div>`,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
