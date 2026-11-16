import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/utils'

interface SectionHeaderProps {
  title: string
  icon?: LucideIcon
  badge?: ReactNode
  description?: string
  actions?: ReactNode
  className?: string
}

export function SectionHeader({
  title,
  icon: Icon,
  badge,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60',
        className,
      )}
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4.5 w-4.5 text-primary shrink-0" />}
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
