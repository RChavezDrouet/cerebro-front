import type { OrgLevelDefinition, OrgUnit } from '@/lib/orgStructure'

export const MOCK_DASHBOARD_TENANT_ID = '00000000-0000-4000-8000-000000000901'

export type MockJourneyLabel =
  | 'Matutina'
  | 'Vespertina'
  | 'Nocturna'
  | 'Mixta'
  | 'Administrativa'

export type MockJourneyProfile = {
  label: MockJourneyLabel
  lateMultiplier: number
  absenceMultiplier: number
  permissionMultiplier: number
  fineMultiplier: number
  overtimeMultiplier: number
  saturdayRate: number
  sundayRate: number
  scheduleStart: string
  scheduleEnd: string
  crossesMidnight?: boolean
}

export type MockLeafUnitSeed = {
  id: string
  code: string
  name: string
  parentId: string
  headcount: number
  journeyMix: Array<{ label: MockJourneyLabel; weight: number }>
  risk: {
    late: number
    absence: number
    permission: number
    fine: number
    overtime: number
    novelty: number
  }
}

export type MockDepartmentSeed = {
  id: string
  code: string
  name: string
  units: MockLeafUnitSeed[]
}

export type MockEmployeeSeed = {
  unitId: string | null
  topUnitId: string | null
  topUnitName: string | null
  leafUnitName: string | null
  headcount: number
  journeyMix: Array<{ label: MockJourneyLabel; weight: number }>
  risk: {
    late: number
    absence: number
    permission: number
    fine: number
    overtime: number
    novelty: number
  }
}

export const MOCK_ORG_LEVELS_TEMPLATE: Array<Omit<OrgLevelDefinition, 'tenant_id'>> = [
  {
    level_no: 1,
    level_key: 'DIVISION',
    display_name: 'Unidad principal',
    is_enabled: true,
  },
  {
    level_no: 2,
    level_key: 'TEAM',
    display_name: 'Subunidad',
    is_enabled: true,
  },
]

export const MOCK_JOURNEYS: MockJourneyProfile[] = [
  {
    label: 'Matutina',
    lateMultiplier: 1.04,
    absenceMultiplier: 0.96,
    permissionMultiplier: 0.95,
    fineMultiplier: 1.02,
    overtimeMultiplier: 0.92,
    saturdayRate: 0.76,
    sundayRate: 0.08,
    scheduleStart: '08:00',
    scheduleEnd: '17:00',
  },
  {
    label: 'Vespertina',
    lateMultiplier: 1.11,
    absenceMultiplier: 1.02,
    permissionMultiplier: 1.04,
    fineMultiplier: 1.06,
    overtimeMultiplier: 1.02,
    saturdayRate: 0.84,
    sundayRate: 0.18,
    scheduleStart: '13:00',
    scheduleEnd: '21:30',
  },
  {
    label: 'Nocturna',
    lateMultiplier: 1.28,
    absenceMultiplier: 1.22,
    permissionMultiplier: 0.92,
    fineMultiplier: 1.18,
    overtimeMultiplier: 1.1,
    saturdayRate: 0.9,
    sundayRate: 0.54,
    scheduleStart: '22:00',
    scheduleEnd: '06:00',
    crossesMidnight: true,
  },
  {
    label: 'Mixta',
    lateMultiplier: 1.15,
    absenceMultiplier: 1.08,
    permissionMultiplier: 1,
    fineMultiplier: 1.08,
    overtimeMultiplier: 1.46,
    saturdayRate: 0.9,
    sundayRate: 0.32,
    scheduleStart: '10:00',
    scheduleEnd: '19:00',
  },
  {
    label: 'Administrativa',
    lateMultiplier: 0.72,
    absenceMultiplier: 0.74,
    permissionMultiplier: 1.12,
    fineMultiplier: 0.68,
    overtimeMultiplier: 0.56,
    saturdayRate: 0.24,
    sundayRate: 0.02,
    scheduleStart: '08:30',
    scheduleEnd: '17:30',
  },
]

export const MOCK_DEPARTMENTS: MockDepartmentSeed[] = [
  {
    id: 'org-ti',
    code: 'TI',
    name: 'TI',
    units: [
      {
        id: 'org-ti-helpdesk',
        code: 'TI-HD',
        name: 'HelpDesk',
        parentId: 'org-ti',
        headcount: 10,
        journeyMix: [
          { label: 'Matutina', weight: 3 },
          { label: 'Vespertina', weight: 2 },
          { label: 'Mixta', weight: 3 },
          { label: 'Administrativa', weight: 2 },
        ],
        risk: { late: 1.1, absence: 0.9, permission: 0.92, fine: 0.88, overtime: 1.12, novelty: 1.08 },
      },
      {
        id: 'org-ti-infra',
        code: 'TI-INF',
        name: 'Infraestructura',
        parentId: 'org-ti',
        headcount: 8,
        journeyMix: [
          { label: 'Vespertina', weight: 2 },
          { label: 'Nocturna', weight: 3 },
          { label: 'Mixta', weight: 3 },
        ],
        risk: { late: 0.96, absence: 0.82, permission: 0.86, fine: 0.92, overtime: 1.28, novelty: 1.02 },
      },
    ],
  },
  {
    id: 'org-rrhh',
    code: 'RRHH',
    name: 'RRHH',
    units: [
      {
        id: 'org-rrhh-seleccion',
        code: 'RRHH-SEL',
        name: 'Seleccion',
        parentId: 'org-rrhh',
        headcount: 8,
        journeyMix: [
          { label: 'Matutina', weight: 3 },
          { label: 'Administrativa', weight: 5 },
        ],
        risk: { late: 0.9, absence: 0.95, permission: 1.32, fine: 0.72, overtime: 0.86, novelty: 0.96 },
      },
      {
        id: 'org-rrhh-nomina',
        code: 'RRHH-NOM',
        name: 'Nomina',
        parentId: 'org-rrhh',
        headcount: 9,
        journeyMix: [
          { label: 'Administrativa', weight: 5 },
          { label: 'Matutina', weight: 2 },
          { label: 'Mixta', weight: 2 },
        ],
        risk: { late: 0.86, absence: 0.82, permission: 1.04, fine: 0.72, overtime: 1.38, novelty: 0.94 },
      },
    ],
  },
  {
    id: 'org-finanzas',
    code: 'FIN',
    name: 'Finanzas',
    units: [
      {
        id: 'org-fin-conta',
        code: 'FIN-CON',
        name: 'Contabilidad',
        parentId: 'org-finanzas',
        headcount: 12,
        journeyMix: [
          { label: 'Administrativa', weight: 8 },
          { label: 'Matutina', weight: 4 },
        ],
        risk: { late: 1, absence: 0.76, permission: 0.86, fine: 0.78, overtime: 1.24, novelty: 0.9 },
      },
      {
        id: 'org-fin-teso',
        code: 'FIN-TES',
        name: 'Tesoreria',
        parentId: 'org-finanzas',
        headcount: 8,
        journeyMix: [
          { label: 'Administrativa', weight: 5 },
          { label: 'Matutina', weight: 3 },
        ],
        risk: { late: 0.88, absence: 0.72, permission: 0.8, fine: 0.72, overtime: 1.04, novelty: 0.88 },
      },
    ],
  },
  {
    id: 'org-operaciones',
    code: 'OPS',
    name: 'Operaciones',
    units: [
      {
        id: 'org-ops-campo',
        code: 'OPS-CAM',
        name: 'Campo',
        parentId: 'org-operaciones',
        headcount: 18,
        journeyMix: [
          { label: 'Matutina', weight: 5 },
          { label: 'Vespertina', weight: 4 },
          { label: 'Mixta', weight: 6 },
          { label: 'Nocturna', weight: 3 },
        ],
        risk: { late: 1.46, absence: 1.34, permission: 0.96, fine: 1.46, overtime: 1.54, novelty: 1.38 },
      },
      {
        id: 'org-ops-log',
        code: 'OPS-LOG',
        name: 'Logistica',
        parentId: 'org-operaciones',
        headcount: 15,
        journeyMix: [
          { label: 'Vespertina', weight: 5 },
          { label: 'Nocturna', weight: 5 },
          { label: 'Mixta', weight: 5 },
        ],
        risk: { late: 1.34, absence: 1.14, permission: 0.92, fine: 1.32, overtime: 1.46, novelty: 1.28 },
      },
    ],
  },
  {
    id: 'org-comercial',
    code: 'COM',
    name: 'Comercial',
    units: [
      {
        id: 'org-com-ventas',
        code: 'COM-VEN',
        name: 'Ventas',
        parentId: 'org-comercial',
        headcount: 16,
        journeyMix: [
          { label: 'Matutina', weight: 6 },
          { label: 'Vespertina', weight: 6 },
          { label: 'Mixta', weight: 2 },
          { label: 'Administrativa', weight: 2 },
        ],
        risk: { late: 1.16, absence: 1.02, permission: 1.12, fine: 1.02, overtime: 1, novelty: 1.08 },
      },
      {
        id: 'org-com-sac',
        code: 'COM-SAC',
        name: 'Atencion al cliente',
        parentId: 'org-comercial',
        headcount: 12,
        journeyMix: [
          { label: 'Vespertina', weight: 5 },
          { label: 'Nocturna', weight: 4 },
          { label: 'Mixta', weight: 2 },
          { label: 'Matutina', weight: 1 },
        ],
        risk: { late: 1.24, absence: 1.2, permission: 1.04, fine: 1.16, overtime: 0.96, novelty: 1.18 },
      },
    ],
  },
]

export const MOCK_UNASSIGNED_POOL: MockEmployeeSeed = {
  unitId: null,
  topUnitId: null,
  topUnitName: null,
  leafUnitName: null,
  headcount: 6,
  journeyMix: [
    { label: 'Matutina', weight: 2 },
    { label: 'Vespertina', weight: 1 },
    { label: 'Mixta', weight: 2 },
    { label: 'Administrativa', weight: 1 },
  ],
  risk: { late: 1.06, absence: 1.08, permission: 0.96, fine: 1.04, overtime: 1.08, novelty: 1.1 },
}

export const MOCK_FIRST_NAMES = [
  'Ana', 'Luis', 'Maria', 'Carlos', 'Diana', 'Jose', 'Andrea', 'Miguel', 'Paola', 'Javier',
  'Camila', 'Diego', 'Valeria', 'Santiago', 'Fernanda', 'Pablo', 'Daniela', 'Ricardo', 'Elena', 'Mateo',
  'Veronica', 'Gabriel', 'Rocio', 'Andres', 'Melissa', 'Sebastian', 'Lorena', 'Martin', 'Natalia', 'Esteban',
]

export const MOCK_SECOND_NAMES = [
  'Alejandra', 'David', 'Isabel', 'Alejandro', 'Lucia', 'Rene', 'Patricia', 'Tomas', 'Jimena', 'Rafael',
  'Beatriz', 'Julian', 'Noemi', 'Adrian', 'Monica', 'Victor', 'Tatiana', 'Nicolas', 'Eva', 'Cristian',
]

export const MOCK_LAST_NAMES = [
  'Garcia', 'Mendoza', 'Santos', 'Vera', 'Salazar', 'Castillo', 'Paredes', 'Mora', 'Lopez', 'Cedeno',
  'Villacis', 'Benitez', 'Guerrero', 'Romero', 'Cabrera', 'Ruiz', 'Flores', 'Aguirre', 'Ponce', 'Crespo',
  'Ortega', 'Suarez', 'Morales', 'Navarrete', 'Ibarra', 'Macias', 'Toala', 'Zambrano', 'Yanez', 'Coronel',
]

export const MOCK_PERMISSION_LABELS = [
  'Permiso personal',
  'Consulta medica',
  'Tramite bancario',
  'Calamidad domestica',
  'Gestion documental',
]

export const MOCK_OPERATIONAL_NOVELTIES = [
  'Registro manual',
  'Olvido de marcacion',
  'Ajuste de turno',
  'Desfase de horario',
]

export function buildMockOrgLevels(tenantId: string): OrgLevelDefinition[] {
  return MOCK_ORG_LEVELS_TEMPLATE.map((level) => ({
    tenant_id: tenantId,
    ...level,
  }))
}

export function buildMockOrgUnits(tenantId: string): OrgUnit[] {
  const topUnits = MOCK_DEPARTMENTS.map<OrgUnit>((department) => ({
    id: department.id,
    tenant_id: tenantId,
    level_no: 1,
    parent_id: null,
    code: department.code,
    name: department.name,
    description: `${department.name} - demo dashboard`,
    responsible_employee_id: null,
    is_active: true,
  }))

  const leafUnits = MOCK_DEPARTMENTS.flatMap((department) =>
    department.units.map<OrgUnit>((unit) => ({
      id: unit.id,
      tenant_id: tenantId,
      level_no: 2,
      parent_id: department.id,
      code: unit.code,
      name: unit.name,
      description: `${unit.name} - demo dashboard`,
      responsible_employee_id: null,
      is_active: true,
    })),
  )

  return [...topUnits, ...leafUnits]
}
