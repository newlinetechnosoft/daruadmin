import type { LucideIcon } from 'lucide-react'

export function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  note?: string
  icon: LucideIcon
  tone?: 'default' | 'danger' | 'success'
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            tone === 'danger'
              ? 'bg-red-50 text-red-600'
              : tone === 'success'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-blue-50 text-blue-600'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div
        className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px] ${
          tone === 'danger' ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  )
}
