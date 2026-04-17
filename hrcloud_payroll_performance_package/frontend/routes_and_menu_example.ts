export type TenantModuleFlags = {
  payroll_enabled: boolean;
  performance_enabled: boolean;
  training_enabled: boolean;
  employee_portal_enabled: boolean;
  status?: 'active' | 'paused' | 'suspended';
  is_suspended?: boolean;
};

export const buildBaseMenu = (flags: TenantModuleFlags) => {
  const blocked = flags.status !== 'active' || flags.is_suspended === true;

  return [
    { key: 'dashboard', label: 'Dashboard', visible: true, blocked },
    { key: 'employees', label: 'Colaboradores', visible: true, blocked },
    {
      key: 'payroll',
      label: 'Nómina',
      visible: flags.payroll_enabled,
      blocked: blocked || !flags.payroll_enabled,
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
        'Reportes',
      ],
    },
    {
      key: 'performance',
      label: 'Evaluación del Desempeño',
      visible: flags.performance_enabled,
      blocked: blocked || !flags.performance_enabled,
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
        'Analítica',
      ],
    },
    {
      key: 'training',
      label: 'Capacitación',
      visible: flags.training_enabled,
      blocked: blocked || !flags.training_enabled,
      children: [
        'Catálogo',
        'Planes',
        'Seguimiento',
        'Cierre de brechas',
      ],
    },
  ].filter((item) => item.visible);
};

export const employeeTabs = (flags: TenantModuleFlags) => {
  const baseTabs = [
    'Identificación',
    'Contacto',
    'Jornada',
    'Modalidad',
    'Asistencia',
    'Organización',
    'PWA/Biometría',
    'Historial',
  ];

  const payrollTabs = flags.payroll_enabled
    ? [
        'Laboral y Contrato',
        'Pago y Banco',
        'IESS',
        'Tributario/SRI',
        'Dependientes',
        'Vacaciones',
        'Préstamos y Anticipos',
      ]
    : [];

  const performanceTabs = flags.performance_enabled
    ? [
        'Perfil de Evaluación',
        'Historial de Evaluaciones',
        'Objetivos y Metas',
        'Competencias',
        'Plan de Mejora',
        'Brechas y Capacitación',
        'Elegibilidad',
      ]
    : [];

  return [...baseTabs, ...payrollTabs, ...performanceTabs];
};