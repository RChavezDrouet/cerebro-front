import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface TenantPayload {
  name: string
  slug?: string
  contact_email?: string
  plan?: string
  ruc?: string
  bio_serial?: string
  bio_location?: string;
  billing_period?: string;
  grace_days?: number;
  pause_after_grace?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Verificar Usuario Admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Falta cabecera de autorización')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) throw new Error('Usuario no autenticado')

    // 2. RECIBIR DATOS (CORRECCIÓN CLAVE AQUÍ)
    const rawBody = await req.json()
    
    // Detectar si los datos vienen dentro de "tenant" o sueltos
    let payload: TenantPayload
    if (rawBody.tenant) {
      payload = rawBody.tenant // Caso Frontend actual
    } else {
      payload = rawBody // Caso directo
    }

    const { 
      name, slug, contact_email, plan, ruc, 
      bio_serial, bio_location, billing_period, 
      grace_days, pause_after_grace 
    } = payload

    if (!name) throw new Error('El nombre es obligatorio')

    // 3. Insertar en Base de Datos
    const finalSlug = slug || name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')

    const { data, error: insertError } = await supabaseAdmin
      .from('tenants')
      .insert([{
        name,
        slug: finalSlug,
        contact_email,
        plan: plan || 'basic',
        status: 'active',
        ruc: ruc || null,
        bio_serial: bio_serial || null,
        bio_location: bio_location || null,
        billing_period: billing_period || 'monthly',
        grace_days: grace_days ?? 5,
        pause_after_grace: pause_after_grace ?? false
      }])
      .select()
      .single()

    if (insertError) {
      console.error("Error DB:", insertError)
      throw new Error(insertError.message)
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})