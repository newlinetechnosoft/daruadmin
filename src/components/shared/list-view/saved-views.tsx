import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
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
  const [deleteViewTarget, setDeleteViewTarget] =
    React.useState<SavedView | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false)
  const [newViewName, setNewViewName] = React.useState('')

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

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newViewName.trim()) return

    const newView: SavedView = {
      id: `custom_${Date.now()}`,
      name: newViewName.trim(),
      filters: currentFilters,
    }

    const updated = [...customViews, newView]
    setCustomViews(updated)
    try {
      localStorage.setItem(`saved_views_${storageKey}`, JSON.stringify(updated))
    } catch {
      // ignore
    }
    setSaveDialogOpen(false)
    setNewViewName('')
    onSelectView(newView)
  }

  const handleConfirmDelete = () => {
    if (!deleteViewTarget) return
    const updated = customViews.filter((v) => v.id !== deleteViewTarget.id)
    setCustomViews(updated)
    try {
      localStorage.setItem(`saved_views_${storageKey}`, JSON.stringify(updated))
    } catch {
      // ignore
    }
    setDeleteViewTarget(null)
  }

  if (allViews.length === 0 && currentFilters.length === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Bookmark className="size-3.5" />
            <span>Views</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">Saved views</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {allViews.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onSelect={() => onSelectView(view)}
              className="text-xs flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                {activeViewId === view.id && (
                  <Check className="size-3 text-primary shrink-0" />
                )}
                <span className={activeViewId === view.id ? 'font-medium' : ''}>
                  {view.name}
                </span>
              </span>

              {!view.isDefault && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteViewTarget(view)
                  }}
                  className="size-5 hover:text-rose-500 cursor-pointer"
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
                onSelect={(e) => {
                  e.preventDefault()
                  setSaveDialogOpen(true)
                }}
                className="text-xs text-primary font-medium cursor-pointer gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Save current view</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save View Modal Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleConfirmSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                Save Current View
              </DialogTitle>
              <DialogDescription className="text-xs">
                Give this filtered search configuration a memorable name for quick access.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="view-name" className="text-xs font-medium">
                View Name
              </Label>
              <Input
                id="view-name"
                placeholder="e.g. Unassigned High Value"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                autoFocus
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newViewName.trim()}
              >
                Save View
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete View Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteViewTarget)}
        onOpenChange={(open) => !open && setDeleteViewTarget(null)}
        title={`Delete View "${deleteViewTarget?.name}"?`}
        description="Are you sure you want to delete this custom saved view? This cannot be undone."
        confirmLabel="Delete View"
        tone="destructive"
        icon={<Trash2 className="size-4 text-destructive" />}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
