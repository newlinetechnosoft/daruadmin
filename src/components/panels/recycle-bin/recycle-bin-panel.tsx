import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  restoreRecycleBinItemFn,
  permanentDeleteRecycleBinItemFn,
  emptyRecycleBinFn,
} from '#/server/recycle-bin/recycle-bin.functions'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { DataRefreshButton } from '#/components/shared/data-refresh-button'
import { DataSection } from '#/components/shared/data-section'
import { DateText } from '#/components/shared/date-text'
import { MetricCard } from '#/components/shared/metric-card'
import { PageHeader, PageShell } from '#/components/shared/page-shell'
import { cn } from '#/lib/utils'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Award,
  Bike,
  CheckCircle2,
  Clock,
  Layers,
  Megaphone,
  Milk,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Tags,
  Trash2,
  Wine,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type EntityGroup =
  | 'products'
  | 'categories'
  | 'brands'
  | 'dealers'
  | 'marketing'
  | 'riders'
  | 'other'

type EntityMeta = {
  label: string
  group: EntityGroup
  icon: LucideIcon
}

const GROUP_OPTIONS = [
  { id: 'all', label: 'All items' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'brands', label: 'Brands' },
  { id: 'dealers', label: 'Dealers' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'riders', label: 'Riders' },
] as const

type GroupFilter = (typeof GROUP_OPTIONS)[number]['id']
type UrgencyFilter = 'all' | 'expiring' | 'safe'

const URGENCY_STYLES: Record<string, string> = {
  expired: 'border-destructive/30 bg-destructive/10 text-destructive',
  critical: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  safe: 'border-success/25 bg-success/10 text-success',
}

const CATALOG_LABELS: Record<string, string> = {
  liquor: 'Liquor',
  food: 'Food',
  grocery: 'Grocery',
  ddc: 'DDC',
}

function catalogLabel(entityType: string) {
  return CATALOG_LABELS[entityType.split('_')[0] ?? ''] ?? 'Catalog'
}

function getEntityMeta(entityType: string): EntityMeta {
  switch (entityType) {
    case 'liquor_product':
      return { label: 'Liquor product', group: 'products', icon: Wine }
    case 'food_product':
      return { label: 'Food product', group: 'products', icon: ShoppingBag }
    case 'grocery_product':
      return {
        label: 'Grocery product',
        group: 'products',
        icon: ShoppingBasket,
      }
    case 'ddc_product':
      return { label: 'DDC product', group: 'products', icon: Milk }
    case 'liquor_category':
    case 'food_category':
    case 'grocery_category':
    case 'ddc_category':
      return {
        label: `${catalogLabel(entityType)} category`,
        group: 'categories',
        icon: Tags,
      }
    case 'liquor_brand':
    case 'food_brand':
    case 'grocery_brand':
    case 'ddc_brand':
      return {
        label: `${catalogLabel(entityType)} brand`,
        group: 'brands',
        icon: Award,
      }
    case 'dealer':
      return { label: 'Dealer', group: 'dealers', icon: Store }
    case 'coupon':
      return { label: 'Coupon', group: 'marketing', icon: Megaphone }
    case 'banner':
      return { label: 'Banner', group: 'marketing', icon: Megaphone }
    case 'offer':
      return { label: 'Offer', group: 'marketing', icon: Megaphone }
    case 'rider':
      return { label: 'Rider', group: 'riders', icon: Bike }
    default:
      return { label: 'Data item', group: 'other', icon: Package }
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function RecycleBinPanel() {
  const queryClient = useQueryClient()
  const recycleBinQuery = adminQueries.recycleBin()
  const { data, isLoading, isRefetching, isFetching, refetch } =
    useQuery(recycleBinQuery)

  const [search, setSearch] = React.useState('')
  const [selectedGroup, setSelectedGroup] = React.useState<GroupFilter>('all')
  const [urgencyFilter, setUrgencyFilter] = React.useState<UrgencyFilter>('all')

  const [itemToDelete, setItemToDelete] = React.useState<{
    id: string
    name: string
  } | null>(null)
  const [showEmptyConfirm, setShowEmptyConfirm] = React.useState(false)

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreRecycleBinItemFn({ data: { id } }),
    onSuccess: (res) => {
      toast.success(`Restored "${res.name}" successfully`)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['store'] })
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, 'Failed to restore item'))
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) =>
      permanentDeleteRecycleBinItemFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Item permanently deleted')
      setItemToDelete(null)
      queryClient.invalidateQueries({ queryKey: recycleBinQuery.queryKey })
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, 'Failed to permanently delete item'))
    },
  })

  const emptyBinMutation = useMutation({
    mutationFn: () => emptyRecycleBinFn(),
    onSuccess: () => {
      toast.success('Recycle bin emptied')
      setShowEmptyConfirm(false)
      queryClient.invalidateQueries({ queryKey: recycleBinQuery.queryKey })
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, 'Failed to empty recycle bin'))
    },
  })

  const items = data?.items ?? []
  const stats = data?.stats ?? {
    total: 0,
    expiringSoon: 0,
    retentionDays: 15,
  }

  const groupCounts = React.useMemo(() => {
    const counts: Record<GroupFilter, number> = {
      all: items.length,
      products: 0,
      categories: 0,
      brands: 0,
      dealers: 0,
      marketing: 0,
      riders: 0,
    }

    for (const item of items) {
      const group = getEntityMeta(item.entityType).group
      if (group !== 'other') counts[group]++
    }

    return counts
  }, [items])

  const hasActiveFilters =
    search.trim() !== '' || selectedGroup !== 'all' || urgencyFilter !== 'all'

  const filteredItems = React.useMemo(() => {
    const query = search.trim().toLowerCase()

    return items.filter((item) => {
      const meta = getEntityMeta(item.entityType)

      if (selectedGroup !== 'all' && meta.group !== selectedGroup) return false
      if (urgencyFilter === 'expiring' && item.remainingDays > 7) return false
      if (urgencyFilter === 'safe' && item.remainingDays <= 7) return false

      if (!query) return true

      return (
        item.name.toLowerCase().includes(query) ||
        Boolean(item.description?.toLowerCase().includes(query)) ||
        meta.label.toLowerCase().includes(query) ||
        item.deletedBy.toLowerCase().includes(query)
      )
    })
  }, [items, selectedGroup, urgencyFilter, search])

  const resetFilters = () => {
    setSearch('')
    setSelectedGroup('all')
    setUrgencyFilter('all')
  }

  return (
    <PageShell>
      <PageHeader
        title="Recycle Bin"
        description="Restore deleted records within the retention period, or remove them permanently."
        count={items.length}
        actions={
          <>
            <DataRefreshButton
              queryKeys={[recycleBinQuery.queryKey]}
              onRefresh={() => refetch()}
              isRefreshing={isFetching || isRefetching}
              variant="icon"
            />

            {items.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowEmptyConfirm(true)}
                className="h-9 gap-2 px-3 text-xs"
              >
                <Trash2 className="size-4" />
                Empty bin
              </Button>
            )}
          </>
        }
      />

      <DataSection isRefreshing={isFetching || isRefetching}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Items in bin"
              value={stats.total.toLocaleString('en-IN')}
              note="Across catalog, dealers, marketing and riders"
              icon={Layers}
              tone="info"
            />
            <MetricCard
              label="Expiring soon"
              value={stats.expiringSoon.toLocaleString('en-IN')}
              note="3 days or fewer remaining"
              icon={AlertTriangle}
              tone={stats.expiringSoon > 0 ? 'danger' : 'success'}
            />
            <MetricCard
              label="Safe items"
              value={(stats.total - stats.expiringSoon).toLocaleString('en-IN')}
              note="More than 3 days remaining"
              icon={ShieldCheck}
              tone="success"
            />
            <MetricCard
              label="Retention"
              value={`${stats.retentionDays} days`}
              note="Automatic purge is enabled"
              icon={Clock}
              tone="neutral"
            />
          </div>

          {stats.expiringSoon > 0 && urgencyFilter !== 'expiring' && (
            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <span className="text-foreground">
                  <strong className="font-semibold">
                    {stats.expiringSoon}
                  </strong>{' '}
                  {stats.expiringSoon === 1 ? 'item' : 'items'} will be
                  permanently deleted within 3 days.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUrgencyFilter('expiring')}
                className="self-start text-[11px] font-medium text-warning hover:underline sm:self-auto"
              >
                Review expiring items
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-none">
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search items, type or user"
                  className="h-9 bg-background pl-8 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedGroup}
                  onValueChange={(value) =>
                    setSelectedGroup(value as GroupFilter)
                  }
                >
                  <SelectTrigger
                    aria-label="Filter by record type"
                    className="h-9 w-[150px] bg-background text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} ({groupCounts[option.id]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={urgencyFilter}
                  onValueChange={(value) =>
                    setUrgencyFilter(value as UrgencyFilter)
                  }
                >
                  <SelectTrigger
                    aria-label="Filter by expiry"
                    className="h-9 w-[150px] bg-background text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All expiry</SelectItem>
                    <SelectItem value="expiring">Expiring ≤ 7 days</SelectItem>
                    <SelectItem value="safe">Safe &gt; 7 days</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-9 px-2.5 text-xs"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="h-10 animate-pulse rounded-md bg-muted/50"
                  />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="mb-3 grid size-10 place-items-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                  {hasActiveFilters ? (
                    <Search className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4 text-success" />
                  )}
                </div>
                <h3 className="text-sm font-medium text-foreground">
                  {hasActiveFilters
                    ? 'No matching items'
                    : 'Recycle bin is empty'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? 'Adjust your search or filters to find deleted records.'
                    : `Deleted records will appear here and remain available for ${stats.retentionDays} days.`}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-3 h-8 px-2.5 text-xs"
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/70 hover:bg-transparent">
                        <TableHead className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                          Item
                        </TableHead>
                        <TableHead className="hidden px-4 py-2.5 text-[11px] font-medium text-muted-foreground md:table-cell">
                          Type
                        </TableHead>
                        <TableHead className="hidden px-4 py-2.5 text-[11px] font-medium text-muted-foreground lg:table-cell">
                          Deleted by
                        </TableHead>
                        <TableHead className="hidden px-4 py-2.5 text-[11px] font-medium text-muted-foreground sm:table-cell">
                          Deleted on
                        </TableHead>
                        <TableHead className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                          Expires
                        </TableHead>
                        <TableHead className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const meta = getEntityMeta(item.entityType)
                        const Icon = meta.icon
                        const isRestoring =
                          restoreMutation.isPending &&
                          restoreMutation.variables === item.id
                        const isDeleting =
                          permanentDeleteMutation.isPending &&
                          permanentDeleteMutation.variables === item.id
                        const isUrgent =
                          item.urgency === 'critical' ||
                          item.urgency === 'expired'

                        return (
                          <TableRow
                            key={item.id}
                            className="border-b border-border/50 last:border-b-0 hover:bg-muted/30"
                          >
                            <TableCell className="max-w-[320px] px-4 py-2.5">
                              <p
                                title={item.name}
                                className="truncate text-xs font-medium text-foreground"
                              >
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="hidden px-4 py-2.5 md:table-cell">
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Icon className="size-3.5 shrink-0" />
                                {meta.label}
                              </span>
                            </TableCell>
                            <TableCell className="hidden px-4 py-2.5 text-xs text-foreground lg:table-cell">
                              {item.deletedBy || 'System'}
                            </TableCell>
                            <TableCell className="hidden px-4 py-2.5 sm:table-cell">
                              <DateText
                                date={item.deletedAt}
                                showTime={false}
                                className="text-xs text-muted-foreground"
                              />
                            </TableCell>
                            <TableCell className="px-4 py-2.5">
                              <span
                                title={`Expires on ${new Date(item.expiresAt).toLocaleString()}`}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                                  URGENCY_STYLES[item.urgency] ??
                                    URGENCY_STYLES.safe,
                                )}
                              >
                                {isUrgent ? (
                                  <AlertTriangle className="size-3 shrink-0" />
                                ) : (
                                  <Clock className="size-3 shrink-0" />
                                )}
                                {item.remainingLabel}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    restoreMutation.mutate(item.id)
                                  }
                                  disabled={isRestoring || isDeleting}
                                  aria-label={
                                    isRestoring
                                      ? `Restoring ${item.name}`
                                      : `Restore ${item.name}`
                                  }
                                  title="Restore item"
                                  className="h-8 gap-1.5 px-2.5 text-xs"
                                >
                                  <RotateCcw
                                    className={cn(
                                      'size-3.5',
                                      isRestoring && 'animate-spin',
                                    )}
                                  />
                                  <span className="hidden sm:inline">
                                    {isRestoring ? 'Restoring' : 'Restore'}
                                  </span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setItemToDelete({
                                      id: item.id,
                                      name: item.name,
                                    })
                                  }
                                  disabled={isRestoring || isDeleting}
                                  aria-label={`Permanently delete ${item.name}`}
                                  title="Permanently delete"
                                  className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-[11px] text-muted-foreground">
                  <span>
                    Showing {filteredItems.length} of {items.length} items
                  </span>
                  <span>Auto-purge after {stats.retentionDays} days</span>
                </div>
              </>
            )}
          </div>
        </div>
      </DataSection>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Permanently delete item?"
        description={
          <div>
            Are you sure you want to permanently delete{' '}
            <strong className="text-foreground">{itemToDelete?.name}</strong>?
            <span className="mt-2 block font-medium text-destructive">
              This action cannot be undone. The record will be purged
              immediately.
            </span>
          </div>
        }
        confirmLabel="Delete permanently"
        tone="danger"
        icon={<AlertTriangle className="size-4 text-destructive" />}
        isLoading={permanentDeleteMutation.isPending}
        onConfirm={() => {
          if (itemToDelete) {
            permanentDeleteMutation.mutate(itemToDelete.id)
          }
        }}
        onClose={() => setItemToDelete(null)}
      />

      <ConfirmDialog
        open={showEmptyConfirm}
        title="Empty recycle bin?"
        description={
          <div>
            Are you sure you want to permanently remove all{' '}
            <strong className="text-foreground">{items.length} items</strong>{' '}
            from the recycle bin?
            <span className="mt-2 block font-medium text-destructive">
              All records will be erased immediately and cannot be recovered.
            </span>
          </div>
        }
        confirmLabel="Empty recycle bin"
        tone="danger"
        icon={<AlertTriangle className="size-4 text-destructive" />}
        isLoading={emptyBinMutation.isPending}
        onConfirm={() => emptyBinMutation.mutate()}
        onClose={() => setShowEmptyConfirm(false)}
      />
    </PageShell>
  )
}
