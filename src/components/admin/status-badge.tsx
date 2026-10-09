const TONES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
  packing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  out_for_delivery: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  returned: 'bg-orange-50 text-orange-700 ring-orange-200',
  refunded: 'bg-red-50 text-red-700 ring-red-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  cod_pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  initiated: 'bg-slate-100 text-slate-600 ring-slate-200',
  reconciled: 'bg-blue-50 text-blue-700 ring-blue-200',
  open: 'bg-amber-50 text-amber-700 ring-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  approved: 'bg-sky-50 text-sky-700 ring-sky-200',
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  busy: 'bg-amber-50 text-amber-700 ring-amber-200',
  offline: 'bg-slate-100 text-slate-500 ring-slate-200',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  hidden: 'bg-slate-100 text-slate-600 ring-slate-200',
  admin: 'bg-blue-50 text-blue-700 ring-blue-200',
  manager: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  rider: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  customer: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function StatusBadge({ value }: { value: string }) {
  const tone = TONES[value] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
  const label = value.replaceAll('_', ' ')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  )
}
