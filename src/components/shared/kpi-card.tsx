import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export function KpiCard({
  label,
  value,
  note,
  delta,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: string | number
  note?: string
  delta?: string
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  return (
    <Card className={cn('rounded-lg border border-border bg-card p-4 sm:p-5 shadow-none', className)}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {label}
          </p>
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {(note || delta) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {delta && (
              <span
                className={cn(
                  'font-medium',
                  tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
                  tone === 'warning' && 'text-amber-600 dark:text-amber-400',
                  tone === 'danger' && 'text-red-600 dark:text-red-400',
                )}
              >
                {delta}
              </span>
            )}
            {note && <span>{note}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
