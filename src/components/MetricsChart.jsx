import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function MetricsChart({ devices }) {
  // Procesar datos en tiempo real
  const authorized = devices.filter(d => d.status === 'authorized').length;
  const pending = devices.filter(d => d.status === 'pending').length;
  const revoked = devices.filter(d => d.status === 'revoked').length;

  const data = [
    { name: 'Activos', cantidad: authorized, color: '#10b981' }, // Verde
    { name: 'Pendientes', cantidad: pending, color: '#f59e0b' }, // Naranja
    { name: 'Revocados', cantidad: revoked, color: '#ef4444' }, // Rojo
  ];

  if (devices.length === 0) return <div className="p-4 text-center text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed">Sin datos para gráficos</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 transition-all hover:shadow-md">
      <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">📊 Estado del Parque</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
            <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} barSize={50}>
              {data.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}