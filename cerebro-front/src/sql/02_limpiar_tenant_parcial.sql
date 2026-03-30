-- Usa este bloque solo si quieres limpiar el tenant parcial que quedó creado sin usuario Auth.
-- Revisa primero:
select id, business_name, contact_email, plan_type, status, created_at
from public.tenants
where lower(contact_email) = lower('hchavez.est@uteg.edu.ec')
order by created_at desc;

-- Si confirmas que es el tenant roto, elimínalo:
delete from public.tenants
where id = 'f012d029-31a8-4199-84a0-19faf47a983f'::uuid;
