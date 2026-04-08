// src/pages/config/DepartmentsPage.tsx
// v4.5.0 - Gestión de Departamentos

import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Pencil, Trash2, Loader2, CheckCircle,
  AlertCircle, X, Save, Users
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { resolveTenantId } from '@/lib/tenant';
import type { Department } from '@/pages/employees/employeeSchemas';

// ─────────────────────────────────────────
// Modal de crear/editar departamento
// ─────────────────────────────────────────
const DepartmentModal: React.FC<{
  dept: Partial<Department> | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ dept, onClose, onSaved }) => {
  const [name, setName] = useState(dept?.name || '');
  const [description, setDescription] = useState(dept?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    setIsSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant')
      const payload = { name: name.trim(), description: description.trim() || null, tenant_id: tenantId };
      if (dept?.id) {
        const { error: err } = await supabase.from('departments').update(payload).eq('id', dept.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('departments').insert(payload);
        if (err) throw err;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      if (msg.includes('unique')) setError('Ya existe un departamento con ese nombre');
      else setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-800">
            {dept?.id ? 'Editar departamento' : 'Nuevo departamento'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej. Recursos Humanos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Descripción del departamento (opcional)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────
export const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalDept, setModalDept] = useState<Partial<Department> | null | false>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadDepartments(); }, []);

  const loadDepartments = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant')
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      setDepartments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este departamento? Los empleados asignados quedarán sin departamento.')) return;
    setDeletingId(id);
    try {
      await supabase.from('departments').update({ is_active: false }).eq('id', id);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" /> Departamentos
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Organiza tu empresa por departamentos para una mejor gestión.
            </p>
          </div>
          <button
            onClick={() => setModalDept({})}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-16 text-gray-400 space-y-3">
            <Users className="w-12 h-12 mx-auto opacity-30" />
            <p className="text-sm">No hay departamentos. Crea el primero.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{dept.name}</p>
                  {dept.description && (
                    <p className="text-xs text-gray-500 truncate">{dept.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setModalDept(dept)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept.id)}
                    disabled={deletingId === dept.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === dept.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalDept !== false && (
        <DepartmentModal
          dept={modalDept}
          onClose={() => setModalDept(false)}
          onSaved={loadDepartments}
        />
      )}
    </>
  );
};

export default DepartmentsPage;
