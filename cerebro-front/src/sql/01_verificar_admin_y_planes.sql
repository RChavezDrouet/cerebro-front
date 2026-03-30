-- 1) Verifica que tu usuario interno de Cerebro sí tenga rol admin
select email, role
from public.user_roles
where lower(email) = lower('raulchavezdrouet@gmail.com');

-- 2) Si no sale fila, créalo/ajústalo como admin
insert into public.user_roles (email, role)
values ('raulchavezdrouet@gmail.com', 'admin')
on conflict (email)
do update set role = excluded.role;

-- 3) Verifica el catálogo real de planes
select code, name, price, price_model, is_active
from cerebro.subscription_plans
order by code;
