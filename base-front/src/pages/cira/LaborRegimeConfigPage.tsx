import React, { useState, useEffect } from 'react';
import { supabase, ATT_SCHEMA } from '@/config/supabase';
import { z } from 'zod';
import toast from 'react-hot-toast';

type LaborRegimeConfig = {
  tenant_id: string;
  regime: 'LOSEP' | 'CODIGO_TRABAJO';
  night_start: string;
  night_end: string;
  max_suplem_daily_h: number;
  max_suplem_monthly_h: number;
  fine_cap_pct: number;
  reincidence_threshold: number;
  reincidence_multiplier: number;
};

type SurchargeRule = {
  id: string;
  regime: string;
  hour_type: string;
  multiplier: number;
  is_active: boolean;
  valid_from: string | null;
};

const HOUR_TYPE_LABELS: Record<string, string> = {
  NORMAL_DIURNA:           'Normal Diurna',
  NORMAL_NOCTURNA:         'Normal Nocturna',
  SUPLEMENTARIA:           'Suplementaria',
  SUPLEMENTARIA_NOCTURNA:  'Suplementaria Nocturna',
  EXTRAORDINARIA:          'Extraordinaria',
  EXTRAORDINARIA_NOCTURNA: 'Extraordinaria Nocturna',
};

const configSchema = z.object({
  regime:                  z.enum(['LOSEP', 'CODIGO_TRABAJO']),
  night_start:             z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
  night_end:               z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
  max_suplem_daily_h:      z.number().min(0).max(24),
  max_suplem_monthly_h:    z.number().min(0).max(300),
  fine_cap_pct:            z.number().min(0).max(100),
  reincidence_threshold:   z.number().min(1).max(31),
  reincidence_multiplier:  z.number().min(1).max(10),
});

const LaborRegimeConfigPage: React.FC = () => {
  const [config, setConfig] = useState<LaborRegimeConfig | null>(null);
  const [rules, setRules]   = useState<SurchargeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: configData, error: configError } = await supabase
        .schema(ATT_SCHEMA)
        .from('labor_regime_config')
        .select('*')
        .single();

      if (configError) throw configError;

      const { data: rulesData, error: rulesError } = await supabase
        .schema(ATT_SCHEMA)
        .from('surcharge_rules')
        .select('id, regime, hour_type, multiplier, is_active, valid_from')
        .eq('tenant_id', configData.tenant_id)
        .order('regime')
        .order('hour_type');

      if (rulesError) throw rulesError;

      configData.night_start = configData.night_start?.slice(0, 5) ?? '19:00';
      configData.night_end   = configData.night_end?.slice(0, 5)   ?? '06:00';

      setConfig(configData);
      setRules(rulesData ?? []);
    } catch (err) {
      toast.error('Error al cargar la configuración');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = <K extends keyof LaborRegimeConfig>(
    key: K,
    value: LaborRegimeConfig[K]
  ) => setConfig((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleSave = async () => {
    if (!config) return;

    const result = configSchema.safeParse(config);
    if (!result.success) {
      const msg = result.error.errors[0]?.message ?? 'Error de validación';
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .schema(ATT_SCHEMA)
        .from('labor_regime_config')
        .upsert({
          ...config,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Configuración guardada correctamente');
    } catch (err) {
      toast.error('Error al guardar la configuración');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const groupedRules = rules.reduce<Record<string, SurchargeRule[]>>((acc, rule) => {
    if (!acc[rule.regime]) acc[rule.regime] = [];
    acc[rule.regime].push(rule);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 text-red-600">
        Error al cargar la configuración. Recarga la página.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Configuración de Régimen Laboral
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Define el régimen laboral y los parámetros de cálculo para tu empresa.
        </p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        {/* Régimen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Régimen Laboral
          </label>
          <select
            value={config.regime}
            onChange={(e) => handleChange('regime', e.target.value as LaborRegimeConfig['regime'])}
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="CODIGO_TRABAJO">Código de Trabajo (Sector Privado)</option>
            <option value="LOSEP">LOSEP (Sector Público)</option>
          </select>
        </div>

        {/* Franja nocturna */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Franja Horaria Nocturna
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Inicio</label>
              <input
                type="time"
                value={config.night_start}
                onChange={(e) => handleChange('night_start', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fin (puede cruzar medianoche)</label>
              <input
                type="time"
                value={config.night_end}
                onChange={(e) => handleChange('night_end', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Límites suplementarias */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Límites de Horas Suplementarias
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Máx. Diarias (horas)</label>
              <input
                type="number"
                min={0} max={24} step={0.5}
                value={config.max_suplem_daily_h}
                onChange={(e) => handleChange('max_suplem_daily_h', parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Máx. Mensuales (horas)</label>
              <input
                type="number"
                min={0} max={300} step={1}
                value={config.max_suplem_monthly_h}
                onChange={(e) => handleChange('max_suplem_monthly_h', parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Multas */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Política de Multas
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tope de Multas (%)</label>
              <input
                type="number"
                min={0} max={100} step={0.5}
                value={config.fine_cap_pct}
                onChange={(e) => handleChange('fine_cap_pct', parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Umbral Reincidencia (atrasos)</label>
              <input
                type="number"
                min={1} max={31} step={1}
                value={config.reincidence_threshold}
                onChange={(e) => handleChange('reincidence_threshold', parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Multiplicador Reincidencia</label>
              <input
                type="number"
                min={1} max={10} step={0.1}
                value={config.reincidence_multiplier}
                onChange={(e) => handleChange('reincidence_multiplier', parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </form>

      {/* Tabla de recargos (readonly) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Reglas de Recargo Configuradas
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Estos multiplicadores se aplican sobre la Hora Base (HB = Sueldo / 240).
          Para modificarlos contacta al administrador del sistema.
        </p>

        {Object.entries(groupedRules).map(([regime, regimeRules]) => (
          <div key={regime} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
              {regime === 'CODIGO_TRABAJO' ? 'Código de Trabajo' : 'LOSEP'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 border border-gray-200 font-medium text-gray-600">Tipo de Hora</th>
                    <th className="px-4 py-2 border border-gray-200 font-medium text-gray-600">Multiplicador</th>
                    <th className="px-4 py-2 border border-gray-200 font-medium text-gray-600">Factor HB</th>
                    <th className="px-4 py-2 border border-gray-200 font-medium text-gray-600">Activo</th>
                    <th className="px-4 py-2 border border-gray-200 font-medium text-gray-600">Vigente desde</th>
                  </tr>
                </thead>
                <tbody>
                  {regimeRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border border-gray-200">
                        {HOUR_TYPE_LABELS[rule.hour_type] ?? rule.hour_type}
                      </td>
                      <td className="px-4 py-2 border border-gray-200 font-mono">
                        × {rule.multiplier}
                      </td>
                      <td className="px-4 py-2 border border-gray-200 text-gray-500 text-xs">
                        HB × {rule.multiplier}
                      </td>
                      <td className="px-4 py-2 border border-gray-200">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {rule.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2 border border-gray-200 text-gray-500">
                        {rule.valid_from ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LaborRegimeConfigPage;
