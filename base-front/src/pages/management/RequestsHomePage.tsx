import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCheck,
  CircleDollarSign,
  FileClock,
  GitBranch,
  ShieldCheck,
  TimerReset,
  Wallet,
  Workflow,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { listPendingApprovals } from '@/features/approvals/services/approvalFlows'
import { useTenantContext } from '@/hooks/useTenantContext'
import { listTransactionalRequests } from '@/features/requests/services/requestTransactions'
import type { RequestKind } from '@/features/requests/types'

type OverviewMetrics = {
  total: number
  draft: number
  inApproval: number
  approved: number
  rejected: number
}

type OverviewPayload = {
  byKind: Record<RequestKind, OverviewMetrics>
  totalRequests: number
  totalDrafts: number
  totalInApproval: number
  totalApproved: number
  totalRejected: number
  pendingApprovals: number
  highPriorityApprovals: number
  overdueApprovals: number
}

type ModuleItem = {
  title: string
  description: string
  to: string
  icon: React.ReactNode
  accentClass: string
  kind?: RequestKind
}

const REQUEST_KINDS: RequestKind[] = [
  'attendance_justifications',
  'permission_requests',
  'loan_requests',
  'salary_advance_requests',
  'vacation_requests',
]

const MODULES: ModuleItem[] = [
  {
    title: 'Justificaciones',
    description: 'Atrasos, faltas, salidas anticipadas e ingreso anticipado a break.',
    to: '/management/requests/justifications',
    icon: <Workflow size={18} />,
    accentClass: 'from-cyan-500/20 via-cyan-500/8 to-transparent',
    kind: 'attendance_justifications',
  },
  {
    title: 'Permisos',
    description: 'Permisos por horas o dias con trazabilidad y envio a aprobacion.',
    to: '/management/requests/permissions',
    icon: <FileClock size={18} />,
    accentClass: 'from-amber-500/20 via-amber-500/8 to-transparent',
    kind: 'permission_requests',
  },
  {
    title: 'Prestamos',
    description: 'Prestamos internos con cuotas, motivo documentado y auditoria.',
    to: '/management/requests/loans',
    icon: <BriefcaseBusiness size={18} />,
    accentClass: 'from-emerald-500/20 via-emerald-500/8 to-transparent',
    kind: 'loan_requests',
  },
  {
    title: 'Adelantos',
    description: 'Anticipos de sueldo listos para integrarse despues con nomina.',
    to: '/management/requests/salary-advances',
    icon: <CircleDollarSign size={18} />,
    accentClass: 'from-fuchsia-500/20 via-fuchsia-500/8 to-transparent',
    kind: 'salary_advance_requests',
  },
  {
    title: 'Vacaciones',
    description: 'Solicitudes con saldo declarado, dias solicitados y trazabilidad.',
    to: '/management/requests/vacations',
    icon: <CalendarClock size={18} />,
    accentClass: 'from-sky-500/20 via-sky-500/8 to-transparent',
    kind: 'vacation_requests',
  },
  {
    title: 'Aprobaciones pendientes',
    description: 'Bandeja del usuario actual para aceptar o rechazar niveles activos.',
    to: '/management/approvals',
    icon: <Wallet size={18} />,
    accentClass: 'from-rose-500/20 via-rose-500/8 to-transparent',
  },
]

function emptyMetrics(): OverviewMetrics {
  return {
    total: 0,
    draft: 0,
    inApproval: 0,
    approved: 0,
    rejected: 0,
  }
}

function aggregateMetrics(records: Array<{ request_status: string }>): OverviewMetrics {
  return records.reduce(
    (acc, record) => {
      acc.total += 1
      if (record.request_status === 'borrador') acc.draft += 1
      if (record.request_status === 'en_aprobacion') acc.inApproval += 1
      if (record.request_status === 'aprobado') acc.approved += 1
      if (record.request_status === 'rechazado') acc.rejected += 1
      return acc
    },
    emptyMetrics(),
  )
}

export default function RequestsHomePage() {
  const { user } = useAuth()
  const tenantContext = useTenantContext(user?.id)
  const tenantId = tenantContext.data?.tenantId

  const overviewQuery = useQuery<OverviewPayload>({
    queryKey: ['management-requests-overview', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [justifications, permissions, loans, salaryAdvances, vacations, pendingApprovals] = await Promise.all([
        listTransactionalRequests('attendance_justifications'),
        listTransactionalRequests('permission_requests'),
        listTransactionalRequests('loan_requests'),
        listTransactionalRequests('salary_advance_requests'),
        listTransactionalRequests('vacation_requests'),
        listPendingApprovals(),
      ])

      const byKind: Record<RequestKind, OverviewMetrics> = {
        attendance_justifications: aggregateMetrics(justifications),
        permission_requests: aggregateMetrics(permissions),
        loan_requests: aggregateMetrics(loans),
        salary_advance_requests: aggregateMetrics(salaryAdvances),
        vacation_requests: aggregateMetrics(vacations),
      }

      const totals = REQUEST_KINDS.reduce(
        (acc, kind) => {
          const metrics = byKind[kind]
          acc.totalRequests += metrics.total
          acc.totalDrafts += metrics.draft
          acc.totalInApproval += metrics.inApproval
          acc.totalApproved += metrics.approved
          acc.totalRejected += metrics.rejected
          return acc
        },
        {
          totalRequests: 0,
          totalDrafts: 0,
          totalInApproval: 0,
          totalApproved: 0,
          totalRejected: 0,
        },
      )

      return {
        byKind,
        ...totals,
        pendingApprovals: pendingApprovals.length,
        highPriorityApprovals: pendingApprovals.filter((item) => item.priority_visual === 'alta').length,
        overdueApprovals: pendingApprovals.filter((item) => item.pending_minutes >= 24 * 60).length,
      }
    },
  })

  if (tenantContext.isLoading || overviewQuery.isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  const overview = overviewQuery.data ?? {
    byKind: {
      attendance_justifications: emptyMetrics(),
      permission_requests: emptyMetrics(),
      loan_requests: emptyMetrics(),
      salary_advance_requests: emptyMetrics(),
      vacation_requests: emptyMetrics(),
    },
    totalRequests: 0,
    totalDrafts: 0,
    totalInApproval: 0,
    totalApproved: 0,
    totalRejected: 0,
    pendingApprovals: 0,
    highPriorityApprovals: 0,
    overdueApprovals: 0,
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-[#07111d]/92 px-5 py-6 shadow-soft sm:px-6">
        <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-36 w-36 rounded-full bg-amber-400/12 blur-3xl" />
        <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">Gestion de solicitudes</Badge>
              <Badge tone="warn">Multi-tenant + RLS</Badge>
              <Badge tone="good">Auditoria activa</Badge>
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.2rem]">
                Mockup operativo para solicitudes y aprobaciones
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
                Esta vista centraliza los procesos transaccionales del tenant y la bandeja de aprobacion. Queda dentro de
                `base-front`, por lo que se vera en DigitalOcean al subir el build.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/management/requests/justifications"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] shadow-soft transition hover:brightness-110"
              >
                Crear solicitud
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/management/approvals"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Revisar aprobaciones
                <GitBranch size={16} />
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Trazabilidad completa</div>
                <p className="mt-1 text-sm text-white/60">
                  Cada accion deja fecha, usuario y comentario visible para auditoria.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200">
                  <GitBranch size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Motor comun</div>
                <p className="mt-1 text-sm text-white/60">
                  Justificaciones, permisos, prestamos, adelantos y vacaciones comparten flujo y fallback.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                  <TimerReset size={18} />
                </div>
                <div className="text-sm font-semibold text-white">Listo para despliegue</div>
                <p className="mt-1 text-sm text-white/60">
                  La UI es responsive y queda en rutas reales del tenant panel.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Solicitudes totales</div>
              <div className="mt-3 text-4xl font-semibold">{overview.totalRequests}</div>
              <div className="mt-2 text-sm text-white/60">Todas las transacciones registradas en el tenant.</div>
            </Card>
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">En aprobacion</div>
              <div className="mt-3 text-4xl font-semibold">{overview.totalInApproval}</div>
              <div className="mt-2 text-sm text-white/60">Solicitudes que ya entraron al flujo de niveles.</div>
            </Card>
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Pendientes por revisar</div>
              <div className="mt-3 text-4xl font-semibold">{overview.pendingApprovals}</div>
              <div className="mt-2 text-sm text-white/60">
                {overview.highPriorityApprovals} con prioridad alta y {overview.overdueApprovals} con mas de 24h.
              </div>
            </Card>
            <Card className="rounded-[1.8rem] border-white/10 bg-white/7 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Para correccion</div>
              <div className="mt-3 text-4xl font-semibold">{overview.totalRejected}</div>
              <div className="mt-2 text-sm text-white/60">Solicitudes rechazadas que aun pueden corregirse y reenviarse.</div>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
        <Card
          title="Canales transaccionales"
          subtitle="Cada tarjeta lleva a una pantalla real del modulo y muestra volumen actual."
          className="rounded-[2rem]"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((item) => {
              const metrics = item.kind ? overview.byKind[item.kind] : null

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative overflow-hidden rounded-[1.8rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[var(--surface-elevated)]`}
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${item.accentClass}`} />
                  <div className="relative flex h-full flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white/85">
                          {item.icon}
                        </div>
                        <Badge tone={item.kind ? 'info' : 'warn'}>
                          {item.kind ? `${metrics?.total ?? 0} registro(s)` : `${overview.pendingApprovals} pendiente(s)`}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-base font-semibold">{item.title}</div>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {metrics ? (
                        <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)]">
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                            <div className="font-semibold text-white">{metrics.draft}</div>
                            <div>Borrador</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                            <div className="font-semibold text-white">{metrics.inApproval}</div>
                            <div>En flujo</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                            <div className="font-semibold text-white">{metrics.approved}</div>
                            <div>Aprobadas</div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                            <div className="font-semibold text-white">{overview.highPriorityApprovals}</div>
                            <div>Alta prioridad</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                            <div className="font-semibold text-white">{overview.overdueApprovals}</div>
                            <div>Mas de 24h</div>
                          </div>
                        </div>
                      )}

                      <div className="inline-flex items-center gap-2 text-sm font-medium text-white/80 transition group-hover:text-white">
                        Abrir modulo
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

        <Card
          title="Como se mueve el flujo"
          subtitle="El mockup respeta el motor comun ya implementado."
          className="rounded-[2rem]"
          actions={<Badge tone="good">Listo para DO</Badge>}
        >
          <div className="space-y-4">
            {[
              {
                step: '1. Registro',
                detail: 'El usuario crea la solicitud, guarda borrador o la envia a aprobacion.',
                icon: <Workflow size={16} />,
              },
              {
                step: '2. Resolucion',
                detail: 'PostgreSQL resuelve supervisor, grupo, RRHH, nomina o usuario puntual.',
                icon: <GitBranch size={16} />,
              },
              {
                step: '3. Decision',
                detail: 'Cada aprobador deja nota obligatoria al aprobar o rechazar.',
                icon: <CheckCheck size={16} />,
              },
              {
                step: '4. Trazabilidad',
                detail: 'La solicitud mantiene historial, auditoria y estado final por nivel.',
                icon: <ShieldCheck size={16} />,
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 rounded-[1.6rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4">
                <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/6 text-cyan-300">
                  {item.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.step}</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}
