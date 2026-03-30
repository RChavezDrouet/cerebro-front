import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { json, corsHeaders } from '../_shared/cors.ts';
import { requireUser, adminClient } from '../_shared/auth.ts';
import { assertEmail, assertString } from '../_shared/security.ts';

/**
 * base-create-employee-user
 * Called from BASE (tenant_admin) to create an employee auth user.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { user, error } = await requireUser(req);
    if (error || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const employee_id = assertString(body.employee_id, 'employee_id', 60);
    const email = assertEmail(body.email, 'email');
    const password = assertString(body.password, 'password', 200);

    // Resolve tenant_admin tenant_id from attendance.employees row bound to this auth.uid
    const { data: adminEmployee, error: aErr } = await adminClient
      .schema('attendance')
      .from('employees')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (aErr || !adminEmployee?.tenant_id) return json({ error: 'Forbidden' }, 403);

    // Ensure caller is tenant_admin
    const role = (user.user_metadata?.role ?? user.app_metadata?.role) as string | undefined;
    if (role !== 'tenant_admin') return json({ error: 'Forbidden' }, 403);

    // Ensure employee belongs to same tenant
    const { data: emp, error: eErr } = await adminClient
      .schema('attendance')
      .from('employees')
      .select('id, tenant_id')
      .eq('id', employee_id)
      .maybeSingle();
    if (eErr || !emp || emp.tenant_id !== adminEmployee.tenant_id) return json({ error: 'Employee not found' }, 404);

    const { data: created, error: cErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { tenant_id: adminEmployee.tenant_id, employee_id, role: 'employee' },
    });
    if (cErr) throw cErr;

    const { error: uErr } = await adminClient
      .schema('attendance')
      .from('employees')
      .update({ user_id: created.user?.id, email, first_login_pending: true })
      .eq('id', employee_id);
    if (uErr) throw uErr;

    await adminClient.from('audit_logs').insert({
      action: 'EMPLOYEE_USER_CREATED',
      user_id: user.id,
      tenant_id: adminEmployee.tenant_id,
      description: `Employee auth user created: ${email}`,
      meta: { employee_id },
    });

    return json({ ok: true, user_id: created.user?.id }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
