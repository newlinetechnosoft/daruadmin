import { useState, useMemo } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import { deleteDealerFn } from '#/server/inventory/inventory.functions'
import { PageHeader } from '#/components/shared/page-header'
import { EmptyState } from '#/components/shared/empty-state'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { KpiCard } from '#/components/shared/kpi-card'
import { DealerDialog } from './dealer-dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Store,
  Wine,
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Phone,
  MessageCircle,
  FileText,
  Copy,
  ExternalLink,
  MapPin,
  CheckCircle2,
  XCircle,
  Check,
  TrendingUp,
  BarChart3,
  Clock,
  Download,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { cn } from '#/lib/utils'
import { toast } from 'sonner'
import type { DealerDto } from '#/server/inventory/inventory.queries'

export function DealersPanel() {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(adminQueries.dealers())
  const { data: access } = useSuspenseQuery(adminQueries.access())

  const grants = access.authenticated ? access.grants : null
  const canCreate = can(grants, 'dealers', 'create')
  const canEdit = can(grants, 'dealers', 'edit')
  const canDelete = can(grants, 'dealers', 'delete')

  const dealersList = data.dealers
  const catalogItems = data.catalogItems

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all')
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>('all')
  const [copiedPanId, setCopiedPanId] = useState<string | null>(null)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDealer, setEditingDealer] = useState<DealerDto | null>(null)

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<DealerDto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isScorecardOpen, setIsScorecardOpen] = useState(false)

  // Overall Sourcing SLA / Fulfilment Rate
  const avgFulfilmentRate = useMemo(() => {
    if (dealersList.length === 0) return 100
    const total = dealersList.reduce(
      (sum, d) => sum + (d.performance?.fulfilmentRatePercent ?? 100),
      0,
    )
    return Math.round(total / dealersList.length)
  }, [dealersList])

  const handleExportDealerPerformanceCSV = () => {
    const headers =
      'DealerName,City,PAN_VAT,TotalAssignedItems,FulfilledItems,RejectedItems,FulfilmentRatePercent,AvgPrepTimeMin\n'
    const rows = dealersList
      .map(
        (d) =>
          `"${d.name}","${d.city}","${d.pan || 'N/A'}",${d.performance?.totalAssignedItems ?? 0},${d.performance?.fulfilledItems ?? 0},${d.performance?.rejectedItems ?? 0},"${d.performance?.fulfilmentRatePercent ?? 100}%",${d.performance?.avgPrepTimeMinutes ?? 15}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dealer-performance-sla-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Dealer performance SLA scorecard CSV downloaded')
  }

  // Copy PAN/VAT to clipboard
  const handleCopyPan = (dealerId: string, pan: string) => {
    navigator.clipboard.writeText(pan)
    setCopiedPanId(dealerId)
    toast.success(`PAN/VAT number ${pan} copied`)
    setTimeout(() => {
      setCopiedPanId(null)
    }, 2000)
  }

  // Clean phone number for WhatsApp wa.me link
  const getWhatsAppLink = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('977')) {
      return `https://wa.me/${digits}`
    }
    if (digits.length === 10) {
      return `https://wa.me/977${digits}`
    }
    return `https://wa.me/${digits}`
  }

  // Filtered dealers
  const filteredDealers = useMemo(() => {
    return dealersList.filter((d) => {
      // Status filter
      if (statusFilter === 'active' && !d.isActive) return false
      if (statusFilter === 'inactive' && d.isActive) return false

      // Item selection filter ("admin should be able to select dealers according to items")
      if (selectedItemFilter !== 'all') {
        const [filterType, filterProductId] = selectedItemFilter.split(':')
        const hasItem = d.assignedItems.some(
          (item) =>
            item.catalogType === filterType &&
            item.productId === filterProductId,
        )
        if (!hasItem) return false
      }

      // Search query filter
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const matchName = d.name.toLowerCase().includes(q)
      const matchPan = (d.pan || '').toLowerCase().includes(q)
      const matchContact = d.contact.toLowerCase().includes(q)
      const matchWhatsapp = (d.whatsappNumber || '').toLowerCase().includes(q)
      const matchAddress = d.address.toLowerCase().includes(q)
      const matchCity = d.city.toLowerCase().includes(q)
      const matchItem = d.assignedItems.some(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          (item.categoryName || '').toLowerCase().includes(q) ||
          (item.brandName || '').toLowerCase().includes(q),
      )

      return (
        matchName ||
        matchPan ||
        matchContact ||
        matchWhatsapp ||
        matchAddress ||
        matchCity ||
        matchItem
      )
    })
  }, [dealersList, searchQuery, statusFilter, selectedItemFilter])

  // Aggregate stats
  const totalDealers = dealersList.length
  const activeDealers = dealersList.filter((d) => d.isActive).length
  const liquorDealersCount = dealersList.filter((d) =>
    d.assignedItems.some((item) => item.catalogType === 'liquor'),
  ).length
  const groceryDealersCount = dealersList.filter((d) =>
    d.assignedItems.some((item) => item.catalogType === 'grocery'),
  ).length
  const totalItemAssignments = dealersList.reduce(
    (acc, d) => acc + (d.assignedItemCount || 0),
    0,
  )

  const handleOpenCreate = () => {
    setEditingDealer(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (dealer: DealerDto) => {
    setEditingDealer(dealer)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteDealerFn({
        data: { id: deleteTarget.id },
      })
      toast.success(`Dealer "${deleteTarget.name}" deleted successfully`)
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'dealers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'liquor'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete dealer')
    } finally {
      setIsDeleting(false)
    }
  }

  // Selected item name for filter pill
  const selectedItemLabel = useMemo(() => {
    if (selectedItemFilter === 'all') return null
    const [type, id] = selectedItemFilter.split(':')
    const found = catalogItems.find(
      (item) => item.id === id && item.catalogType === type,
    )
    return found ? found.name : 'Selected Item'
  }, [selectedItemFilter, catalogItems])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Dealer & Supplier Management"
        description="Maintain verified supplier directories, PAN/VAT tax numbers, contact and WhatsApp lines, and product supply mappings."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScorecardOpen(true)}
              className="text-xs h-9 flex items-center gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              SLA &amp; Performance
            </Button>
            {canCreate && (
              <Button
                onClick={handleOpenCreate}
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-2 text-xs h-9"
              >
                <Plus className="h-4 w-4" />
                Register Dealer
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <KpiCard
          label="Total Dealers"
          value={totalDealers}
          note="Registered in network"
          icon={Store}
        />
        <KpiCard
          label="Active Dealers"
          value={activeDealers}
          note="Ready for fulfillment"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Sourcing SLA"
          value={`${avgFulfilmentRate}%`}
          note="Network fulfilment rate"
          icon={TrendingUp}
        />
        <KpiCard
          label="Liquor Dealers"
          value={liquorDealersCount}
          note="Spirits, beers & wines"
          icon={Wine}
        />
        <KpiCard
          label="Grocery Dealers"
          value={groceryDealersCount}
          note="Snacks, mixers & goods"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Item Mappings"
          value={totalItemAssignments}
          note="Active item assignments"
          icon={Package}
        />
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Text Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dealers by name, PAN/VAT, phone, WhatsApp or location..."
              className="pl-9 h-10 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Item Selector Filter */}
          <div className="w-full sm:w-[260px]">
            <NativeSelect
              value={selectedItemFilter}
              onChange={(e) => setSelectedItemFilter(e.target.value)}
              className="h-10 text-xs w-full"
            >
              <NativeSelectOption value="all">
                Filter by Item (All Items)
              </NativeSelectOption>
              <optgroup label="Liquor Items">
                {catalogItems
                  .filter((item) => item.catalogType === 'liquor')
                  .map((item) => (
                    <NativeSelectOption
                      key={`liquor:${item.id}`}
                      value={`liquor:${item.id}`}
                    >
                      🍷 {item.name}{' '}
                      {item.brandName ? `(${item.brandName})` : ''}
                    </NativeSelectOption>
                  ))}
              </optgroup>
              <optgroup label="Grocery Items">
                {catalogItems
                  .filter((item) => item.catalogType === 'grocery')
                  .map((item) => (
                    <NativeSelectOption
                      key={`grocery:${item.id}`}
                      value={`grocery:${item.id}`}
                    >
                      🛍️ {item.name}{' '}
                      {item.brandName ? `(${item.brandName})` : ''}
                    </NativeSelectOption>
                  ))}
              </optgroup>
            </NativeSelect>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-[150px]">
            <NativeSelect
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="h-10 text-xs w-full"
            >
              <NativeSelectOption value="all">All Status</NativeSelectOption>
              <NativeSelectOption value="active">
                Active Only
              </NativeSelectOption>
              <NativeSelectOption value="inactive">
                Inactive Only
              </NativeSelectOption>
            </NativeSelect>
          </div>
        </div>

        {/* Clear Filters Button if any active */}
        {(selectedItemFilter !== 'all' ||
          statusFilter !== 'all' ||
          searchQuery) && (
          <div className="flex items-center gap-2">
            {selectedItemFilter !== 'all' && (
              <Badge
                variant="secondary"
                className="text-xs py-1 px-2.5 gap-1.5 flex items-center"
              >
                <span>Item: {selectedItemLabel}</span>
                <button
                  type="button"
                  onClick={() => setSelectedItemFilter('all')}
                  className="hover:text-destructive text-muted-foreground ml-0.5"
                >
                  ×
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setSelectedItemFilter('all')
              }}
              className="text-xs h-9 text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Dealers Data Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {filteredDealers.length === 0 ? (
          <EmptyState
            title="No Dealers Found"
            description={
              dealersList.length === 0
                ? 'No dealers registered yet. Click "Register Dealer" to add your first supplier with PAN/VAT and items.'
                : 'No dealers match your selected filters. Try searching for a different keyword or item.'
            }
            action={
              dealersList.length === 0 && canCreate ? (
                <Button
                  onClick={handleOpenCreate}
                  className="bg-amber-600 hover:bg-amber-700 text-white mt-2"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Register First Dealer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[240px]">
                  Dealer Name & Location
                </TableHead>
                <TableHead className="w-[140px]">PAN / VAT Number</TableHead>
                <TableHead className="w-[180px]">Contact & WhatsApp</TableHead>
                <TableHead>Assigned Items</TableHead>
                <TableHead className="w-[130px] text-center">Fulfilment &amp; SLA</TableHead>
                <TableHead className="w-[90px] text-center">Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDealers.map((dealer) => {
                const assigned = dealer.assignedItems
                const isCopied = copiedPanId === dealer.id
                const whatsappDigits = dealer.whatsappNumber || dealer.contact

                return (
                  <TableRow key={dealer.id} className="hover:bg-muted/20">
                    {/* Dealer Name & Address */}
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                          <Store className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                            <span className="truncate">{dealer.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {dealer.address}, {dealer.city}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* PAN or VAT Number */}
                    <TableCell>
                      {dealer.pan ? (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs font-medium tracking-wide bg-background py-0.5 px-2"
                          >
                            <FileText className="h-3 w-3 mr-1 text-muted-foreground" />
                            {dealer.pan}
                          </Badge>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyPan(dealer.id, dealer.pan!)
                            }
                            title="Copy PAN/VAT number"
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Not provided
                        </span>
                      )}
                    </TableCell>

                    {/* Contact & WhatsApp */}
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        {/* Phone */}
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a
                            href={`tel:${dealer.contact}`}
                            className="font-medium hover:underline text-foreground"
                          >
                            {dealer.contact}
                          </a>
                        </div>

                        {/* WhatsApp */}
                        {whatsappDigits ? (
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <a
                              href={getWhatsAppLink(whatsappDigits)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                              title="Chat on WhatsApp"
                            >
                              <span>
                                {dealer.whatsappNumber || dealer.contact}
                              </span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Assigned Catalog Items */}
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {assigned.length}{' '}
                            {assigned.length === 1 ? 'item' : 'items'} assigned
                          </span>
                        </div>
                        {assigned.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            No items assigned yet
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {assigned.slice(0, 3).map((item) => (
                              <Badge
                                key={`${item.catalogType}:${item.productId}`}
                                variant="secondary"
                                className="text-[11px] font-normal py-0.5 px-2 flex items-center gap-1"
                              >
                                {item.catalogType === 'liquor' ? (
                                  <Wine className="h-3 w-3 text-amber-600 shrink-0" />
                                ) : (
                                  <ShoppingBag className="h-3 w-3 text-emerald-600 shrink-0" />
                                )}
                                <span className="truncate max-w-[140px]">
                                  {item.productName}
                                </span>
                              </Badge>
                            ))}
                            {assigned.length > 3 && (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-medium py-0.5 px-1.5 cursor-pointer hover:bg-muted"
                                onClick={() => handleOpenEdit(dealer)}
                                title="Click to view and edit all assigned items"
                              >
                                +{assigned.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Sourcing SLA & Performance */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-mono font-semibold px-1.5 py-0',
                            (dealer.performance?.fulfilmentRatePercent ?? 100) >= 90
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : (dealer.performance?.fulfilmentRatePercent ?? 100) >= 75
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : 'bg-destructive/10 text-destructive border-destructive/30',
                          )}
                        >
                          {dealer.performance?.fulfilmentRatePercent ?? 100}% SLA
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {dealer.performance?.avgPrepTimeMinutes ?? 15}m prep
                        </span>
                        {(dealer.performance?.rejectedItems ?? 0) > 0 && (
                          <span className="text-[9px] text-destructive font-medium">
                            {dealer.performance?.rejectedItems} rejected
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      {dealer.isActive ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs gap-1 font-medium"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-muted text-muted-foreground border-border text-xs gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(dealer)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Edit Dealer Profile & Items"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(dealer)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete Dealer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dealer Dialog for Create/Edit */}
      <DealerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dealer={editingDealer}
        availableCatalogItems={catalogItems}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Dealer Record"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All assigned item associations and supply records for this dealer will be permanently removed.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Dealer'}
        tone="destructive"
        onConfirm={handleDelete}
      />

      {/* Dealer Performance & SLA Scorecard Modal */}
      <Dialog open={isScorecardOpen} onOpenChange={setIsScorecardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Dealer Sourcing SLA &amp; Performance Scorecard
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Item-level fulfilment rate, prep duration, and out-of-stock rejection tracking across Butwal suppliers.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportDealerPerformanceCSV}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </DialogHeader>

          <div className="p-4 overflow-y-auto space-y-4">
            {/* Quick KPI Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  Network Fulfilment SLA:
                </span>
                <span className="text-sm font-bold font-mono text-emerald-600">
                  {avgFulfilmentRate}%
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  Avg Preparation Time:
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  15 mins
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  Total Sourcing Assignments:
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {dealersList.reduce(
                    (sum, d) => sum + (d.performance?.totalAssignedItems ?? 0),
                    0,
                  )}{' '}
                  items
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  Unavailable / Rejected:
                </span>
                <span className="text-sm font-bold font-mono text-destructive">
                  {dealersList.reduce(
                    (sum, d) => sum + (d.performance?.rejectedItems ?? 0),
                    0,
                  )}{' '}
                  rejections
                </span>
              </div>
            </div>

            {/* Scorecard Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs">Dealer Name</TableHead>
                    <TableHead className="text-xs">Location / City</TableHead>
                    <TableHead className="text-right text-xs">Total Assigned</TableHead>
                    <TableHead className="text-right text-xs">Fulfilled</TableHead>
                    <TableHead className="text-right text-xs">Rejected</TableHead>
                    <TableHead className="text-right text-xs">Fulfilment Rate</TableHead>
                    <TableHead className="text-right text-xs">Avg Prep Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealersList.map((d) => {
                    const perf = d.performance
                    const rate = perf?.fulfilmentRatePercent ?? 100
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold text-xs text-foreground">
                          {d.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.city}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {perf?.totalAssignedItems ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 font-semibold">
                          {perf?.fulfilledItems ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-destructive">
                          {perf?.rejectedItems ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-mono font-semibold',
                              rate >= 90
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                : rate >= 75
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-destructive/10 text-destructive border-destructive/30',
                            )}
                          >
                            {rate}% SLA
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {perf?.avgPrepTimeMinutes ?? 15} mins
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
