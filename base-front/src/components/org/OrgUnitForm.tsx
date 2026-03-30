import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { EmployeeLookup, OrgLevelDefinition, OrgUnit } from '@/lib/orgStructure'

export function OrgUnitForm({
  open,
  initial,
  levels,
  parents,
  employees,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  initial: OrgUnit | null
  levels: OrgLevelDefinition[]
  parents: OrgUnit[]
  employees: EmployeeLookup[]
  onClose: () => void
  onSave: (payload: Partial<OrgUnit>) => void
  saving?: boolean
}) {
  const [form, setForm] = React.useState<Partial<OrgUnit>>(initial ?? {
    level_no: 1,
    parent_id: null,
    code: '',
    name: '',
    description: '',
    responsible_employee_id: null,
    is_active: true,
  })

  React.useEffect(() => {
    setForm(initial ?? {
      level_no: 1,
      parent_id: null,
      code: '',
      name: '',
      description: '',
      responsible_employee_id: null,
      is_active: true,
    })
  }, [initial, open])

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar unidad organizacional' : 'Nueva unidad organizacional'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          label="Nivel"
          value={String(form.level_no ?? 1)}
          onChange={(value) => setForm((prev) => ({ ...prev, level_no: Number(value) }))}
          options={levels.filter((level) => level.is_enabled).map((level) => ({ value: String(level.level_no), label: `${level.level_no} - ${level.display_name}` }))}
        />
        <Select
          label="Unidad padre"
          value={form.parent_id ?? ''}
          onChange={(value) => setForm((prev) => ({ ...prev, parent_id: value || null }))}
          options={parents.filter((unit) => unit.id !== initial?.id).map((unit) => ({ value: unit.id, label: `${unit.name} (Nivel ${unit.level_no})` }))}
          placeholder="Raíz / Sin padre"
        />
        <Input label="Código" value={form.code ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
        <Input label="Nombre" value={form.name ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        <div className="md:col-span-2">
          <Input label="Descripción" value={form.description ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </div>
        <Select
          label="Responsable / jefe"
          value={form.responsible_employee_id ?? ''}
          onChange={(value) => setForm((prev) => ({ ...prev, responsible_employee_id: value || null }))}
          options={employees.map((employee) => ({ value: employee.id, label: employee.employee_code ? `${employee.full_name} (${employee.employee_code})` : employee.full_name }))}
          placeholder="Sin responsable"
        />
        <Select
          label="Estado"
          value={form.is_active === false ? 'false' : 'true'}
          onChange={(value) => setForm((prev) => ({ ...prev, is_active: value === 'true' }))}
          options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]}
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={saving} onClick={() => onSave(form)}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </Modal>
  )
}
