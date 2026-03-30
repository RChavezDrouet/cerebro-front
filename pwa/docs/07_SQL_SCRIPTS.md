# 07 — SQL listo para pegar (Supabase SQL Editor)

Este archivo te da **scripts completos** para habilitar:

1) **Intentos fallidos** de marcación (`attendance.punch_attempts`)
2) **Solicitudes** del empleado (`attendance.employee_requests`)

📌 Script:
- `docs/sql/001_pwa_extensions.sql`

---

## 1) Cómo ejecutarlo (paso a paso)

1. Entra a Supabase → tu proyecto.
2. Ve a **SQL Editor**.
3. Crea un nuevo query.
4. Abre el archivo:
   - `pwa/docs/sql/001_pwa_extensions.sql`
5. Copia y pega TODO.
6. Ejecuta.

---

## 2) Requisitos previos

El script asume que existe:
- `public.profiles` con:
  - `id = auth.uid()`
  - `tenant_id`
  - `employee_id`

Esto se usa en RLS para que:
- el empleado solo vea/inserte sus propios intentos/solicitudes.

---

## 3) Verificación rápida

### 3.1 Tablas
Supabase → Table Editor:
- `attendance.punch_attempts`
- `attendance.employee_requests`

### 3.2 Policies
Supabase → Authentication → Policies (o Table → RLS):
- select/insert solo para el empleado autenticado.

---

## 4) Si tu proyecto no usa public.profiles

Si el mapping lo tienes en otra tabla (ej. `public.employees` con `user_id`), adapta las policies.

Ejemplo usando `public.employees.user_id = auth.uid()`:

```sql
using (
  tenant_id = (select e.tenant_id from public.employees e where e.user_id = auth.uid())
  and employee_id = (select e.id from public.employees e where e.user_id = auth.uid())
)
```
