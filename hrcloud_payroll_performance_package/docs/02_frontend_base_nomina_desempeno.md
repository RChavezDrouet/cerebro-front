# Diseño frontend — Base / Nómina + Desempeño

## 1. Menú lateral sugerido

```ts
[
  {
    key: 'payroll',
    label: 'Nómina',
    visibleWhen: ['payroll_enabled'],
    children: [
      'Dashboard',
      'Parámetros',
      'Conceptos',
      'Fórmulas',
      'Períodos',
      'Pre-nómina',
      'Validaciones',
      'Cierre',
      'Roles de pago',
      'IESS',
      'SRI',
      'Liquidaciones',
      'Reportes'
    ]
  },
  {
    key: 'performance',
    label: 'Evaluación del Desempeño',
    visibleWhen: ['performance_enabled'],
    children: [
      'Ciclos',
      'Plantillas',
      'Competencias',
      'Objetivos/KPI',
      'Escalas',
      'Asignaciones',
      'Pendientes',
      'Evaluación',
      'Revisión/Recalificación',
      'Planes de mejora',
      'Brechas y capacitación',
      'Analítica'
    ]
  }
]
```

## 2. Look and feel
Debe seguir la misma línea de HRCloud:
- tarjetas limpias,
- tablas con filtros superiores,
- modales sobrios,
- badges de estado,
- tabs empresariales,
- layout consistente con Cerebro y Base.

## 3. Páginas mínimas

### 3.1 Nómina
- `PayrollDashboardPage`
- `PayrollSettingsPage`
- `PayrollConceptsPage`
- `PayrollFormulasPage`
- `PayrollPeriodsPage`
- `PayrollRunPage`
- `PayrollValidationPage`
- `PayrollClosePage`
- `PayrollReceiptsPage`
- `PayrollIessPage`
- `PayrollSriPage`
- `PayrollSettlementPage`
- `PayrollReportsPage`

### 3.2 Desempeño
- `PerformanceCyclesPage`
- `PerformanceTemplatesPage`
- `PerformanceCompetenciesPage`
- `PerformanceGoalsPage`
- `PerformanceScalesPage`
- `PerformanceAssignmentsPage`
- `PerformanceInboxPage`
- `PerformanceReviewFormPage`
- `PerformanceRecalificationPage`
- `PerformanceImprovementPlansPage`
- `PerformanceTrainingGapsPage`
- `PerformanceAnalyticsPage`

### 3.3 Ficha del colaborador
Una sola `EmployeeFormPage`, con tabs condicionales por flags.

## 4. Recomendación de rutas
```ts
/base/payroll
/base/payroll/settings
/base/payroll/concepts
/base/payroll/formulas
/base/payroll/periods
/base/payroll/runs/:id
/base/payroll/receipts
/base/payroll/iess
/base/payroll/sri
/base/payroll/settlements
/base/payroll/reports

/base/performance
/base/performance/cycles
/base/performance/templates
/base/performance/competencies
/base/performance/goals
/base/performance/scales
/base/performance/assignments
/base/performance/inbox
/base/performance/reviews/:id
/base/performance/recalification/:id
/base/performance/improvement-plans
/base/performance/training-gaps
/base/performance/analytics
```

## 5. UX obligatoria
- filtros persistentes por usuario
- tablas exportables
- wizard para ciclos y períodos
- validación inline
- confirmación en cierres
- historial auditable visible
- badges:
  - draft
  - in_progress
  - calculated
  - approved
  - closed
  - published
  - overdue

## 6. Integración con PWA
Prever desde ahora:
- roles cerrados visibles por colaborador
- autoevaluación
- consulta de resultados publicados
- aceptación de plan de mejora
- cursos asignados por brecha