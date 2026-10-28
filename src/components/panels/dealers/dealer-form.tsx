import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import {
  upsertDealerFn,
  deleteDealerFn,
} from '#/server/inventory/inventory.functions'
import { upsertDealerSchema } from '#/server/inventory/inventory.schemas'
import type { UpsertDealerInput } from '#/server/inventory/inventory.schemas'
import { FormView } from '#/components/shared/form-view'
import { FormSection } from '#/components/shared/form-view/form-section'
import { FormGrid } from '#/components/shared/form-view/form-grid'
import { ActivityTimeline } from '#/components/shared/form-view/activity-timeline'
import { RelatedRecords } from '#/components/shared/form-view/related-records'
import { ChildTable } from '#/components/shared/child-table'
import type { ChildTableColumn } from '#/components/shared/child-table'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { Checkbox } from '#/components/ui/checkbox'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { TrendingUp, Search, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { toPaisa, fromPaisa } from '#/lib/money'
import type { CatalogItemSummary } from '#/server/inventory/inventory.queries'

export interface SourcingItemRow extends Record<string, unknown> {
  productId: string
  productName: string
  catalogType: 'liquor' | 'grocery'
  categoryName?: string | null
  brandName?: string | null
  costPriceNpr: number
  isAvailable: boolean
}

export interface DealerFormProps {
  dealerId?: string // If undefined, mode is 'new'
}

export function DealerForm({ dealerId }: DealerFormProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: dealersData } = useSuspenseQuery(adminQueries.dealers())
  const { data: access } = useSuspenseQuery(adminQueries.access())

  const grants = access.authenticated ? access.grants : null
  const canEdit = can(grants, 'dealers', 'edit')
  const canDelete = can(grants, 'dealers', 'delete')

  const existingDealer = useMemo(() => {
    if (!dealerId) return null
    return dealersData.dealers.find((d) => d.id === dealerId) ?? null
  }, [dealerId, dealersData.dealers])

  const catalogItems = dealersData.catalogItems

  // Items table state
  const [items, setItems] = useState<SourcingItemRow[]>([])
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [itemCatalogFilter, setItemCatalogFilter] = useState<
    'all' | 'liquor' | 'grocery'
  >('all')

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<UpsertDealerInput>({
    resolver: zodResolver(upsertDealerSchema) as never,
    defaultValues: {
      name: '',
      pan: '',
      vatNumber: '',
      providesVatBill: false,
      tdsRate: '0',
      creditLimit: 0,
      paymentTermsDays: 0,
      openingBalance: 0,
      contact: '',
      whatsappNumber: '',
      address: '',
      city: 'Butwal',
      isActive: true,
      assignedItems: [],
    },
  })

  // Initialize or reset form values
  useEffect(() => {
    if (existingDealer) {
      form.reset({
        id: existingDealer.id,
        name: existingDealer.name,
        pan: existingDealer.pan ?? '',
        vatNumber: existingDealer.vatNumber ?? '',
        providesVatBill: existingDealer.providesVatBill ?? false,
        tdsRate: existingDealer.tdsRate ?? '0',
        creditLimit: existingDealer.creditLimit ?? 0,
        paymentTermsDays: existingDealer.paymentTermsDays ?? 0,
        openingBalance: existingDealer.openingBalance ?? 0,
        contact: existingDealer.contact,
        whatsappNumber: existingDealer.whatsappNumber ?? '',
        address: existingDealer.address,
        city: existingDealer.city || 'Butwal',
        isActive: existingDealer.isActive,
      })

      const rows: SourcingItemRow[] = existingDealer.assignedItems.map(
        (ai) => ({
          productId: ai.productId,
          productName: ai.productName,
          catalogType: ai.catalogType,
          categoryName: ai.categoryName,
          brandName: ai.brandName,
          costPriceNpr: ai.costPrice ? fromPaisa(ai.costPrice) : 0,
          isAvailable: ai.isAvailable !== false,
        }),
      )
      setItems(rows)
    } else {
      form.reset({
        name: '',
        pan: '',
        vatNumber: '',
        providesVatBill: false,
        tdsRate: '0',
        creditLimit: 0,
        paymentTermsDays: 0,
        openingBalance: 0,
        contact: '',
        whatsappNumber: '',
        address: '',
        city: 'Butwal',
        isActive: true,
      })
      setItems([])
    }
  }, [existingDealer, form])

  // Catalog item lookup to add
  const availableToAdd = useMemo(() => {
    const existingIds = new Set(items.map((i) => i.productId))
    return catalogItems.filter((item) => {
      if (existingIds.has(item.id)) return false
      if (itemCatalogFilter !== 'all' && item.catalogType !== itemCatalogFilter)
        return false
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.toLowerCase()
        return (
          item.name.toLowerCase().includes(q) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
          (item.brandName && item.brandName.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [catalogItems, items, itemCatalogFilter, itemSearchQuery])

  const handleAddCatalogItem = (catItem: CatalogItemSummary) => {
    const newRow: SourcingItemRow = {
      productId: catItem.id,
      productName: catItem.name,
      catalogType: catItem.catalogType,
      categoryName: catItem.categoryName,
      brandName: catItem.brandName,
      costPriceNpr: 0,
      isAvailable: true,
    }
    setItems((prev) => [...prev, newRow])
    form.setValue('name', form.getValues('name'), { shouldDirty: true })
    toast.success(`Added ${catItem.name} to sourcing list`)
  }

  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
    form.setValue('name', form.getValues('name'), { shouldDirty: true })
  }

  const onSubmit = async (values: UpsertDealerInput) => {
    try {
      const payload: UpsertDealerInput = {
        ...values,
        id: dealerId || undefined,
        assignedItems: items.map((i) => ({
          catalogType: i.catalogType,
          productId: i.productId,
          costPrice: toPaisa(i.costPriceNpr),
          isAvailable: i.isAvailable,
        })),
      }

      const res = await upsertDealerFn({ data: payload })
      toast.success(
        dealerId
          ? `Dealer "${values.name}" updated successfully`
          : `Dealer "${values.name}" registered successfully`,
      )
      await queryClient.invalidateQueries({
        queryKey: adminQueries.dealers().queryKey,
      })

      if (!dealerId && res.id) {
        navigate({ to: '/admin/dealers/$id', params: { id: res.id } })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save dealer'
      toast.error(msg)
    }
  }

  const handleDeleteDealer = async () => {
    if (!dealerId) return
    setIsDeleting(true)
    try {
      await deleteDealerFn({ data: { id: dealerId } })
      toast.success('Dealer removed')
      await queryClient.invalidateQueries({
        queryKey: adminQueries.dealers().queryKey,
      })
      navigate({ to: '/admin/dealers' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete dealer'
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  // Child table columns for Sourcing Items & Cost Prices
  const itemColumns: ChildTableColumn<SourcingItemRow>[] = [
    {
      id: 'name',
      header: 'Catalog Item',
      renderCell: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-foreground truncate">
            {row.productName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {row.catalogType.toUpperCase()} · {row.categoryName || 'General'}
          </span>
        </div>
      ),
    },
    {
      id: 'costPrice',
      header: 'Cost Price (NPR)',
      width: '160px',
      renderCell: (row, _index, updateField) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-mono">Rs.</span>
          <Input
            type="number"
            min={0}
            step="any"
            value={row.costPriceNpr || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0
              updateField('costPriceNpr', val)
              form.setValue('name', form.getValues('name'), {
                shouldDirty: true,
              })
            }}
            placeholder="0"
            className="h-7 text-xs font-mono tabular-nums w-28"
          />
        </div>
      ),
    },
    {
      id: 'available',
      header: 'Available',
      width: '90px',
      align: 'center',
      renderCell: (row, _index, updateField) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.isAvailable}
            onCheckedChange={(checked) => {
              updateField('isAvailable', !!checked)
              form.setValue('name', form.getValues('name'), {
                shouldDirty: true,
              })
            }}
            aria-label="Item availability toggle"
          />
        </div>
      ),
    },
  ]

  // Right Rail: Performance telemetry, WhatsApp, Timeline
  const rightRail = existingDealer ? (
    <div className="space-y-6">
      {/* SLA Scorecard Card */}
      <Card className="border border-border/80 shadow-none bg-card">
        <CardHeader className="p-4 pb-2 border-b border-border/40">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5" />
            <span>Sourcing SLA Telemetry</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground">
              Fulfilment Rate
            </span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {existingDealer.performance?.fulfilmentRatePercent ?? 100}%
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground">
              Avg. Prep Time
            </span>
            <span className="text-xs font-mono font-medium">
              {existingDealer.performance?.avgPrepTimeMinutes ?? 15} mins
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Fulfilled vs Rejected
            </span>
            <span className="text-xs font-mono">
              <strong className="text-emerald-600">
                {existingDealer.performance?.fulfilledItems ?? 0}
              </strong>{' '}
              /{' '}
              <span className="text-rose-600">
                {existingDealer.performance?.rejectedItems ?? 0}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Related Records */}
      <RelatedRecords
        records={[
          {
            id: 'ledger',
            title: 'Dealer Ledger & Payables',
            type: 'Financial Account',
            href: '/admin/accounts?tab=dealer-ledger',
            badge: 'Ledger',
          },
          ...(existingDealer.whatsappNumber
            ? [
                {
                  id: 'whatsapp',
                  title: `WhatsApp (${existingDealer.whatsappNumber})`,
                  type: 'Direct Communication',
                  href: `https://wa.me/977${existingDealer.whatsappNumber.replace(/\D/g, '')}`,
                  badge: 'Direct Chat',
                },
              ]
            : []),
        ]}
      />

      {/* Activity Timeline */}
      <ActivityTimeline
        events={[
          {
            id: 'created',
            title: 'Dealer Hub Registered',
            timestamp: existingDealer.createdAt,
            description: `Registered at ${existingDealer.address}, ${existingDealer.city}`,
            tone: 'success',
          },
          {
            id: 'updated',
            title: 'Profile Updated',
            timestamp: existingDealer.updatedAt,
            description: 'Catalog items and credit configuration synced',
            tone: 'neutral',
          },
        ]}
      />
    </div>
  ) : null

  return (
    <FormView
      title={existingDealer ? existingDealer.name : 'New Dealer Hub'}
      subtitle={
        existingDealer
          ? `Partner Hub · ${existingDealer.city} · ${items.length} items configured`
          : 'Register a local retail partner for zero-inventory on-demand sourcing.'
      }
      breadcrumbs={[
        { label: 'Dealers', href: '/admin/dealers' },
        { label: existingDealer ? existingDealer.name : 'New Dealer' },
      ]}
      backHref="/admin/dealers"
      status={
        existingDealer
          ? existingDealer.isActive
            ? 'active'
            : 'inactive'
          : undefined
      }
      isDirty={form.formState.isDirty}
      isSubmitting={form.formState.isSubmitting}
      onSave={form.handleSubmit(onSubmit)}
      saveLabel={existingDealer ? 'Save Dealer' : 'Register Dealer'}
      onDelete={
        dealerId && canDelete ? () => setDeleteConfirmOpen(true) : undefined
      }
      deleteLabel="Delete Dealer"
      readOnly={dealerId ? !canEdit : false}
      rightRail={rightRail}
      workflowActions={
        existingDealer
          ? [
              {
                id: 'settle',
                label: 'Settle Balance',
                variant: 'outline',
                onClick: () =>
                  navigate({
                    to: '/admin/accounts',
                    search: { tab: 'dealer-ledger' },
                  }),
              },
            ]
          : []
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Basic Information */}
          <FormSection
            title="Hub Information"
            description="Contact and physical address of the retail partner in Butwal."
          >
            <FormGrid columns={2}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Dealer Hub Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Butwal Central Liquor Store"
                        className="h-8 text-xs"
                        autoFocus={!dealerId}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">City / Hub Zone *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Butwal"
                        className="h-8 text-xs"
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Primary Phone Contact *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. 9847000000"
                        className="h-8 text-xs font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      WhatsApp Dispatch Number
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="e.g. 9847000000"
                        className="h-8 text-xs font-mono"
                      />
                    </FormControl>
                    <FormDescription className="text-[10px]">
                      Used for automated order sourcing notifications
                    </FormDescription>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Full Street Address *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Traffic Chowk, Ward 6, Butwal"
                          className="h-8 text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-2 pt-1">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="dealer-active"
                        />
                      </FormControl>
                      <label
                        htmlFor="dealer-active"
                        className="text-xs font-medium text-foreground cursor-pointer"
                      >
                        Active sourcing hub (receives line-item order
                        dispatches)
                      </label>
                    </FormItem>
                  )}
                />
              </div>
            </FormGrid>
          </FormSection>

          {/* Section 2: Tax & Credit Settings */}
          <FormSection
            title="Tax, VAT & Financial Terms"
            description="Nepal VAT registration and double-entry ledger settlement parameters."
          >
            <FormGrid columns={2}>
              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">PAN / VAT Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="9-digit PAN"
                        className="h-8 text-xs font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tdsRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      TDS Withholding Rate (%)
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={String(field.value)}
                        onValueChange={(val) => field.onChange(val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">
                            0% (Exempt)
                          </SelectItem>
                          <SelectItem value="1.5" className="text-xs">
                            1.5% (Standard Goods TDS)
                          </SelectItem>
                          <SelectItem value="15" className="text-xs">
                            15% (Services / Contract)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Credit Limit (NPR)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ? fromPaisa(field.value) : ''}
                        onChange={(e) =>
                          field.onChange(
                            toPaisa(parseFloat(e.target.value) || 0),
                          )
                        }
                        placeholder="0"
                        className="h-8 text-xs font-mono"
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentTermsDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Payment Terms (Days)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10) || 0)
                        }
                        placeholder="0"
                        className="h-8 text-xs font-mono"
                      />
                    </FormControl>
                    <FormDescription className="text-[10px]">
                      Agreed settlement cycle (e.g. 7 days, 15 days)
                    </FormDescription>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-2 pt-1">
                <FormField
                  control={form.control}
                  name="providesVatBill"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="provides-vat"
                        />
                      </FormControl>
                      <label
                        htmlFor="provides-vat"
                        className="text-xs font-medium text-foreground cursor-pointer"
                      >
                        Provides official VAT Tax Invoice for wholesale
                        purchases
                      </label>
                    </FormItem>
                  )}
                />
              </div>
            </FormGrid>
          </FormSection>

          {/* Section 3: Sourcing Items ChildTable */}
          <FormSection
            title="Catalog Sourcing Items & Cost Prices"
            description="Products this dealer supplies and negotiated dealer cost prices (in NPR)."
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddItemOpen(true)}
                className="h-7 text-xs gap-1 border-dashed"
              >
                <Plus className="size-3" />
                Add Item
              </Button>
            }
          >
            <ChildTable<SourcingItemRow>
              columns={itemColumns}
              data={items}
              onRowChange={(idx, updated) => {
                setItems((prev) => {
                  const copy = [...prev]
                  copy[idx] = updated
                  return copy
                })
              }}
              onRowDelete={handleDeleteItem}
              emptyMessage="No catalog items configured for this dealer hub yet. Click 'Add Item' to link products."
            />
          </FormSection>
        </form>
      </Form>

      {/* Catalog Item Picker Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Add Sourcing Item
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a catalog product to supply through this dealer hub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="h-8 pl-7 text-xs"
                  autoFocus
                />
              </div>

              <Select
                value={itemCatalogFilter}
                onValueChange={(val) =>
                  setItemCatalogFilter(val as typeof itemCatalogFilter)
                }
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All
                  </SelectItem>
                  <SelectItem value="liquor" className="text-xs">
                    Liquor
                  </SelectItem>
                  <SelectItem value="grocery" className="text-xs">
                    Grocery
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-border/60 border rounded-md">
              {availableToAdd.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No matching products available to add.
                </div>
              ) : (
                availableToAdd.slice(0, 20).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 hover:bg-muted/30 transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-foreground truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.catalogType.toUpperCase()} ·{' '}
                        {p.categoryName || 'General'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddCatalogItem(p)}
                      className="h-6 px-2 text-xs text-primary"
                    >
                      <Plus className="size-3 mr-1" /> Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Dealer?"
        description="Are you sure you want to delete this dealer? Sourced order history and ledger balances will remain in the database."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={handleDeleteDealer}
      />
    </FormView>
  )
}
