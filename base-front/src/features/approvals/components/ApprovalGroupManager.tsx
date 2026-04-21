import React from 'react'
import { Pencil, Plus, Save, Users } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { GROUP_KIND_OPTIONS } from '../constants'
import type {
  ApprovalApproverGroupWithMembers,
  ApprovalSetupUser,
  UpsertApproverGroupInput,
} from '../types'

type DraftGroup = UpsertApproverGroupInput & { id?: string }

type Props = {
  groups: ApprovalApproverGroupWithMembers[]
  users: ApprovalSetupUser[]
  saving: boolean
  onSave: (input: UpsertApproverGroupInput) => Promise<void> | void
}

const emptyDraft: DraftGroup = {
  code: '',
  name: '',
  description: null,
  group_kind: 'generic',
  is_active: true,
  member_user_ids: [],
}

export function ApprovalGroupManager({ groups, users, saving, onSave }: Props) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DraftGroup>(emptyDraft)

  const openNew = React.useCallback(() => {
    setDraft(emptyDraft)
    setOpen(true)
  }, [])

  const openEdit = React.useCallback((group: ApprovalApproverGroupWithMembers) => {
    setDraft({
      id: group.id,
      code: group.code,
      name: group.name,
      description: group.description,
      group_kind: group.group_kind,
      is_active: group.is_active,
      member_user_ids: group.member_user_ids,
    })
    setOpen(true)
  }, [])

  const toggleMember = React.useCallback((userId: string) => {
    setDraft((current) => ({
      ...current,
      member_user_ids: current.member_user_ids.includes(userId)
        ? current.member_user_ids.filter((value) => value !== userId)
        : [...current.member_user_ids, userId],
    }))
  }, [])

  const handleSave = React.useCallback(async () => {
    await onSave({
      id: draft.id,
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      group_kind: draft.group_kind,
      is_active: draft.is_active,
      member_user_ids: draft.member_user_ids,
    })
    setOpen(false)
  }, [draft, onSave])

  return (
    <>
      <Card
        title="Grupos aprobadores"
        subtitle="Grupos reutilizables para bandeja compartida, RRHH y Nomina."
        actions={<Button size="sm" leftIcon={<Plus size={14} />} onClick={openNew}>Nuevo grupo</Button>}
      >
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-sm text-[var(--text-muted)]">
              No hay grupos configurados todavia.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{group.name}</div>
                    <Badge tone={group.is_active ? 'good' : 'neutral'}>{group.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    <Badge tone="info">{GROUP_KIND_OPTIONS.find((option) => option.value === group.group_kind)?.label ?? group.group_kind}</Badge>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{group.code}</div>
                  {group.description ? <div className="text-sm text-[var(--text-secondary)]">{group.description}</div> : null}
                  <div className="text-xs text-[var(--text-muted)]">{group.member_user_ids.length} miembro(s)</div>
                </div>
                <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => openEdit(group)}>
                  Editar
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={draft.id ? 'Editar grupo aprobador' : 'Nuevo grupo aprobador'}>
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Codigo"
              value={draft.code}
              onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              placeholder="RRHH_CORE"
            />
            <Input
              label="Nombre"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="RRHH principal"
            />
            <Select
              label="Tipo de grupo"
              value={draft.group_kind}
              onChange={(value) => setDraft((current) => ({ ...current, group_kind: value as DraftGroup['group_kind'] }))}
              options={GROUP_KIND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2">
              <div className="text-sm font-medium text-[var(--text-secondary)]">Estado</div>
              <button
                type="button"
                onClick={() => setDraft((current) => ({ ...current, is_active: !current.is_active }))}
                className={`mt-3 inline-flex h-7 w-12 items-center rounded-full px-1 transition ${
                  draft.is_active ? 'justify-end bg-emerald-500/70' : 'justify-start bg-white/10'
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-white" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Descripcion</label>
            <textarea
              value={draft.description ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
              placeholder="Uso del grupo dentro del flujo"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[var(--text-muted)]" />
              <div className="text-sm font-medium text-[var(--text-secondary)]">Miembros</div>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              {users.map((user) => {
                const checked = draft.member_user_ids.includes(user.user_id)
                return (
                  <label
                    key={user.user_id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm transition ${
                      checked
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                        : 'border-transparent bg-white/5 text-[var(--text-secondary)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{user.full_name}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{user.employee_code ?? user.user_id}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(user.user_id)}
                      className="h-4 w-4 rounded border-[var(--border-subtle)] bg-transparent"
                    />
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || draft.code.trim() === '' || draft.name.trim() === ''}
              leftIcon={<Save size={14} />}
            >
              {saving ? 'Guardando...' : 'Guardar grupo'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
