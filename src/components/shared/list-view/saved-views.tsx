import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { Bookmark, Check, Plus, Trash2 } from 'lucide-react'
import type { FilterRule, SavedView } from './types'

export interface SavedViewsProps {
  storageKey: string
  defaultViews?: SavedView[]
  currentFilters: FilterRule[]
  onSelectView: (view: SavedView) => void
  activeViewId?: string
}

export function SavedViews({
  storageKey,
  defaultViews = [],
  currentFilters,
  onSelectView,
  activeViewId,
}: SavedViewsProps) {
  const [customViews, setCustomViews] = React.useState<SavedView[]>([])

  // Load from local storage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`saved_views_${storageKey}`)
      if (raw) setCustomViews(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [storageKey])

  const allViews = [...defaultViews, ...customViews]

  const handleSaveCurrent = () => {
    const name = window.prompt('Name this view (e.g. "Unassigned High Value"):')
    if (!name || !name.trim()) return

    const newView: SavedView = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      filters: currentFilters,
    }

    const updated = [...customViews, newView]
    setCustomViews(updated)
    try {
      localStorage.setItem(`saved_views_${storageKey}`, JSON.stringify(updated))
    } catch {
      // ignore
    }
    onSelectView(newView)
  }

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customViews.filter((v) => v.id !== id)
    setCustomViews(updated)
    try {
      localStorage.setItem(`saved_views_${storageKey}`, JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  if (allViews.length === 0 && currentFilters.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Bookmark className="size-3.5" />
          <span className="hidden sm:inline">Views</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs">Saved Views</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {allViews.map((view) => (
          <DropdownMenuItem
            key={view.id}
            onSelect={() => onSelectView(view)}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              {activeViewId === view.id && (
                <Check className="size-3 text-primary shrink-0" />
              )}
              <span className="truncate">{view.name}</span>
            </div>

            {!view.isDefault && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => handleDeleteCustom(view.id, e)}
                className="size-5 hover:text-rose-500"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </DropdownMenuItem>
        ))}

        {currentFilters.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleSaveCurrent}
              className="text-xs text-primary font-medium cursor-pointer gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Save current view</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
