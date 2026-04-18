import type { OrgLevelDefinition, OrgUnit } from '@/lib/orgStructure'

export type OrgAssignmentRow = {
  employee_id: string
  org_unit_id: string | null
}

export type OrgMetricBaseRow = {
  employeeId: string
  employeeName: string
  employeeCode: string | null
  value: number
}

export type OrgDrillNode = {
  nodeId: string
  nodeName: string
  parentId: string | null
  level: number
  levelLabel: string
  path: string[]
  pathLabels: string[]
  pathIds: string[]
}

export type OrgMetricRow = OrgMetricBaseRow & {
  nodes: OrgDrillNode[]
}

export type OrgDrillSlice = {
  label: string
  value: number
  color: string
  nodeId: string | null
  nodeName: string
  parentId: string | null
  level: number
  levelLabel: string
  path: string[]
  pathLabels: string[]
  pathIds: string[]
  hasChildren: boolean
  metaKey: string
}

function startsWithPath(pathIds: string[], prefixIds: string[]) {
  if (prefixIds.length > pathIds.length) return false
  return prefixIds.every((id, index) => pathIds[index] === id)
}

function buildLevelLabelMap(levels: OrgLevelDefinition[]) {
  return new Map(
    levels
      .filter((level) => level.is_enabled !== false)
      .map((level) => [level.level_no, level.display_name || `Nivel ${level.level_no}`]),
  )
}

function buildAssignedNodes(
  unitId: string,
  unitsById: Map<string, OrgUnit>,
  levelLabelByNo: Map<number, string>,
) {
  const chain: OrgUnit[] = []
  const visited = new Set<string>()
  let currentId: string | null = unitId

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const unit = unitsById.get(currentId)
    if (!unit) break
    chain.unshift(unit)
    currentId = unit.parent_id
  }

  return chain.map((unit, index) => ({
    nodeId: unit.id,
    nodeName: unit.name,
    parentId: unit.parent_id,
    level: unit.level_no,
    levelLabel: levelLabelByNo.get(unit.level_no) ?? `Nivel ${unit.level_no}`,
    path: chain.slice(0, index + 1).map((item) => item.name),
    pathLabels: chain.slice(0, index + 1).map((item) => item.name),
    pathIds: chain.slice(0, index + 1).map((item) => item.id),
  }))
}

function buildUnassignedNodes(levels: OrgLevelDefinition[]) {
  const firstEnabledLevel = levels
    .filter((level) => level.is_enabled !== false)
    .sort((a, b) => a.level_no - b.level_no)[0]

  return [{
    nodeId: '__unassigned__',
    nodeName: 'Sin asignacion',
    parentId: null,
    level: firstEnabledLevel?.level_no ?? 1,
    levelLabel: firstEnabledLevel?.display_name ?? 'Nivel organizacional',
    path: ['Sin asignacion'],
    pathLabels: ['Sin asignacion'],
    pathIds: ['__unassigned__'],
  }]
}

export function buildOrgMetricRows(
  rows: OrgMetricBaseRow[],
  assignments: OrgAssignmentRow[],
  units: OrgUnit[],
  levels: OrgLevelDefinition[],
) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))
  const levelLabelByNo = buildLevelLabelMap(levels)
  const assignmentByEmployeeId = new Map<string, string | null>()

  for (const row of assignments) {
    if (!assignmentByEmployeeId.has(row.employee_id)) {
      assignmentByEmployeeId.set(row.employee_id, row.org_unit_id)
    }
  }

  return rows
    .filter((row) => row.value > 0)
    .map<OrgMetricRow>((row) => {
      const unitId = assignmentByEmployeeId.get(row.employeeId) ?? null
      const nodes = unitId && unitsById.has(unitId)
        ? buildAssignedNodes(unitId, unitsById, levelLabelByNo)
        : buildUnassignedNodes(levels)

      return {
        ...row,
        nodes,
      }
    })
}

export function buildOrgSlices(
  rows: OrgMetricRow[],
  currentPathIds: string[],
  colors: string[],
  metaKey: string,
) {
  const grouped = new Map<string, { node: OrgDrillNode; value: number; hasChildren: boolean }>()

  for (const row of rows) {
    if (!startsWithPath(row.nodes.map((node) => node.nodeId), currentPathIds)) continue

    const nextNode = row.nodes[currentPathIds.length]
    if (!nextNode) continue

    const current = grouped.get(nextNode.nodeId)
    const hasChildren = row.nodes.length > currentPathIds.length + 1
    if (current) {
      current.value += row.value
      current.hasChildren = current.hasChildren || hasChildren
      continue
    }

    grouped.set(nextNode.nodeId, {
      node: nextNode,
      value: row.value,
      hasChildren,
    })
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.value - a.value || a.node.nodeName.localeCompare(b.node.nodeName))
    .map<OrgDrillSlice>((entry, index) => ({
      label: entry.node.nodeName,
      value: entry.value,
      color: colors[index % colors.length],
      nodeId: entry.node.nodeId,
      nodeName: entry.node.nodeName,
      parentId: entry.node.parentId,
      level: entry.node.level,
      levelLabel: entry.node.levelLabel,
      path: entry.node.path,
      pathLabels: entry.node.pathLabels,
      pathIds: entry.node.pathIds,
      hasChildren: entry.hasChildren,
      metaKey,
    }))
}

export function collectPeopleAtPath(rows: OrgMetricRow[], currentPathIds: string[]) {
  return rows
    .filter((row) => startsWithPath(row.nodes.map((node) => node.nodeId), currentPathIds))
    .sort((a, b) => b.value - a.value || a.employeeName.localeCompare(b.employeeName))
}

export function getOrgDepth(rows: OrgMetricRow[]) {
  return rows.reduce((maxDepth, row) => Math.max(maxDepth, row.nodes.length), 0)
}
