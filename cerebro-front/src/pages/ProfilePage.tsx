/**
 * ==============================================
 * CEREBRO SaaS - Página de Perfil
 * ==============================================
 */

import React, { useState } from 'react'
import { useAuth } from '../App'
import { User, Mail, Lock, Save, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const ProfilePage = () => {
  const { user, userRole } = useAuth()
  const [saving, setSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })

  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Perfil actualizado correctamente')
    } catch (error) {
      toast.error('Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (formData.new_password !== formData.confirm_password) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (formData.new_password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setSaving(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Contraseña actualizada correctamente')
      setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }))
    } catch (error) {
      toast.error('Error al cambiar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>
        <p className="text-slate-500 mt-1">Administra tu información personal</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'}
            </h2>
            <p className="text-slate-500">{user?.email}</p>
            <span className="badge badge-info mt-2 capitalize">{userRole || 'Usuario'}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-slate-800">Información Personal</h3>
        </div>
        <form onSubmit={handleSave}>
          <div className="card-body space-y-4">
            <div>
              <label className="input-label">Nombre Completo</label>
              <div className="input-group">
                <User className="input-icon" />
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="input-field input-with-icon"
                  placeholder="Tu nombre completo"
                />
              </div>
            </div>
            <div>
              <label className="input-label">Correo Electrónico</label>
              <div className="input-group">
                <Mail className="input-icon" />
                <input type="email" value={formData.email} disabled className="input-field input-with-icon bg-slate-50 cursor-not-allowed" />
              </div>
              <p className="input-hint">El correo no puede ser modificado</p>
            </div>
          </div>
          <div className="card-footer flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-slate-800">Cambiar Contraseña</h3>
        </div>
        <form onSubmit={handlePasswordChange}>
          <div className="card-body space-y-4">
            <div>
              <label className="input-label">Contraseña Actual</label>
              <div className="input-group">
                <Lock className="input-icon" />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.current_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_password: e.target.value }))}
                  className="input-field input-with-icon pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => togglePasswordVisibility('current')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="input-label">Nueva Contraseña</label>
              <div className="input-group">
                <Lock className="input-icon" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.new_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, new_password: e.target.value }))}
                  className="input-field input-with-icon pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => togglePasswordVisibility('new')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="input-label">Confirmar Nueva Contraseña</label>
              <div className="input-group">
                <Lock className="input-icon" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="input-field input-with-icon pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => togglePasswordVisibility('confirm')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="card-footer flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Cambiar Contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfilePage
