# Arquitectura funcional propuesta — HRCloud Base

## 1. Contexto

HRCloud opera con dos plataformas separadas:

- **Cerebro**: control SaaS del proveedor, activación de módulos, tenant status, branding y mensajes globales.
- **Base**: operación del tenant; aquí viven asistencia, novedades, ficha del colaborador, nómina y gestión de talento.
- **PWA**: autoservicio del colaborador para marcaciones y, a futuro, consulta de roles y desempeño.

## 2. Principios de diseño

### 2.1 Ficha única del colaborador
No se crea una segunda ficha.  
Se parte de:
- `public.employees`
- `attendance.employee_profile`
- `attendance.memberships`

Se agregan extensiones orientadas a:
- datos laborales de nómina,
- datos tributarios,
- datos bancarios,
- perfil de evaluación,
- historial de acciones y elegibilidad.

### 2.2 Activación por feature flags
Cerebro debe manejar, por tenant:

- `payroll_enabled`
- `performance_enabled`
- `training_enabled`
- `employee_portal_enabled`

**Reglas**:
- si `payroll_enabled = false`, Base oculta y bloquea nómina.
- si `performance_enabled = false`, Base oculta y bloquea desempeño.
- si `training_enabled = false`, Base oculta capacitación.
- si el tenant está `paused` o `is_suspended = true`, Base bloquea acceso operativo sensible.

### 2.3 Parametrización real
Nada crítico debe quedar hardcodeado:
- conceptos de nómina,
- fórmulas,
- tablas tributarias,
- tasas IESS,
- políticas de provisión,
- escalas de evaluación,
- pesos,
- ciclos,
- matrices de competencias,
- reglas de elegibilidad.

## 3. Módulos dentro de Base

### 3.1 Ficha unificada del colaborador
Tabs siempre visibles:
- identificación
- contacto
- jornada
- modalidad
- asistencia
- estructura organizacional
- PWA / geocerca / biometría
- historial básico

Tabs al activar **Nómina**:
- laboral y contrato
- pago y banco
- IESS
- tributario / SRI
- dependientes
- formación y trayectoria
- acciones de personal
- vacaciones
- préstamos y anticipos
- histórico de nómina

Tabs al activar **Evaluación del Desempeño**:
- perfil de evaluación
- historial de evaluaciones
- objetivos y metas
- competencias y comportamientos
- feedback
- plan de mejora
- brechas y capacitación sugerida
- elegibilidad para ascenso / incremento / bono

### 3.2 Módulo Nómina Ecuador
Subopciones sugeridas:
- dashboard
- parámetros
- conceptos
- fórmulas
- períodos
- pre-nómina
- validaciones
- cierres
- roles de pago
- IESS
- SRI
- liquidaciones
- reportes

### 3.3 Módulo Evaluación del Desempeño
Subopciones sugeridas:
- ciclos
- plantillas
- competencias
- objetivos / KPI
- escalas
- asignaciones
- evaluaciones pendientes
- formulario de evaluación
- revisión / recalificación
- planes de mejora
- brechas y capacitación
- analítica

## 4. Integración entre módulos

### 4.1 Asistencia → Nómina
Base consume:
- marcaciones interpretadas
- novedades justificadas / rechazadas
- horas extra aprobadas
- ausencias y permisos

### 4.2 Desempeño → Capacitación
Puntajes bajos o brechas generan:
- plan de mejora
- recomendación de entrenamiento
- plan formal de capacitación
- seguimiento de cierre de brecha

### 4.3 Desempeño → Compensación / Acciones
El resultado consolidado puede impactar:
- bono,
- incremento salarial,
- promoción,
- sucesión,
- permanencia,
- medida correctiva.

## 5. Motor técnico recomendado

### 5.1 Base de datos
- PostgreSQL / Supabase
- schema principal: `attendance`
- seguridad: RLS + funciones `SECURITY DEFINER`
- auditoría en tabla dedicada

### 5.2 Lógica de negocio
Usar RPC para:
- cálculo de nómina
- cierre / reapertura
- asignación de evaluaciones
- publicación de resultados
- generación de plan de mejora

### 5.3 Frontend
- React + TypeScript + Vite
- Tabs dinámicos en `EmployeeFormPage`
- Guards por feature flags y tenant state
- formularios enterprise coherentes con Cerebro/Base:
  - sidebar similar,
  - tablas densas pero legibles,
  - estados visibles,
  - filtros persistentes,
  - breadcrumbs,
  - historial auditable.

## 6. Modelo de seguridad

### 6.1 RLS
Toda tabla nueva lleva `tenant_id`.
Toda consulta se filtra por `attendance.get_my_tenant_id()`.

### 6.2 Separación de funciones
Roles funcionales sugeridos:
- `tenant_admin`
- `hr_admin`
- `payroll_admin`
- `payroll_approver`
- `performance_admin`
- `performance_reviewer`
- `manager`
- `employee`

### 6.3 Auditoría
Registrar como mínimo:
- cambios salariales
- cambios contractuales
- cambios tributarios
- cálculo / recálculo / cierre de nómina
- publicación / recalificación de evaluaciones
- generación y cierre de planes de mejora

## 7. Entregables reales de este paquete
Este paquete incluye:
- SQL base
- RLS
- auditoría
- RPC iniciales
- vistas / seeds
- guía junior
- estructura frontend sugerida

No incluye build compilado de Base ni despliegue automático; deja la plataforma lista para integración por el equipo técnico.