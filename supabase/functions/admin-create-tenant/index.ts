import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// 1. ACTUALIZAMOS LA INTERFAZ (Para que acepte los nuevos campos)
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
  // Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Instanciar cliente de Supabase (Service Role - Bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificación de Seguridad: Token del usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Falta cabecera de autorización')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar si es Admin en la DB
    const { data: profile } = await supabaseAdmin
      .from('internal_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Nota: Si el perfil no existe, profile será null.
    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'No autorizado: Se requiere nivel Admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. EXTRAER TODOS LOS DATOS NUEVOS DEL BODY
    const body = await req.json() as TenantPayload
    const { 
      name, 
      slug, 
      contact_email, 
      plan, 
      ruc, 
      bio_serial, 
      bio_location, 
      billing_period, 
      grace_days, 
      pause_after_grace 
    } = body

    if (!name) {
      return new Response(JSON.stringify({ error: 'El nombre del cliente es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generar slug
    const finalSlug = slug || name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')

    // 3. INSERTAR CON TODOS LOS CAMPOS
    const { data, error: insertError } = await supabaseAdmin
      .from('tenants')
      .insert([
        {
          name,
          slug: finalSlug,
          contact_email,
          plan: plan || 'basic',
          status: 'active',
          // Campos nuevos agregados:
          ruc: ruc || null,
          bio_serial: bio_serial || null,
          bio_location: bio_location || null,
          billing_period: billing_period || 'monthly',
          grace_days: grace_days ?? 5,
          pause_after_grace: pause_after_grace ?? false
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error("Error al insertar tenant:", insertError) // Para ver en logs de Supabase
      if (insertError.code === '23505') {
        throw new Error(`El slug '${finalSlug}' ya existe. Usa otro nombre.`)
      }
      throw insertError
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