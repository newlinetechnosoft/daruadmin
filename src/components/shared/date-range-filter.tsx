import { useState, useMemo } from 'react'
import type { DateRange } from 'react-day-picker'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  CalendarRange,
} from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'
import {
  type DateFilterPreset,
  type DateFilterValue,
  getDateRangeBounds,
  stepPeriod,
  isDateInRange,
  DATE_FILTER_PRESET_OPTIONS,
} from '#/lib/date-filter'

export function useDateFilter(initialPreset: DateFilterPreset = 'today') {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    preset: initialPreset,
  })

  const bounds = useMemo(
    () => getDateRangeBounds(dateFilter),
    [dateFilter],
  )

  const filterItems = useMemo(() => {
    return <T,>(
      items: T[],
      getDate: (item: T) => Date | string | number | null | undefined,
    ): T[] => {
      if (!bounds.isFiltered || (bounds.start === null && bounds.end === null)) {
        return items
      }
      return items.filter((item) =>
        isDateInRange(getDate(item), bounds.start, bounds.end),
      )
    }
  }, [bounds])

  const resetToToday = () => setDateFilter({ preset: 'today' })

  return {
    dateFilter,
    setDateFilter,
    bounds,
    filterItems,
    resetToToday,
  }
}

export interface DateRangeFilterProps {
  value: DateFilterValue
  onChange: (val: DateFilterValue) => void
  className?: string
  align?: 'start' | 'center' | 'end'
  size?: 'sm' | 'default'
  showDualDate?: boolean
  showSteppers?: boolean
  filteredCount?: number
  totalCount?: number
}

export function DateRangeFilter({
  value,
  onChange,
  className,
  align = 'start',
  size = 'default',
  showDualDate = true,
  showSteppers = true,
  filteredCount,
  totalCount,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => {
    if (value.preset === 'custom' && value.from) {
      return {
        from: new Date(value.from),
        to: value.to ? new Date(value.to) : new Date(value.from),
      }
    }
    return undefined
  })

  const bounds = useMemo(() => getDateRangeBounds(value), [value])

  const handleSelectPreset = (preset: DateFilterPreset) => {
    if (preset === 'custom') {
      const now = new Date()
      setSelectedRange({ from: now, to: now })
      return
    }
    onChange({ preset })
    setOpen(false)
  }

  const handleApplyCustomRange = () => {
    if (!selectedRange?.from) return
    const fromStr = format(selectedRange.from, 'yyyy-MM-dd')
    const toStr = selectedRange.to
      ? format(selectedRange.to, 'yyyy-MM-dd')
      : fromStr
    onChange({
      preset: 'custom',
      from: fromStr,
      to: toStr,
    })
    setOpen(false)
  }

  const handleStep = (direction: -1 | 1) => {
    const nextVal = stepPeriod(value, direction)
    onChange(nextVal)
  }

  const isToday = value.preset === 'today'

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {/* Frappe/ERPNext-style previous period stepper */}
      {showSteppers && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleStep(-1)}
          className={cn(
            'shrink-0 border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-2xs',
            size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
          )}
          title="Previous day / period"
          aria-label="Previous day / period"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Main Filter Popover Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'gap-2 border-border/80 bg-card hover:bg-accent/50 text-foreground font-medium cursor-pointer shadow-2xs transition-colors',
              size === 'sm' ? 'h-8 text-xs px-2.5' : 'h-9 text-xs sm:text-sm px-3',
              !isToday && 'border-primary/40 bg-primary/5 text-primary',
            )}
          >
            <CalendarIcon
              className={cn(
                'shrink-0 text-muted-foreground',
                size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
                !isToday && 'text-primary',
              )}
            />

            <span className="font-semibold">{bounds.label}:</span>
            <span className="text-muted-foreground truncate max-w-[170px] sm:max-w-none">
              {bounds.secondaryLabel}
            </span>

            {showDualDate && bounds.nepaliLabel && (
              <span className="hidden xl:inline-block text-[11px] text-muted-foreground/80 font-normal border-l border-border/80 pl-2 ml-1">
                {bounds.nepaliLabel}
              </span>
            )}

            {filteredCount !== undefined && totalCount !== undefined && (
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] font-mono px-1.5 py-0 h-4 rounded-sm"
              >
                {filteredCount}
                {filteredCount !== totalCount ? `/${totalCount}` : ''}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align={align}
          className="w-auto p-0 shadow-xl border-border bg-popover rounded-xl overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Presets Column */}
            <div className="p-3 w-full sm:w-48 flex flex-col gap-1 bg-muted/20">
              <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Date Presets
              </div>
              {DATE_FILTER_PRESET_OPTIONS.map((opt) => {
                const isActive = value.preset === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectPreset(opt.value)}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer',
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span>{opt.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                )
              })}

              {!isToday && (
                <div className="pt-2 mt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectPreset('today')}
                    className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-7 px-2 gap-1.5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to Today
                  </Button>
                </div>
              )}
            </div>

            {/* Calendar Range Picker */}
            <div className="p-3 flex flex-col">
              <div className="px-3 pt-1 pb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5 text-primary" />
                  Custom Date Range
                </span>
                {selectedRange?.from && (
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {format(selectedRange.from, 'd MMM yyyy')}
                    {selectedRange.to &&
                      !isSameDay(selectedRange.from, selectedRange.to) &&
                      ` – ${format(selectedRange.to, 'd MMM yyyy')}`}
                  </span>
                )}
              </div>

              <Calendar
                mode="range"
                selected={selectedRange}
                onSelect={setSelectedRange}
                numberOfMonths={1}
                className="rounded-lg border border-border/50 bg-background/50"
              />

              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedRange?.from}
                  onClick={handleApplyCustomRange}
                  className="h-8 text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  Apply Range
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Frappe/ERPNext-style next period stepper */}
      {showSteppers && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleStep(1)}
          disabled={isToday}
          className={cn(
            'shrink-0 border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-2xs',
            size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
          )}
          title="Next day / period"
          aria-label="Next day / period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Quick Reset Button if not Today */}
      {!isToday && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ preset: 'today' })}
          className={cn(
            'px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer hidden md:inline-flex items-center gap-1',
            size === 'sm' ? 'h-8' : 'h-9',
          )}
          title="Reset filter to Today"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset to Today</span>
        </Button>
      )}
    </div>
  )
}
