# Guía de implementación paso a paso para desarrollador junior

## Antes de comenzar

Asegúrate de tener:
- acceso al proyecto Supabase correcto,
- permisos para ejecutar SQL,
- acceso al repositorio de Base,
- respaldo o snapshot de base de datos.

## Paso 1 — Validar el proyecto correcto
Confirma:
- project ref
- ambiente (desarrollo / pruebas / producción)
- branch del frontend

No ejecutes SQL directamente en producción sin pasar primero por desarrollo.

## Paso 2 — Tomar respaldo
En Supabase:
1. abre el dashboard;
2. verifica tablas críticas:
   - `public.tenants`
   - `public.profiles`
   - `public.employees`
   - `attendance.employee_profile`
   - `attendance.memberships`
3. genera export o snapshot si tu flujo lo permite.

## Paso 3 — Verificar estructuras existentes
Ejecuta queries como:

```sql
select table_schema, table_name
from information_schema.tables
where table_name in (
  'tenants','profiles','employees','employee_profile','memberships',
  'punches','permission_requests','justifications','holidays'
)
order by table_schema, table_name;
```

Si alguna tabla no existe con ese nombre exacto, detente y ajusta el SQL antes de continuar.

## Paso 4 — Ejecutar scripts en orden

### 4.1 Script 01
Ejecuta:
- `sql/01_feature_flags_y_ficha_extendida.sql`

Objetivo:
- agregar feature flags,
- extender ficha del colaborador,
- dejar helper functions base.

### 4.2 Script 02
Ejecuta:
- `sql/02_payroll_core.sql`

Objetivo:
- crear tablas núcleo de nómina.

### 4.3 Script 03
Ejecuta:
- `sql/03_performance_and_training.sql`

Objetivo:
- crear evaluación del desempeño,
- planes de mejora,
- brechas,
- capacitación.

### 4.4 Script 04
Ejecuta:
- `sql/04_security_rls_audit.sql`

Objetivo:
- activar RLS,
- políticas,
- auditoría.

### 4.5 Script 05
Ejecuta:
- `sql/05_rpc_workflows.sql`

Objetivo:
- funciones RPC y workflows.

### 4.6 Script 06
Ejecuta:
- `sql/06_views_reports_seed.sql`

Objetivo:
- vistas,
- seeds mínimos,
- reportes iniciales.

## Paso 5 — Verificaciones técnicas

### 5.1 Tablas creadas
```sql
select table_schema, table_name
from information_schema.tables
where table_schema='attendance'
and table_name like any (array[
  'payroll_%',
  'performance_%',
  'training_%',
  'employee_%'
])
order by table_name;
```

### 5.2 Funciones creadas
```sql
select routine_name
from information_schema.routines
where routine_schema='attendance'
and (
  routine_name like 'rpc_%'
  or routine_name like 'fn_%'
)
order by routine_name;
```

### 5.3 Feature flags
```sql
select id, business_name, payroll_enabled, performance_enabled, training_enabled
from public.tenants
limit 20;
```

## Paso 6 — Activar un tenant piloto
Elige un tenant de pruebas y ejecuta:

```sql
update public.tenants
set payroll_enabled = true,
    performance_enabled = true,
    training_enabled = true
where id = 'REEMPLAZAR_UUID';
```

## Paso 7 — Integrar Base frontend

### 7.1 Sidebar / menú
Agrega entradas:
- Nómina
- Evaluación del Desempeño
- Capacitación por brechas

### 7.2 Guards
Antes de mostrar rutas:
- verifica tenant status,
- verifica feature flags.

### 7.3 Employee form
Agrega tabs dinámicos:
- tabs de nómina si `payroll_enabled`
- tabs de desempeño si `performance_enabled`

## Paso 8 — Probar flujo mínimo de nómina
1. crea período;
2. crea ejecución;
3. carga conceptos;
4. genera cálculo;
5. revisa validaciones;
6. aprueba;
7. cierra;
8. verifica rol de pago.

## Paso 9 — Probar flujo mínimo de desempeño
1. crea ciclo;
2. crea plantilla;
3. registra escala;
4. asigna evaluación;
5. evalúa;
6. recalifica si aplica;
7. publica resultado;
8. genera plan de mejora si queda bajo umbral.

## Paso 10 — Validar RLS
Prueba con:
- un admin del tenant,
- un líder,
- un colaborador normal.

Verifica que:
- el colaborador no vea información de otros,
- un tenant no vea datos de otro tenant,
- no se puedan editar períodos cerrados.

## Paso 11 — Auditoría
Consulta:

```sql
select event_type, entity_name, created_at, actor_user_id
from attendance.audit_events
order by created_at desc
limit 50;
```

Debes ver rastros de:
- cálculo de nómina,
- cierre,
- evaluación,
- recalificación,
- plan de mejora.

## Paso 12 — Errores comunes

### Error 1: columna no existe
Causa:
- tu esquema real difiere del esperado.

Solución:
- revisa el `SELECT` o `ALTER TABLE`,
- adapta nombres de columnas legacy.

### Error 2: RLS bloquea todo
Causa:
- helper function de tenant no devuelve valor.

Solución:
- prueba:
```sql
select attendance.get_my_tenant_id();
```
- valida sesión y relación con `public.profiles`.

### Error 3: rutas no aparecen en frontend
Causa:
- feature flag desactivado
- menú condicionado por permisos.

Solución:
- revisa tenant flags y guards.

## Paso 13 — Qué debe quedar funcionando al final
- tabs dinámicos en ficha de colaborador
- menú de nómina visible por flag
- menú de desempeño visible por flag
- creación de período de nómina
- cálculo de ejecución
- creación de ciclo de desempeño
- asignación y evaluación
- auditoría funcionando

## Recomendación final
No intentes construir todo en un solo commit grande.  
Trabaja por hitos:
1. SQL
2. servicios / RPC
3. rutas
4. formularios
5. reportes
6. QA