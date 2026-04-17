# HRCloud — Paquete Enterprise de Nómina + Evaluación del Desempeño

Este paquete entrega una base implementable para **Base** dentro de HRCloud, con los siguientes principios:

- **Ficha única del colaborador**: no se duplica información existente; se extiende `public.employees` y `attendance.employee_profile`.
- **Activación por tenant** desde **Cerebro** mediante feature flags.
- **Nómina Ecuador** parametrizable.
- **Evaluación del desempeño** completamente parametrizable y coherente con el look and feel enterprise de HRCloud.
- **Capacitación basada en brechas** derivadas de la evaluación.
- **RLS multi-tenant** y auditoría empresarial.

## Estructura del paquete

- `sql/01_feature_flags_y_ficha_extendida.sql`
- `sql/02_payroll_core.sql`
- `sql/03_performance_and_training.sql`
- `sql/04_security_rls_audit.sql`
- `sql/05_rpc_workflows.sql`
- `sql/06_views_reports_seed.sql`
- `docs/00_arquitectura_funcional.md`
- `docs/01_guia_implementacion_junior.md`
- `docs/02_frontend_base_nomina_desempeno.md`
- `frontend/routes_and_menu_example.ts`
- `checklists/01_checklist_despliegue.md`

## Orden de ejecución recomendado

1. `sql/01_feature_flags_y_ficha_extendida.sql`
2. `sql/02_payroll_core.sql`
3. `sql/03_performance_and_training.sql`
4. `sql/04_security_rls_audit.sql`
5. `sql/05_rpc_workflows.sql`
6. `sql/06_views_reports_seed.sql`

## Importante

1. Este paquete **reutiliza** la base actual de HRCloud y no intenta reemplazar tablas existentes.
2. Las políticas RLS y RPC están diseñadas para **Supabase/PostgreSQL**.
3. Algunos campos de tablas legacy pueden variar entre ambientes. Cuando eso ocurra, ajusta los `SELECT` o `JOIN` usando la guía del archivo `docs/01_guia_implementacion_junior.md`.
4. La terminología funcional usada aquí es **colaborador**.

## Resultado esperado

Una vez aplicado el paquete, **Base** podrá exponer:
- Módulo **Nómina**
- Submódulo **Evaluación del Desempeño**
- Submódulo **Capacitación por brechas**
- Tabs dinámicos en la ficha del colaborador
- Auditoría, reportes y workflows base