import React from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { JUSTIFICATION_TYPE_OPTIONS } from '../config'
import { calculateVacationDays, canManageRequests } from '../utils'
import type {
  ActorProfile,
  AttendanceJustificationDraft,
  EmployeeOption,
  LoanRequestDraft,
  PermissionRequestDraft,
  RequestKind,
  SalaryAdvanceRequestDraft,
  TransactionalRequestDraft,
  VacationRequestDraft,
} from '../types'

function employeeLabel(employee: EmployeeOption): string {
  return employee.employee_code ? `${employee.full_name} (${employee.employee_code})` : employee.full_name
}

function updateDraft<K extends TransactionalRequestDraft>(draft: K, patch: Partial<K>): K {
  return { ...draft, ...patch }
}

export function RequestFormModal({
  open,
  kind,
  title,
  actorProfile,
  employees,
  initialDraft,
  saving,
  onClose,
  onSaveDraft,
  onSaveAndSubmit,
}: {
  open: boolean
  kind: RequestKind
  title: string
  actorProfile: ActorProfile | null
  employees: EmployeeOption[]
  initialDraft: TransactionalRequestDraft | null
  saving: boolean
  onClose: () => void
  onSaveDraft: (draft: TransactionalRequestDraft) => Promise<void> | void
  onSaveAndSubmit: (draft: TransactionalRequestDraft) => Promise<void> | void
}) {
  const [draft, setDraft] = React.useState<TransactionalRequestDraft | null>(initialDraft)
  const allowEmployeeSelection = canManageRequests(actorProfile?.role)
  const missingEmployeeAssociation = !allowEmployeeSelection && actorProfile?.employee_id == null

  React.useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  if (!draft) return null

  const scopedEmployees = allowEmployeeSelection
    ? employees
    : employees.filter((employee) => employee.employee_id === actorProfile?.employee_id)

  const employeeOptions = scopedEmployees.map((employee) => ({
    value: employee.employee_id,
    label: employeeLabel(employee),
  }))

  const setEmployee = (employeeId: string) => {
    setDraft((current) => current ? updateDraft(current, { employee_id: employeeId }) : current)
  }

  const renderEmployeeField = () => (
    <Select
      label="Colaborador"
      value={draft.employee_id}
      onChange={setEmployee}
      options={employeeOptions}
      disabled={!allowEmployeeSelection}
      placeholder="Seleccione un colaborador"
    />
  )

  const renderTextarea = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
  ) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
      />
    </div>
  )

  const renderFields = () => {
    switch (kind) {
      case 'attendance_justifications': {
        const typedDraft = draft as AttendanceJustificationDraft
        return (
          <div className="grid gap-4">
            {renderEmployeeField()}
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Tipo de justificación"
                value={typedDraft.justification_type}
                onChange={(value) =>
                  setDraft((current) => current ? updateDraft(current as AttendanceJustificationDraft, { justification_type: value as AttendanceJustificationDraft['justification_type'] }) : current)
                }
                options={JUSTIFICATION_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
              <Input
                label="Fecha de trabajo"
                type="date"
                value={typedDraft.work_date}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as AttendanceJustificationDraft, { work_date: event.target.value }) : current)
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Marcación relacionada"
                value={typedDraft.related_punch_id ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as AttendanceJustificationDraft, { related_punch_id: event.target.value.trim() || null }) : current)
                }
                placeholder="UUID opcional"
              />
              <Input
                label="Adjunto URL"
                value={typedDraft.attachment_url ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as AttendanceJustificationDraft, { attachment_url: event.target.value.trim() || null }) : current)
                }
                placeholder="https://..."
              />
            </div>
            {renderTextarea(
              'Motivo',
              typedDraft.reason,
              (value) => setDraft((current) => current ? updateDraft(current as AttendanceJustificationDraft, { reason: value }) : current),
              'Describe la justificación de la marcación',
            )}
          </div>
        )
      }
      case 'permission_requests': {
        const typedDraft = draft as PermissionRequestDraft
        return (
          <div className="grid gap-4">
            {renderEmployeeField()}
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Tipo"
                value={typedDraft.request_type}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { request_type: event.target.value }) : current)
                }
                placeholder="general, médico, personal..."
              />
              <Input
                label="Desde"
                type="date"
                value={typedDraft.start_date}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { start_date: event.target.value }) : current)
                }
              />
              <Input
                label="Hasta"
                type="date"
                value={typedDraft.end_date}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { end_date: event.target.value }) : current)
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Hora inicio"
                type="time"
                value={typedDraft.start_time ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { start_time: event.target.value || null }) : current)
                }
              />
              <Input
                label="Hora fin"
                type="time"
                value={typedDraft.end_time ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { end_time: event.target.value || null }) : current)
                }
              />
              <Input
                label="Horas solicitadas"
                type="number"
                min="0"
                step="0.5"
                value={typedDraft.hours_requested ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { hours_requested: event.target.value === '' ? null : Number(event.target.value) }) : current)
                }
              />
            </div>
            <Input
              label="Adjunto URL"
              value={typedDraft.attachment_url ?? ''}
              onChange={(event) =>
                setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { attachment_url: event.target.value.trim() || null }) : current)
              }
              placeholder="https://..."
            />
            {renderTextarea(
              'Motivo',
              typedDraft.reason,
              (value) => setDraft((current) => current ? updateDraft(current as PermissionRequestDraft, { reason: value }) : current),
              'Describe el motivo del permiso',
            )}
          </div>
        )
      }
      case 'loan_requests': {
        const typedDraft = draft as LoanRequestDraft
        return (
          <div className="grid gap-4">
            {renderEmployeeField()}
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Monto solicitado"
                type="number"
                min="0"
                step="0.01"
                value={typedDraft.amount_requested ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as LoanRequestDraft, { amount_requested: event.target.value === '' ? null : Number(event.target.value) }) : current)
                }
              />
              <Input
                label="Moneda"
                value={typedDraft.currency_code}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as LoanRequestDraft, { currency_code: event.target.value.toUpperCase() }) : current)
                }
              />
              <Input
                label="Cuotas"
                type="number"
                min="1"
                step="1"
                value={typedDraft.installments}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as LoanRequestDraft, { installments: Number(event.target.value || '1') }) : current)
                }
              />
            </div>
            {renderTextarea(
              'Motivo',
              typedDraft.reason,
              (value) => setDraft((current) => current ? updateDraft(current as LoanRequestDraft, { reason: value }) : current),
              'Describe el destino o la razón del préstamo',
            )}
          </div>
        )
      }
      case 'salary_advance_requests': {
        const typedDraft = draft as SalaryAdvanceRequestDraft
        return (
          <div className="grid gap-4">
            {renderEmployeeField()}
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Monto solicitado"
                type="number"
                min="0"
                step="0.01"
                value={typedDraft.amount_requested ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as SalaryAdvanceRequestDraft, { amount_requested: event.target.value === '' ? null : Number(event.target.value) }) : current)
                }
              />
              <Input
                label="Moneda"
                value={typedDraft.currency_code}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as SalaryAdvanceRequestDraft, { currency_code: event.target.value.toUpperCase() }) : current)
                }
              />
              <Input
                label="Fecha estimada de pago"
                type="date"
                value={typedDraft.requested_pay_date ?? ''}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as SalaryAdvanceRequestDraft, { requested_pay_date: event.target.value || null }) : current)
                }
              />
            </div>
            {renderTextarea(
              'Motivo',
              typedDraft.reason,
              (value) => setDraft((current) => current ? updateDraft(current as SalaryAdvanceRequestDraft, { reason: value }) : current),
              'Describe el motivo del adelanto',
            )}
          </div>
        )
      }
      case 'vacation_requests': {
        const typedDraft = draft as VacationRequestDraft
        return (
          <div className="grid gap-4">
            {renderEmployeeField()}
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Inicio"
                type="date"
                value={typedDraft.start_date}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as VacationRequestDraft, {
                    start_date: event.target.value,
                    days_requested: calculateVacationDays(event.target.value, (current as VacationRequestDraft).end_date),
                  }) : current)
                }
              />
              <Input
                label="Fin"
                type="date"
                value={typedDraft.end_date}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as VacationRequestDraft, {
                    end_date: event.target.value,
                    days_requested: calculateVacationDays((current as VacationRequestDraft).start_date, event.target.value),
                  }) : current)
                }
              />
              <Input
                label="Días solicitados"
                type="number"
                min="1"
                step="1"
                value={typedDraft.days_requested}
                onChange={(event) =>
                  setDraft((current) => current ? updateDraft(current as VacationRequestDraft, { days_requested: Number(event.target.value || '1') }) : current)
                }
              />
            </div>
            <Input
              label="Saldo disponible"
              type="number"
              min="0"
              step="0.5"
              value={typedDraft.available_balance_days ?? ''}
              onChange={(event) =>
                setDraft((current) => current ? updateDraft(current as VacationRequestDraft, {
                  available_balance_days: event.target.value === '' ? null : Number(event.target.value),
                }) : current)
              }
            />
            {renderTextarea(
              'Motivo',
              typedDraft.reason,
              (value) => setDraft((current) => current ? updateDraft(current as VacationRequestDraft, { reason: value }) : current),
              'Observaciones de la solicitud',
            )}
          </div>
        )
      }
      default:
        return null
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        {!allowEmployeeSelection && actorProfile?.employee_id == null ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Tu usuario no tiene colaborador asociado. Un administrador debe vincularlo antes de registrar solicitudes propias.
          </div>
        ) : null}

        {renderFields()}

        {!allowEmployeeSelection ? (
          <div className="text-xs text-[var(--text-muted)]">
            El colaborador se fija al usuario actual porque tu rol no tiene gestión total del tenant.
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" disabled={saving || missingEmployeeAssociation} onClick={() => draft ? onSaveDraft(draft) : undefined}>
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </Button>
          <Button disabled={saving || missingEmployeeAssociation} onClick={() => draft ? onSaveAndSubmit(draft) : undefined}>
            {saving ? 'Procesando...' : 'Guardar y enviar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
