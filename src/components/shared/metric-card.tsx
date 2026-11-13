import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export type MetricTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export const metricToneStyles: Record<
  MetricTone,
  { card: string; icon: string; value: string; chip: string; dot: string }
> = {
  neutral: {
    card: 'border-t-border',
    icon: 'text-muted-foreground/70',
    value: 'text-foreground',
    chip: 'border-transparent text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  info: {
    card: 'border-t-info',
    icon: 'text-info',
    value: 'text-foreground',
    chip: 'border-info/25 bg-info/10 text-info',
    dot: 'bg-info',
  },
  success: {
    card: 'border-t-success',
    icon: 'text-success',
    value: 'text-success',
    chip: 'border-success/25 bg-success/10 text-success',
    dot: 'bg-success',
  },
  warning: {
    card: 'border-t-warning',
    icon: 'text-warning',
    value: 'text-foreground',
    chip: 'border-warning/25 bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  danger: {
    card: 'border-t-destructive',
    icon: 'text-destructive',
    value: 'text-destructive',
    chip: 'border-destructive/25 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
}

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = 'neutral',
  className,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  icon?: LucideIcon
  tone?: MetricTone
  className?: string
}) {
  const styles = metricToneStyles[tone]

  return (
    <Card
      className={cn(
        'gap-0 rounded-lg border-border border-t-[3px] py-0 shadow-none',
        styles.card,
        className,
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon && <Icon className={cn('size-4 shrink-0', styles.icon)} />}
        </div>
        <div
          className={cn(
            'mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl',
            styles.value,
          )}
        >
          {value}
        </div>
        {note && (
          <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
        )}
      </div>
    </Card>
  )
}
