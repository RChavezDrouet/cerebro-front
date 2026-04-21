import React from 'react'
import { Mail, Sparkles, UserRoundCog } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  buildQuickApproverSeed,
  buildQuickSetupResult,
} from '../quickSetup'
import type { QuickApproverDraft, QuickSetupResult } from '../quickSetup'

type Props = {
  open: boolean
  flowName: string
  initialLevelCount: number
  onClose: () => void
  onApply: (result: QuickSetupResult) => void
}

function clampLevelCount(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.floor(value), 4))
}

export function ApprovalFlowQuickSetupModal({
  open,
  flowName,
  initialLevelCount,
  onClose,
  onApply,
}: Props) {
  const [levelCount, setLevelCount] = React.useState(clampLevelCount(initialLevelCount))
  const [approvers, setApprovers] = React.useState<QuickApproverDraft[]>(() => buildQuickApproverSeed(initialLevelCount))

  React.useEffect(() => {
    if (!open) return
    const nextLevelCount = clampLevelCount(initialLevelCount)
    setLevelCount(nextLevelCount)
    setApprovers(buildQuickApproverSeed(nextLevelCount))
  }, [initialLevelCount, open])

  const syncApprovers = React.useCallback((nextCount: number) => {
    setApprovers((current) => {
      const seed = buildQuickApproverSeed(nextCount)
      return seed.map((fallback, index) => ({
        step_order: index + 1,
        job_title: current[index]?.job_title ?? fallback.job_title,
        email: current[index]?.email ?? fallback.email,
      }))
    })
  }, [])

  const handleLevelCountChange = (rawValue: string) => {
    const nextCount = clampLevelCount(Number(rawValue || '1'))
    setLevelCount(nextCount)
    syncApprovers(nextCount)
  }

  const handleApproverChange = (index: number, patch: Partial<QuickApproverDraft>) => {
    setApprovers((current) =>
      current.map((approver, approverIndex) => (
        approverIndex === index ? { ...approver, ...patch } : approver
      )),
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Asistente rapido de aprobacion">
      <div className="space-y-5">
        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
              <Sparkles size={18} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-cyan-100">{flowName}</div>
              <p className="text-sm leading-6 text-cyan-50/80">
                Define de 1 a 4 niveles para una demo comercial. El nivel 1 siempre es el jefe inmediato y los correos se usan
                como referencia visual para pruebas y presentaciones.
              </p>
            </div>
          </div>
        </div>

        <Input
          label="Cuantos niveles de aprobacion necesitas?"
          type="number"
          min="1"
          max="4"
          value={String(levelCount)}
          onChange={(event) => handleLevelCountChange(event.target.value)}
          hint="Minimo 1. Para este mockup comercial soportamos hasta 4 niveles listos para demo."
        />

        <div className="space-y-3">
          {approvers.slice(0, levelCount).map((approver, index) => (
            <div key={approver.step_order} className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                  Nivel {approver.step_order}
                </span>
                {index === 0 ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Jefe inmediato obligatorio
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Cargo del aprobador"
                  value={approver.job_title}
                  onChange={(event) => handleApproverChange(index, { job_title: event.target.value })}
                  placeholder={index === 0 ? 'Jefe inmediato' : `Nivel ${approver.step_order}`}
                  right={<UserRoundCog size={16} className="text-[var(--text-muted)]" />}
                />
                <Input
                  label="Correo del aprobador"
                  type="email"
                  value={approver.email}
                  onChange={(event) => handleApproverChange(index, { email: event.target.value })}
                  placeholder="aprobador@empresa.com"
                  right={<Mail size={16} className="text-[var(--text-muted)]" />}
                  hint={index === 0 ? 'Correo de referencia demo. El motor real resuelve este nivel desde el organigrama.' : 'Correo de referencia para la presentacion comercial.'}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const seed = buildQuickApproverSeed(levelCount)
              setApprovers(seed)
            }}
          >
            Cargar demo
          </Button>
          <Button
            onClick={() => {
              onApply(buildQuickSetupResult(approvers.slice(0, levelCount)))
              onClose()
            }}
          >
            Aplicar al flujo
          </Button>
        </div>
      </div>
    </Modal>
  )
}
