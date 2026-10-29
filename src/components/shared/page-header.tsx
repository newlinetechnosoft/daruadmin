import type { ReactNode } from 'react'
import { Badge } from '#/components/ui/badge'

export function PageHeader({
  kicker,
  title,
  description,
  count,
  breadcrumb,
  actions,
}: {
  kicker?: string
  title: string
  description?: string
  count?: number | string
  breadcrumb?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="space-y-2 border-b border-border/40 pb-5">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {kicker && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {kicker}
            </p>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {count !== undefined && (
              <Badge
                variant="outline"
                className="font-mono text-xs font-bold tabular-nums px-2 py-0.5 border-border bg-muted/40"
              >
                {count}
              </Badge>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-4xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
