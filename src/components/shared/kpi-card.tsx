import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: string | number
  delta?: string
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-border/80 hover:shadow-sm',
        className,
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {Icon && (
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
