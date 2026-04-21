import React from 'react'
import { ArrowUpRight, Search, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatPercent } from './shared'

export type CollaboratorScopeRow = {
  employeeId: string
  employeeName: string
  employeeCode: string | null
  orgPath: string
  punctualityPct: number
  lateCount: number
  absenceCount: number
  fineAmount: number
  fineCount: number
  pendingRequests: number
  justificationCount: number
  permissionCount: number
  onVacationToday: boolean
}

type CollaboratorScopeModalProps = {
  open: boolean
  scopeLabel: string
  currentLevelLabel: string
  rows: CollaboratorScopeRow[]
  onClose: () => void
  onEmployeeSelect: (employeeId: string) => void
}

function CollaboratorScopeModalComponent({
  open,
  scopeLabel,
  currentLevelLabel,
  rows,
  onClose,
  onEmployeeSelect,
}: CollaboratorScopeModalProps) {
  const [search, setSearch] = React.useState('')
  const deferredSearch = React.useDeferredValue(search)

  React.useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open, scopeLabel])

  const filteredRows = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return rows

    return rows.filter((row) =>
      `${row.employeeName} ${row.employeeCode ?? ''} ${row.orgPath}`.toLowerCase().includes(query),
    )
  }, [deferredSearch, rows])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 isolate">
      <button
        type="button"
        aria-label="Cerrar colaboradores"
        className="absolute inset-0 bg-[#02060c]/90 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 top-8 mx-auto flex h-[calc(100vh-4rem)] w-[min(94vw,72rem)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,#07111d_0%,#091525_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.72)]">
        <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-[#07111d]/96 px-5 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Ultimo nivel</Badge>
              <Badge tone="neutral">{currentLevelLabel}</Badge>
              <Badge tone="good">{rows.length} colaborador(es)</Badge>
            </div>
            <h3 className="mt-3 text-[clamp(1.35rem,2vw,1.9rem)] font-semibold tracking-tight text-white">
              {scopeLabel}
            </h3>
            <p className="mt-1 text-sm text-white/58">
              Selecciona un colaborador para abrir el detalle completo de puntualidad, solicitudes, multas y vacaciones.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/72 transition hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-4 px-5 py-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto] lg:items-center">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar colaborador, codigo o unidad"
              className="border-white/10 bg-white/6 pr-11 text-white placeholder:text-white/38"
              right={<Search size={16} className="text-white/36" />}
            />

            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/68">
              <Users size={16} className="text-cyan-300" />
              <span>
                {filteredRows.length} visible(s) de {rows.length}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {filteredRows.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredRows.map((row) => (
                  <button
                    key={row.employeeId}
                    type="button"
                    onClick={() => onEmployeeSelect(row.employeeId)}
                    className="group rounded-[1.55rem] border border-white/10 bg-[#0b1726]/86 p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#0d1b2c]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-white">{row.employeeName}</p>
                          {row.employeeCode ? <Badge tone="neutral">{row.employeeCode}</Badge> : null}
                          {row.onVacationToday ? <Badge tone="good">Vacaciones</Badge> : null}
                        </div>
                        <p className="mt-2 truncate text-sm text-white/54" title={row.orgPath || 'Sin asignacion'}>
                          {row.orgPath || 'Sin asignacion'}
                        </p>
                      </div>

                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/7 text-white/68 transition group-hover:bg-cyan-400/16 group-hover:text-white">
                        <ArrowUpRight size={16} />
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Puntualidad</div>
                        <div className="mt-1 text-sm font-semibold text-white">{formatPercent(row.punctualityPct)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Atrasos / Ausencias</div>
                        <div className="mt-1 text-sm font-semibold text-white">{row.lateCount} / {row.absenceCount}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Pendientes</div>
                        <div className="mt-1 text-sm font-semibold text-white">{row.pendingRequests}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/62">
                      <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                        Justif. {row.justificationCount}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                        Permisos {row.permissionCount}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                        Multas {row.fineCount}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1">
                        {formatCurrency(row.fineAmount)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[18rem] items-center justify-center rounded-[1.8rem] border border-dashed border-white/12 bg-[#0b1726]/78 px-6 text-center">
                <div>
                  <p className="text-base font-semibold text-white">Sin colaboradores para mostrar</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    Ajusta la busqueda o cambia el nivel del organigrama para recuperar el detalle del equipo.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const CollaboratorScopeModal = React.memo(CollaboratorScopeModalComponent)

export default CollaboratorScopeModal
