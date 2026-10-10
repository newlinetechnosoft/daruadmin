import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="grid size-10 place-items-center rounded-md border border-border bg-muted/60 text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
