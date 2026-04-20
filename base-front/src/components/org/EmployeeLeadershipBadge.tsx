import React from 'react'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export function EmployeeLeadershipBadge({
  isLeader,
  levelLabel,
}: {
  isLeader?: boolean
  levelLabel?: string | null
}) {
  if (!isLeader) return <Badge tone="neutral">No es líder</Badge>
  return (
    <Badge tone="info">
      <span className="inline-flex items-center gap-1">
        <Star size={12} className="fill-current" />
        Líder{levelLabel ? ` de ${levelLabel}` : ' de unidad'}
      </span>
    </Badge>
  )
}
