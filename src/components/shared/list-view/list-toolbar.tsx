import * as React from 'react'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import { Search, RotateCw, Rows3, Rows4 } from 'lucide-react'
import { FilterPopover } from './filter-popover'
import { FilterChips } from './filter-chips'
import { ColumnPicker } from './column-picker'
import { SavedViews } from './saved-views'
import type {
  FilterRule,
  FilterableField,
  SavedView,
  TableDensity,
} from './types'
import type { Table } from '@tanstack/react-table'

export interface ListToolbarProps<TData> {
  searchQuery: string
  onSearchChange: (query: string) => void
  searchPlaceholder?: string
  filterableFields?: FilterableField[]
  activeFilters: FilterRule[]
  onAddFilter?: (filter: FilterRule) => void
  onRemoveFilter?: (index: number) => void
  onClearFilters?: () => void
  table?: Table<TData>
  savedViewsStorageKey?: string
  defaultSavedViews?: SavedView[]
  onSelectSavedView?: (view: SavedView) => void
  activeViewId?: string
  density: TableDensity
  onDensityChange: (density: TableDensity) => void
  primaryAction?: React.ReactNode
  onRefresh?: () => void
  isRefreshing?: boolean
  quickFilterTabs?: React.ReactNode
}

export function ListToolbar<TData>({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterableFields = [],
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  table,
  savedViewsStorageKey,
  defaultSavedViews,
  onSelectSavedView,
  activeViewId,
  density,
  onDensityChange,
  primaryAction,
  onRefresh,
  isRefreshing = false,
  quickFilterTabs,
}: ListToolbarProps<TData>) {
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Keyboard shortcut '/' to focus search input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (e.key === '/' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="space-y-3">
      {/* Quick Filter Tabs (e.g. All, Confirmed, Assigned, Delivered) */}
      {quickFilterTabs && <div>{quickFilterTabs}</div>}

      {/* Main Action Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Search & Filter controls */}
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9 pr-9 text-xs sm:text-sm bg-card border-border shadow-xs"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center pointer-events-none">
              <Kbd className="text-xs px-1.5 py-0.5 font-mono">/</Kbd>
            </div>
          </div>

          {filterableFields.length > 0 && onAddFilter && (
            <FilterPopover
              fields={filterableFields}
              onAddFilter={onAddFilter}
              activeCount={activeFilters.length}
            />
          )}

          {savedViewsStorageKey && onSelectSavedView && (
            <SavedViews
              storageKey={savedViewsStorageKey}
              defaultViews={defaultSavedViews}
              currentFilters={activeFilters}
              onSelectView={onSelectSavedView}
              activeViewId={activeViewId}
            />
          )}

          {table && <ColumnPicker table={table} />}

          {/* Density toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              onDensityChange(
                density === 'comfortable' ? 'compact' : 'comfortable',
              )
            }
            className="size-9 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            aria-label={`Toggle table density (current: ${density})`}
            title={`Toggle density: ${density}`}
          >
            {density === 'compact' ? (
              <Rows4 className="size-3.5" />
            ) : (
              <Rows3 className="size-3.5" />
            )}
          </Button>

          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="size-9 text-muted-foreground hover:text-foreground"
              aria-label="Refresh list"
              title="Refresh"
            >
              <RotateCw
                className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>
          )}
        </div>

        {/* Right side: Primary Action */}
        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && onRemoveFilter && onClearFilters && (
        <FilterChips
          filters={activeFilters}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearFilters}
        />
      )}
    </div>
  )
}
