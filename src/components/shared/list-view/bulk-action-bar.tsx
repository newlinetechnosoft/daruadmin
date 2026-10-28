import * as React from 'react'
import { Button } from '#/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '#/lib/utils'

export interface BulkActionBarAction {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'
  onClick: () => void
  disabled?: boolean
}

export interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  actions: BulkActionBarAction[]
  className?: string
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-lg transition-all animate-in fade-in slide-in-from-bottom-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 pr-2 border-r border-border text-xs font-medium text-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground font-mono">
          {selectedCount}
        </span>
        <span>Selected</span>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((act) => (
          <Button
            key={act.id}
            type="button"
            variant={act.variant || 'outline'}
            size="sm"
            onClick={act.onClick}
            disabled={act.disabled}
            className="h-7 text-xs gap-1.5"
          >
            {act.icon}
            <span>{act.label}</span>
          </Button>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClearSelection}
        className="size-6 text-muted-foreground hover:text-foreground ml-1"
        aria-label="Clear selection"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
