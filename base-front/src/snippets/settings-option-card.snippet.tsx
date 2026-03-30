{/* Nueva tarjeta dentro de la grilla de Configuración */}
<button
  type="button"
  onClick={() => navigate('/configuracion/biometricos')}
  className="group rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-400/30 hover:bg-white/10"
>
  <div className="flex items-start gap-4">
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-300">
      <MapPin />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-slate-100">Biométricos / Ubicaciones</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Alias operativos por biométrico asociados al tenant desde Cerebro.
      </p>
    </div>
  </div>
</button>
