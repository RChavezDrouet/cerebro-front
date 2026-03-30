import React from 'react'
import { Building2, Crown, Sparkles, UserRound, UsersRound } from 'lucide-react'
import type { EmployeeLookup, OrgLevelDefinition, OrgUnit } from '@/lib/orgStructure'

type TreeNode = OrgUnit & { children: TreeNode[] }

const LEVEL_STYLES = [
  {
    card: 'from-rose-500 via-red-500 to-orange-400 border-rose-200/30 shadow-[0_22px_60px_rgba(244,63,94,0.35)]',
    glow: 'bg-rose-300/30',
    badge: 'bg-rose-100/15 text-rose-50 border-rose-100/20',
  },
  {
    card: 'from-amber-400 via-yellow-400 to-orange-300 border-amber-100/35 shadow-[0_22px_60px_rgba(251,191,36,0.30)]',
    glow: 'bg-amber-200/30',
    badge: 'bg-amber-100/15 text-amber-50 border-amber-100/20',
  },
  {
    card: 'from-emerald-500 via-green-500 to-lime-400 border-emerald-100/30 shadow-[0_22px_60px_rgba(34,197,94,0.30)]',
    glow: 'bg-emerald-200/30',
    badge: 'bg-emerald-100/15 text-emerald-50 border-emerald-100/20',
  },
  {
    card: 'from-sky-500 via-cyan-500 to-blue-500 border-sky-100/30 shadow-[0_22px_60px_rgba(14,165,233,0.30)]',
    glow: 'bg-sky-200/30',
    badge: 'bg-sky-100/15 text-sky-50 border-sky-100/20',
  },
  {
    card: 'from-violet-500 via-fuchsia-500 to-purple-500 border-violet-100/30 shadow-[0_22px_60px_rgba(139,92,246,0.30)]',
    glow: 'bg-violet-200/30',
    badge: 'bg-violet-100/15 text-violet-50 border-violet-100/20',
  },
  {
    card: 'from-teal-500 via-cyan-500 to-emerald-500 border-teal-100/30 shadow-[0_22px_60px_rgba(20,184,166,0.28)]',
    glow: 'bg-teal-200/30',
    badge: 'bg-teal-100/15 text-teal-50 border-teal-100/20',
  },
  {
    card: 'from-indigo-500 via-blue-600 to-slate-700 border-indigo-100/30 shadow-[0_22px_60px_rgba(79,70,229,0.32)]',
    glow: 'bg-indigo-200/30',
    badge: 'bg-indigo-100/15 text-indigo-50 border-indigo-100/20',
  },
] as const

function styleForLevel(levelNo: number) {
  return LEVEL_STYLES[(Math.max(levelNo, 1) - 1) % LEVEL_STYLES.length]
}

function iconForLevel(levelNo: number) {
  if (levelNo === 1) return Crown
  if (levelNo <= 3) return Building2
  if (levelNo <= 5) return UsersRound
  return Sparkles
}

function buildTree(units: OrgUnit[]): TreeNode[] {
  const activeUnits = units.filter((unit) => unit.is_active !== false)
  const byParent = new Map<string | null, TreeNode[]>()
  const byId = new Map<string, TreeNode>()

  for (const unit of activeUnits) {
    byId.set(unit.id, { ...unit, children: [] })
  }

  for (const unit of activeUnits) {
    const node = byId.get(unit.id)!
    const parentKey = unit.parent_id && byId.has(unit.parent_id) ? unit.parent_id : null
    const siblings = byParent.get(parentKey) ?? []
    siblings.push(node)
    byParent.set(parentKey, siblings)
  }

  const attach = (node: TreeNode): TreeNode => {
    node.children = (byParent.get(node.id) ?? [])
      .sort((a, b) => {
        if (a.level_no !== b.level_no) return a.level_no - b.level_no
        return a.name.localeCompare(b.name)
      })
      .map(attach)
    return node
  }

  return (byParent.get(null) ?? [])
    .sort((a, b) => {
      if (a.level_no !== b.level_no) return a.level_no - b.level_no
      return a.name.localeCompare(b.name)
    })
    .map(attach)
}

function placeholderTree(levels: OrgLevelDefinition[]): TreeNode[] {
  const enabled = levels.filter((level) => level.is_enabled)
  if (!enabled.length) return []

  let previousId: string | null = null
  const nodes: TreeNode[] = []

  for (const level of enabled) {
    const node: TreeNode = {
      id: `placeholder-${level.level_no}`,
      tenant_id: level.tenant_id,
      level_no: level.level_no,
      parent_id: previousId,
      code: `N${level.level_no}`,
      name: level.display_name,
      description:
        level.level_no === 1
          ? 'Define la unidad principal con “Nueva unidad”.'
          : 'Este nivel ya quedó configurado y listo para usarse en el árbol.',
      responsible_employee_id: null,
      is_active: true,
      children: [],
    }
    if (!previousId) {
      nodes.push(node)
    } else {
      let current = nodes[0]
      while (current.children.length > 0) current = current.children[0]
      current.children.push(node)
    }
    previousId = node.id
  }

  return nodes
}

function NodeCard({
  node,
  levelDefinitions,
  employeeMap,
  compact = false,
}: {
  node: TreeNode
  levelDefinitions: OrgLevelDefinition[]
  employeeMap: Record<string, string>
  compact?: boolean
}) {
  const style = styleForLevel(node.level_no)
  const Icon = iconForLevel(node.level_no)
  const levelName = levelDefinitions.find((level) => level.level_no === node.level_no)?.display_name ?? `Nivel ${node.level_no}`
  const responsible = node.responsible_employee_id ? employeeMap[node.responsible_employee_id] : null

  return (
    <div className="relative w-[240px] max-w-[82vw]">
      <div className={`absolute inset-x-6 -bottom-4 h-8 rounded-full blur-2xl ${style.glow}`} />
      <div
        className={[
          'relative overflow-hidden rounded-[26px] border bg-gradient-to-br p-4 text-white',
          style.card,
          compact ? 'min-h-[118px]' : 'min-h-[138px]',
        ].join(' ')}
        style={{
          transform: 'perspective(1200px) rotateX(10deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.26),rgba(255,255,255,0.04)_35%,rgba(255,255,255,0.01)_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-black/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-2xl border border-white/20 bg-white/12 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Icon size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
                {levelName}
              </div>
              <div className="mt-2 truncate text-base font-black tracking-tight">{node.name}</div>
              <div className="mt-1 text-xs text-white/80">{node.code || `N${node.level_no}`}</div>
            </div>
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold">L{node.level_no}</div>
        </div>

        <div className="relative mt-3 space-y-1.5 text-xs text-white/85">
          {responsible ? (
            <div className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2">
              <UserRound size={13} className="text-white/90" />
              <span className="truncate">{responsible}</span>
            </div>
          ) : null}
          {node.description ? (
            <div className="line-clamp-2 rounded-xl bg-black/10 px-3 py-2 text-white/80">{node.description}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ChartBranch({
  node,
  levelDefinitions,
  employeeMap,
  depth = 0,
}: {
  node: TreeNode
  levelDefinitions: OrgLevelDefinition[]
  employeeMap: Record<string, string>
  depth?: number
}) {
  const children = node.children ?? []

  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} levelDefinitions={levelDefinitions} employeeMap={employeeMap} compact={depth > 2} />

      {children.length > 0 && (
        <>
          <div className="h-8 w-px bg-gradient-to-b from-white/60 to-white/10" />
          <div className="relative flex flex-wrap justify-center gap-x-6 gap-y-8 pt-6">
            {children.length > 1 ? <div className="absolute left-10 right-10 top-0 h-px bg-white/25" /> : null}
            {children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center pt-6">
                <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-gradient-to-b from-white/60 to-white/10" />
                <ChartBranch node={child} levelDefinitions={levelDefinitions} employeeMap={employeeMap} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function OrgChart3D({
  units,
  levels,
  employees,
}: {
  units: OrgUnit[]
  levels: OrgLevelDefinition[]
  employees: EmployeeLookup[]
}) {
  const employeeMap = React.useMemo(
    () =>
      Object.fromEntries(
        employees.map((employee) => [
          employee.id,
          employee.employee_code ? `${employee.full_name} (${employee.employee_code})` : employee.full_name,
        ]),
      ),
    [employees],
  )

  const tree = React.useMemo(() => {
    const built = buildTree(units)
    return built.length > 0 ? built : placeholderTree(levels)
  }, [units, levels])

  const activeUnits = units.filter((unit) => unit.is_active !== false)
  const enabledLevels = levels.filter((level) => level.is_enabled)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Niveles activos</div>
          <div className="mt-2 text-3xl font-black text-white">{enabledLevels.length}</div>
          <div className="mt-1 text-sm text-white/60">Hasta 7 niveles por tenant</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Unidades activas</div>
          <div className="mt-2 text-3xl font-black text-white">{activeUnits.length}</div>
          <div className="mt-1 text-sm text-white/60">
            {activeUnits.length > 0 ? 'Ya forman parte del organigrama' : 'Aún no has creado unidades'}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Modo visual</div>
          <div className="mt-2 flex items-center gap-2 text-xl font-black text-white">
            <Sparkles size={20} className="text-fuchsia-300" />
            Vista gráfica 3D
          </div>
          <div className="mt-1 text-sm text-white/60">Tarjetas con profundidad, color y jerarquía</div>
        </div>
      </div>

      {activeUnits.length === 0 ? (
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
          Guardar niveles solo configura los nombres de la jerarquía. Para que el organigrama se vea con unidades reales, crea la primera unidad con el botón <b>“Nueva unidad”</b>.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.10),transparent_26%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.10),transparent_24%),rgba(2,6,23,0.35)] p-6">
        <div className="min-w-max px-4 pb-4">
          <div className="flex flex-wrap justify-center gap-10">
            {tree.map((root) => (
              <ChartBranch
                key={root.id}
                node={root}
                levelDefinitions={levels}
                employeeMap={employeeMap}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
