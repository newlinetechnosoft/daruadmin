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
    <div className="space-y-2">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {kicker && (
            <p className="text-xs font-medium text-muted-foreground">
              {kicker}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {count !== undefined && (
              <Badge variant="outline" className="font-mono text-xs tabular-nums">
                {count}
              </Badge>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
