import React from 'react'
import { Building2, UserRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmployeeLeadershipBadge } from './EmployeeLeadershipBadge'

export function EmployeeOrgSection({
  orgPath,
  currentUnit,
  supervisor,
  isLeader,
  leaderLevelLabel,
}: {
  orgPath: string
  currentUnit?: string | null
  supervisor?: string | null
  isLeader?: boolean
  leaderLevelLabel?: string | null
}) {
  return (
    <Card title="Estructura organizacional" actions={<Building2 size={18} className="text-white/60" />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="card p-4">
          <div className="text-white/60">Unidad principal</div>
          <div className="mt-2 font-semibold">{currentUnit || '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-white/60">Supervisor inmediato</div>
          <div className="mt-2 inline-flex items-center gap-2 font-semibold">
            <UserRound size={14} className="text-white/60" /> {supervisor || '—'}
          </div>
        </div>
        <div className="card p-4 md:col-span-2">
          <div className="text-white/60">Ruta jerárquica</div>
          <div className="mt-2 font-semibold">{orgPath}</div>
        </div>
        <div className="card p-4 md:col-span-2">
          <div className="text-white/60">Jefatura</div>
          <div className="mt-2"><EmployeeLeadershipBadge isLeader={isLeader} levelLabel={leaderLevelLabel} /></div>
        </div>
      </div>
    </Card>
  )
}
