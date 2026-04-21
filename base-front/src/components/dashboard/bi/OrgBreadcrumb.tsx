import React from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'

type BreadcrumbSegment = {
  id: string
  label: string
}

type OrgBreadcrumbProps = {
  segments: BreadcrumbSegment[]
  rootLabel?: string
  onReset: () => void
  onSelect: (index: number) => void
}

function OrgBreadcrumbComponent({
  segments,
  rootLabel = 'Empresa / Tenant',
  onReset,
  onSelect,
}: OrgBreadcrumbProps) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Drill-down jerarquico</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-white/72">
            <button
              type="button"
              onClick={onReset}
              className={`rounded-full px-3 py-1.5 transition ${segments.length === 0 ? 'bg-white text-slate-950' : 'bg-white/6 hover:bg-white/10'}`}
            >
              {rootLabel}
            </button>

            {segments.map((segment, index) => (
              <React.Fragment key={segment.id}>
                <ChevronRight size={14} className="text-white/28" />
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className={`max-w-[16rem] truncate rounded-full px-3 py-1.5 transition ${
                    index === segments.length - 1
                      ? 'bg-cyan-400/18 text-cyan-100'
                      : 'bg-white/6 text-white/76 hover:bg-white/10'
                  }`}
                  title={segment.label}
                >
                  {segment.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/78 transition hover:bg-white/10"
        >
          <RotateCcw size={15} />
          Reiniciar
        </button>
      </div>
    </div>
  )
}

export const OrgBreadcrumb = React.memo(OrgBreadcrumbComponent)

export default OrgBreadcrumb
