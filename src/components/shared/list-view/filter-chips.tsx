import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { X } from 'lucide-react'
import type { FilterRule } from './types'

export interface FilterChipsProps {
  filters: FilterRule[]
  onRemoveFilter: (index: number) => void
  onClearAll: () => void
}

export function FilterChips({
  filters,
  onRemoveFilter,
  onClearAll,
}: FilterChipsProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {filters.map((f, i) => (
        <Badge
          key={`${f.field}-${f.operator}-${i}`}
          variant="secondary"
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-normal border border-border/80"
        >
          <span className="text-muted-foreground font-medium">
            {f.label || f.field}:
          </span>
          <span>{f.value}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemoveFilter(i)}
            className="size-3.5 ml-0.5 hover:bg-transparent text-muted-foreground hover:text-foreground"
            aria-label={`Remove filter ${f.label || f.field}`}
          >
            <X className="size-2.5" />
          </Button>
        </Badge>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Clear all
      </Button>
    </div>
  )
}
