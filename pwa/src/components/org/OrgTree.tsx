import React from 'react'
import { Building2, Pencil, Trash2 } from 'lucide-react'
import type { OrgUnit } from '@/lib/orgStructure'

export function OrgTree({
  units,
  onEdit,
  onDelete,
}: {
  units: OrgUnit[]
  onEdit: (unit: OrgUnit) => void
  onDelete: (unit: OrgUnit) => void
}) {
  const byParent = React.useMemo(() => {
    const map = new Map<string | null, OrgUnit[]>()
    for (const unit of units) {
      const key = unit.parent_id ?? null
      const list = map.get(key) ?? []
      list.push(unit)
      map.set(key, list)
    }
    return map
  }, [units])

  const renderNode = (unit: OrgUnit, depth: number): React.ReactNode => {
    const children = byParent.get(unit.id) ?? []
    return (
      <React.Fragment key={unit.id}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3" style={{ marginLeft: `${depth * 18}px` }}>
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
            <Building2 size={16} className="text-white/70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{unit.name}</span>
              <span className="text-xs text-white/45">Nivel {unit.level_no}</span>
              {!unit.is_active && <span className="text-xs text-rose-300">Inactivo</span>}
            </div>
            <div className="text-xs text-white/55">{unit.code || 'Sin código'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white/10" onClick={() => onEdit(unit)}>
              <Pencil size={14} />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/10 text-rose-300" onClick={() => onDelete(unit)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    )
  }

  const roots = byParent.get(null) ?? []

  if (!roots.length) {
    return <div className="text-sm text-white/50">No hay unidades organizacionales registradas.</div>
  }

  return <div className="space-y-3">{roots.map((root) => renderNode(root, 0))}</div>
}
