import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

const STATUS_MAP: Record<string, Tone> = {
  // Success
  delivered: 'success',
  paid: 'success',
  success: 'success',
  resolved: 'success',
  active: 'success',
  approved: 'success',
  available: 'success',
  published: 'success',

  // Warning
  pending: 'warning',
  cod_pending: 'warning',
  open: 'warning',
  busy: 'warning',

  // Destructive
  failed: 'destructive',
  cancelled: 'destructive',
  canceled: 'destructive',
  refunded: 'destructive',
  returned: 'destructive',
  suspended: 'destructive',

  // Info / In-progress
  confirmed: 'info',
  packing: 'info',
  assigned: 'info',
  out_for_delivery: 'info',
  in_progress: 'info',
  reconciled: 'info',

  // Neutral
  draft: 'neutral',
  initiated: 'neutral',
  offline: 'neutral',
  hidden: 'neutral',
  admin: 'neutral',
  manager: 'neutral',
  rider: 'neutral',
  customer: 'neutral',
}

const DOT_COLORS: Record<Tone, string> = {
  success: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  destructive: 'bg-red-500 dark:bg-red-400',
  info: 'bg-blue-500 dark:bg-blue-400',
  neutral: 'bg-neutral-400 dark:bg-neutral-500',
}

export function formatStatusLabel(val: string): string {
  if (!val) return ''
  const words = val.split('_')
  return words
    .map((w, i) => {
      if (w.toLowerCase() === 'cod') return 'COD'
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      return w.toLowerCase()
    })
    .join(' ')
}

export function StatusBadge({
  value,
  status,
  className,
}: {
  value?: string
  status?: string
  className?: string
}) {
  const raw = (value ?? status ?? '').toLowerCase()
  const tone: Tone = STATUS_MAP[raw] ?? 'neutral'
  const dotColor = DOT_COLORS[tone]
  const label = formatStatusLabel(raw)

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-normal text-foreground bg-background border-border/80',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', dotColor)} />
      <span>{label}</span>
    </Badge>
  )
}
