import { useState, useMemo } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import { deleteDealerFn } from '#/server/inventory/inventory.functions'
import { PageShell, PageHeader } from '#/components/shared/page-shell'
import { StatusIndicator } from '#/components/shared/status-indicator'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { ListView, ListToolbar, ListCard } from '#/components/shared/list-view'
import type {
  ListViewColumnDef,
  FilterRule,
  FilterableField,
  TableDensity,
} from '#/components/shared/list-view'
import { Button } from '#/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Badge } from '#/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Store,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  MessageCircle,
  MapPin,
  Download,
  Navigation,
} from 'lucide-react'
import { toast } from 'sonner'
import { getGoogleMapsUrl } from '#/lib/map-config'
import type { DealerDto } from '#/server/inventory/inventory.queries'

export function DealersList() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data, isFetching, refetch } = useSuspenseQuery(adminQueries.dealers())
  const { data: access } = useSuspenseQuery(adminQueries.access())

  const grants = access.authenticated ? access.grants : null
  const canCreate = can(grants, 'dealers', 'create')
  const canEdit = can(grants, 'dealers', 'edit')
  const canDelete = can(grants, 'dealers', 'delete')

  const dealersList = data.dealers as (DealerDto & Record<string, unknown>)[]

  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'inactive'>(
    'all',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [density, setDensity] = useState<TableDensity>('comfortable')

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<DealerDto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter fields config
  const filterableFields: FilterableField[] = [
    { id: 'city', label: 'City', type: 'string' },
    { id: 'pan', label: 'PAN/VAT', type: 'string' },
    {
      id: 'vatBill',
      label: 'Provides VAT Bill',
      type: 'select',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    },
  ]

  // Filtered dataset
  const filteredDealers = useMemo(() => {
    return dealersList.filter((d) => {
      // Status Tab
      if (statusTab === 'active' && !d.isActive) return false
      if (statusTab === 'inactive' && d.isActive) return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          d.name.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q) ||
          (d.pan && d.pan.toLowerCase().includes(q)) ||
          d.contact.includes(q)
        if (!matches) return false
      }

      // Dynamic Filter Rules
      for (const f of activeFilters) {
        if (
          f.field === 'city' &&
          !d.city.toLowerCase().includes(f.value.toLowerCase())
        ) {
          return false
        }
        if (
          f.field === 'pan' &&
          (!d.pan || !d.pan.toLowerCase().includes(f.value.toLowerCase()))
        ) {
          return false
        }
        if (f.field === 'vatBill') {
          if (f.value === 'yes' && !d.providesVatBill) return false
          if (f.value === 'no' && d.providesVatBill) return false
        }
      }

      return true
    })
  }, [dealersList, statusTab, searchQuery, activeFilters])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteDealerFn({ data: { id: deleteTarget.id } })
      toast.success(`Dealer "${deleteTarget.name}" deleted`)
      queryClient.invalidateQueries({
        queryKey: adminQueries.dealers().queryKey,
      })
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete dealer'
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportCSV = () => {
    const headers =
      'DealerName,City,PAN_VAT,Contact,TotalAssignedItems,FulfilmentRatePercent,AvgPrepTimeMin\n'
    const rows = filteredDealers
      .map(
        (d) =>
          `"${d.name}","${d.city}","${d.pan || ''}","${d.contact}",${d.assignedItemCount},${
            d.performance?.fulfilmentRatePercent ?? 100
          },${d.performance?.avgPrepTimeMinutes ?? 15}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `dealers_export_${new Date().toISOString().split('T')[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Dealer directory exported to CSV')
  }

  const columns = useMemo<
    ListViewColumnDef<DealerDto & Record<string, unknown>>[]
  >(() => {
    return [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Dealer Hub',
        meta: { priority: 1 },
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                <Store className="size-3.5" />
              </div>
              <div className="min-w-0">
                <Link
                  to="/admin/dealers/$id"
                  params={{ id: d.id }}
                  className="font-semibold text-xs text-foreground hover:underline"
                >
                  {d.name}
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="size-2.5 shrink-0" />
                  <span className="truncate">{d.city}</span>
                  {d.lat == null || d.lng == null ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-xs px-1.5 py-0 h-4 font-normal shrink-0"
                    >
                      No location
                    </Badge>
                  ) : (
                    <a
                      href={getGoogleMapsUrl({
                        lat: d.lat,
                        lng: d.lng,
                        address: d.address,
                        city: d.city,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 font-sans shrink-0"
                      title="View pinned coordinates on map"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Navigation className="size-2.5" />
                      Map
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'pan',
        accessorKey: 'pan',
        header: 'PAN / VAT',
        meta: { priority: 2 },
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex flex-col text-xs font-mono">
              <span className="text-foreground">{d.pan || '—'}</span>
              {d.providesVatBill && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-sans">
                  VAT Registered
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'contact',
        accessorKey: 'contact',
        header: 'Contact',
        meta: { priority: 2 },
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground">
                {d.contact}
              </span>
              {d.whatsappNumber && (
                <a
                  href={`https://wa.me/977${d.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:text-emerald-700"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="size-3.5" />
                </a>
              )}
            </div>
          )
        },
      },
      {
        id: 'assignedItemCount',
        accessorKey: 'assignedItemCount',
        header: 'Sourced Items',
        meta: { priority: 2, align: 'center' },
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs tabular-nums">
            {row.original.assignedItemCount} items
          </Badge>
        ),
      },
      {
        id: 'fulfilmentRate',
        header: 'Fulfilment SLA',
        meta: { priority: 2, align: 'center' },
        cell: ({ row }) => {
          const rate = row.original.performance?.fulfilmentRatePercent ?? 100
          return (
            <div className="flex items-center justify-center gap-1 font-mono text-xs">
              <span
                className={
                  rate >= 90
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : rate >= 75
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : 'text-rose-600 dark:text-rose-400 font-medium'
                }
              >
                {rate}%
              </span>
            </div>
          )
        },
      },
      {
        id: 'status',
        accessorKey: 'isActive',
        header: 'Status',
        meta: { priority: 1 },
        cell: ({ row }) => (
          <StatusIndicator
            status={row.original.isActive ? 'active' : 'inactive'}
            asBadge
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { priority: 1, align: 'right' },
        cell: ({ row }) => {
          const d = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label={`Actions for ${d.name}`}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onSelect={() =>
                    navigate({ to: '/admin/dealers/$id', params: { id: d.id } })
                  }
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Edit2 className="size-3.5" />
                  <span>{canEdit ? 'View / Edit' : 'View Details'}</span>
                </DropdownMenuItem>

                {d.whatsappNumber && (
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        `https://wa.me/977${d.whatsappNumber!.replace(/\D/g, '')}`,
                        '_blank',
                      )
                    }
                    className="text-xs gap-2 cursor-pointer"
                  >
                    <MessageCircle className="size-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </DropdownMenuItem>
                )}

                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteTarget(d)}
                      className="text-xs gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete Dealer</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ]
  }, [canDelete, navigate])

  const totalCount = dealersList.length
  const activeCount = dealersList.filter((d) => d.isActive).length
  const inactiveCount = totalCount - activeCount

  return (
    <PageShell>
      <PageHeader
        kicker="Sourcing Logistics"
        title="Dealers"
        description="Partner dealer hubs in Butwal for zero-inventory on-demand catalog sourcing."
        count={filteredDealers.length}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>

            {canCreate && (
              <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
                <Link to="/admin/dealers/new">
                  <Plus className="size-3.5" />
                  New Dealer
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search dealers by name, city, PAN, phone..."
        filterableFields={filterableFields}
        activeFilters={activeFilters}
        onAddFilter={(filter) => setActiveFilters([...activeFilters, filter])}
        onRemoveFilter={(idx) =>
          setActiveFilters(activeFilters.filter((_, i) => i !== idx))
        }
        onClearFilters={() => setActiveFilters([])}
        density={density}
        onDensityChange={setDensity}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        refreshQueryKeys={[adminQueries.dealers().queryKey]}
        quickFilterTabs={
          <Tabs
            value={statusTab}
            onValueChange={(val) => setStatusTab(val as typeof statusTab)}
            className="w-full"
          >
            <TabsList className="h-8 p-0.5 bg-muted/60">
              <TabsTrigger
                value="all"
                className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
              >
                <span>All Dealers</span>
                <span className="font-mono text-xs text-muted-foreground ml-1">
                  ({totalCount})
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
              >
                <span>Active Hubs</span>
                <span className="font-mono text-xs text-muted-foreground ml-1">
                  ({activeCount})
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="inactive"
                className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
              >
                <span>Inactive</span>
                <span className="font-mono text-xs text-muted-foreground ml-1">
                  ({inactiveCount})
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <ListView<DealerDto & Record<string, unknown>>
        data={filteredDealers}
        columns={columns}
        density={density}
        isRefreshing={isFetching}
        emptyMessage="No partner dealers found."
        emptyAction={
          canCreate && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
            >
              <Link to="/admin/dealers/new">
                <Plus className="size-3" />
                Register first dealer
              </Link>
            </Button>
          )
        }
        renderCard={(dealer) => (
          <ListCard
            title={
              <div className="flex items-center gap-2">
                <Store className="size-4 text-muted-foreground" />
                <span className="font-semibold text-xs">{dealer.name}</span>
              </div>
            }
            subtitle={`${dealer.address}, ${dealer.city}`}
            status={
              <StatusIndicator
                status={dealer.isActive ? 'active' : 'inactive'}
                asBadge
              />
            }
            details={[
              { label: 'PAN/VAT', value: dealer.pan || 'None' },
              { label: 'Phone', value: dealer.contact },
              {
                label: 'Sourced Items',
                value: `${dealer.assignedItemCount} items`,
              },
              {
                label: 'Fulfilment SLA',
                value: `${dealer.performance?.fulfilmentRatePercent ?? 100}%`,
              },
            ]}
            actions={
              <div className="flex items-center gap-1.5">
                {dealer.whatsappNumber && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-emerald-600 gap-1"
                    onClick={() =>
                      window.open(
                        `https://wa.me/977${dealer.whatsappNumber!.replace(/\D/g, '')}`,
                        '_blank',
                      )
                    }
                  >
                    <MessageCircle className="size-3" /> WhatsApp
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                >
                  <Link to="/admin/dealers/$id" params={{ id: dealer.id }}>
                    <Edit2 className="size-3" /> View
                  </Link>
                </Button>
              </div>
            }
            onClick={() =>
              navigate({ to: '/admin/dealers/$id', params: { id: dealer.id } })
            }
          />
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete Dealer "${deleteTarget?.name}"?`}
        description="This will permanently delete the dealer. Pending settlements and past ledger entries remain preserved."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}
