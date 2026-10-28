import * as React from 'react'
import { Card, CardContent } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { cn } from '#/lib/utils'

export interface ListCardProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  status?: React.ReactNode
  details?: { label: string; value: React.ReactNode }[]
  actions?: React.ReactNode
  onClick?: () => void
  selected?: boolean
  onSelectChange?: (selected: boolean) => void
  className?: string
}

export function ListCard({
  title,
  subtitle,
  status,
  details = [],
  actions,
  onClick,
  selected = false,
  onSelectChange,
  className,
}: ListCardProps) {
  return (
    <Card
      className={cn(
        'relative border border-border p-3 transition-colors hover:bg-muted/15',
        selected && 'border-primary/50 bg-primary/5',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-0 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            {onSelectChange && (
              <div
                className="pt-0.5"
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onSelectChange(!!checked)}
                  aria-label="Select row"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-xs text-foreground truncate">
                {title}
              </div>
              {subtitle && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {status && <div className="shrink-0">{status}</div>}
        </div>

        {details.length > 0 && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 border-t border-border/40 text-[11px]">
            {details.map((d, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">
                  {d.label}
                </span>
                <span className="font-medium text-foreground truncate">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {actions && (
          <div
            className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/30"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
