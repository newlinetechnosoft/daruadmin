import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  restoreRecycleBinItemFn,
  permanentDeleteRecycleBinItemFn,
  emptyRecycleBinFn,
} from '#/server/recycle-bin/recycle-bin.functions'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { toast } from 'sonner'
import {
  Trash2,
  RotateCcw,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Wine,
  ShoppingBag,
  Tags,
  Store,
  Bike,
  Megaphone,
  Award,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react'


function getEntityMeta(entityType: string) {
  switch (entityType) {
    case 'liquor_product':
      return {
        label: 'Liquor Product',
        group: 'products',
        icon: Wine,
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      }
    case 'grocery_product':
      return {
        label: 'Grocery Product',
        group: 'products',
        icon: ShoppingBag,
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      }
    case 'liquor_category':
      return {
        label: 'Liquor Category',
        group: 'categories',
        icon: Tags,
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      }
    case 'grocery_category':
      return {
        label: 'Grocery Category',
        group: 'categories',
        icon: Tags,
        badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      }
    case 'liquor_brand':
    case 'grocery_brand':
      return {
        label: entityType === 'liquor_brand' ? 'Liquor Brand' : 'Grocery Brand',
        group: 'brands',
        icon: Award,
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      }
    case 'dealer':
      return {
        label: 'Dealer',
        group: 'dealers',
        icon: Store,
        badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      }
    case 'coupon':
    case 'banner':
    case 'offer':
      return {
        label: entityType === 'coupon' ? 'Coupon' : entityType === 'banner' ? 'Banner' : 'Offer',
        group: 'marketing',
        icon: Megaphone,
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      }
    case 'rider':
      return {
        label: 'Rider / Courier',
        group: 'riders',
        icon: Bike,
        badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      }
    default:
      return {
        label: 'Data Item',
        group: 'other',
        icon: Layers,
        badgeClass: 'bg-muted text-muted-foreground border-border',
      }
  }
}

export function RecycleBinPanel() {
  const queryClient = useQueryClient()
  const { data, isLoading, isRefetching, refetch } = useQuery(adminQueries.recycleBin())

  const [search, setSearch] = React.useState('')
  const [selectedGroup, setSelectedGroup] = React.useState<string>('all')
  const [urgencyFilter, setUrgencyFilter] = React.useState<string>('all')

  // Permanent Delete single item modal state
  const [itemToDelete, setItemToDelete] = React.useState<{
    id: string
    name: string
  } | null>(null)

  // Empty Bin modal state
  const [showEmptyConfirm, setShowEmptyConfirm] = React.useState(false)

  // Mutations
  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreRecycleBinItemFn({ data: { id } }),
    onSuccess: (res) => {
      toast.success(`Restored "${res.name}" successfully!`)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['store'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to restore item')
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => permanentDeleteRecycleBinItemFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Item permanently deleted')
      setItemToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'recycle-bin'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to permanently delete item')
    },
  })

  const emptyBinMutation = useMutation({
    mutationFn: () => emptyRecycleBinFn(),
    onSuccess: () => {
      toast.success('Recycle bin emptied successfully')
      setShowEmptyConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'recycle-bin'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to empty recycle bin')
    },
  })

  const items = data?.items ?? []
  const stats = data?.stats ?? { total: 0, expiringSoon: 0, retentionDays: 15 }

  // Group counts for filter pills
  const groupCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      products: 0,
      categories: 0,
      brands: 0,
      dealers: 0,
      marketing: 0,
      riders: 0,
    }
    for (const item of items) {
      const meta = getEntityMeta(item.entityType)
      if (counts[meta.group] !== undefined) {
        counts[meta.group]++
      }
    }
    return counts
  }, [items])

  // Filtered list
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const meta = getEntityMeta(item.entityType)
      if (selectedGroup !== 'all' && meta.group !== selectedGroup) return false

      if (urgencyFilter === 'expiring' && item.remainingDays > 3) return false
      if (urgencyFilter === 'safe' && item.remainingDays <= 7) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = item.name.toLowerCase().includes(q)
        const matchDesc = item.description?.toLowerCase().includes(q)
        const matchType = meta.label.toLowerCase().includes(q)
        const matchDeletedBy = item.deletedBy?.toLowerCase().includes(q)
        return matchName || matchDesc || matchType || matchDeletedBy
      }

      return true
    })
  }, [items, selectedGroup, urgencyFilter, search])

  return (
    <div className="space-y-6 w-full min-w-0 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                Recycle Bin
                {items.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs font-bold">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </Badge>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Deleted data is safely kept for 15 days before permanent purge. You can restore items at any time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {items.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowEmptyConfirm(true)}
              className="gap-2 cursor-pointer shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
              <span>Empty Bin</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">In Recycle Bin</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
              {stats.total}
            </span>
            <span className="text-xs text-muted-foreground">items</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Across catalog, dealers, marketing & riders</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring Soon</span>
            <AlertTriangle className={`h-4 w-4 ${stats.expiringSoon > 0 ? 'text-rose-500 animate-pulse' : 'text-muted-foreground'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black tabular-nums ${stats.expiringSoon > 0 ? 'text-rose-500' : 'text-foreground'}`}>
              {stats.expiringSoon}
            </span>
            <span className="text-xs text-muted-foreground">&le; 3 days left</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Will be permanently deleted shortly</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Retention Window</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
              15
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Safety buffer prior to permanent purge</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Auto-Purge</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-500 font-mono">
              ACTIVE
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Automated database housekeeping</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deleted items by name, code, or user..."
              className="pl-9 bg-card"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Urgency Filter Dropdown / Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
            <span className="text-muted-foreground mr-1 hidden sm:inline">Urgency:</span>
            <button
              onClick={() => setUrgencyFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                urgencyFilter === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setUrgencyFilter('expiring')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                urgencyFilter === 'expiring'
                  ? 'bg-rose-500 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              Expiring Soon
            </button>
            <button
              onClick={() => setUrgencyFilter('safe')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                urgencyFilter === 'safe'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              Safe (&gt;7d)
            </button>
          </div>
        </div>

        {/* Group Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'products', label: 'Products' },
            { id: 'categories', label: 'Categories' },
            { id: 'brands', label: 'Brands' },
            { id: 'dealers', label: 'Dealers' },
            { id: 'marketing', label: 'Marketing' },
            { id: 'riders', label: 'Riders' },
          ].map((tab) => {
            const count = groupCounts[tab.id] || 0
            const active = selectedGroup === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedGroup(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full tabular-nums ${
                    active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 w-full animate-pulse rounded-xl border border-border bg-card/60"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-16 px-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground mb-4">
            {search || selectedGroup !== 'all' || urgencyFilter !== 'all' ? (
              <Search className="h-6 w-6" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            )}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            {search || selectedGroup !== 'all' || urgencyFilter !== 'all'
              ? 'No matching deleted items found'
              : 'Recycle Bin is empty'}
          </h3>
          <p className="mt-1 max-w-md text-xs sm:text-sm text-muted-foreground">
            {search || selectedGroup !== 'all' || urgencyFilter !== 'all'
              ? 'Try modifying your search keywords or resetting filters.'
              : 'Items deleted from catalog, categories, dealers, marketing, and riders will appear here and be preserved for 15 days.'}
          </p>
          {(search || selectedGroup !== 'all' || urgencyFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('')
                setSelectedGroup('all')
                setUrgencyFilter('all')
              }}
              className="mt-4 cursor-pointer"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const meta = getEntityMeta(item.entityType)
            const Icon = meta.icon
            const isRestoring = restoreMutation.isPending && restoreMutation.variables === item.id
            const isDeleting =
              permanentDeleteMutation.isPending && permanentDeleteMutation.variables === item.id

            return (
              <div
                key={item.id}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-border/80 hover:shadow-md"
              >
                {/* Left: Icon & Details */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/80 border border-border text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base text-foreground truncate max-w-xs sm:max-w-md">
                        {item.name}
                      </h4>
                      <Badge variant="outline" className={`text-xs font-semibold border ${meta.badgeClass}`}>
                        {meta.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.description && (
                        <span className="font-mono text-muted-foreground/80 line-clamp-1">
                          {item.description}
                        </span>
                      )}
                      <span>•</span>
                      <span>Deleted by <strong className="text-foreground/80 font-medium">{item.deletedBy}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.deletedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Remaining Days Badge & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
                  {/* Countdown Badge */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-colors ${
                        item.urgency === 'critical'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse'
                          : item.urgency === 'warning'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}
                      title={`Expires on ${new Date(item.expiresAt).toLocaleString()}`}
                    >
                      {item.urgency === 'critical' ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{item.remainingLabel}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreMutation.mutate(item.id)}
                      disabled={isRestoring || isDeleting}
                      className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary cursor-pointer font-semibold shadow-xs"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                      <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItemToDelete({ id: item.id, name: item.name })}
                      disabled={isRestoring || isDeleting}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer p-2"
                      title="Permanently Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Dialog: Delete Single Item Permanently */}
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Permanently Delete Item?"
        description={
          <div>
            Are you sure you want to permanently delete{' '}
            <strong className="text-foreground">{itemToDelete?.name}</strong>?
            <br />
            <span className="text-rose-500 font-semibold mt-2 block">
              This action cannot be undone. It will be immediately purged from the database.
            </span>
          </div>
        }
        confirmLabel="Delete Permanently"
        danger={true}
        isLoading={permanentDeleteMutation.isPending}
        onConfirm={() => {
          if (itemToDelete) {
            permanentDeleteMutation.mutate(itemToDelete.id)
          }
        }}
        onClose={() => setItemToDelete(null)}
      />

      {/* Confirmation Dialog: Empty Whole Bin */}
      <ConfirmDialog
        open={showEmptyConfirm}
        title="Empty Entire Recycle Bin?"
        description={
          <div>
            Are you sure you want to permanently remove all{' '}
            <strong className="text-foreground">{items.length} deleted items</strong> from the Recycle Bin?
            <br />
            <span className="text-rose-500 font-semibold mt-2 block">
              All items will be permanently erased immediately and cannot be recovered.
            </span>
          </div>
        }
        confirmLabel="Empty Recycle Bin"
        danger={true}
        isLoading={emptyBinMutation.isPending}
        onConfirm={() => emptyBinMutation.mutate()}
        onClose={() => setShowEmptyConfirm(false)}
      />
    </div>
  )
}
