import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
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
import { Checkbox } from '#/components/ui/checkbox'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Store,
  Phone,
  MessageCircle,
  FileText,
  MapPin,
  Building,
  Loader2,
  Wine,
  ShoppingBag,
  Search,
  CheckCircle2,
  X,
  Copy,
  Receipt,
  Percent,
  CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { toPaisa, fromPaisa } from '#/lib/money'
import { upsertDealerFn } from '#/server/inventory/inventory.functions'
import { adminQueries } from '#/queries/admin'
import type {
  DealerDto,
  CatalogItemSummary,
} from '#/server/inventory/inventory.queries'

export interface DealerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealer?: DealerDto | null
  availableCatalogItems?: CatalogItemSummary[]
  onSuccess?: (savedDealer: DealerDto) => void
}

export function DealerDialog({
  open,
  onOpenChange,
  dealer,
  availableCatalogItems,
  onSuccess,
}: DealerDialogProps) {
  const queryClient = useQueryClient()

  // Form states
  const [name, setName] = useState('')
  const [pan, setPan] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [providesVatBill, setProvidesVatBill] = useState(false)
  const [tdsRate, setTdsRate] = useState('0')
  const [creditLimitNpr, setCreditLimitNpr] = useState('0')
  const [paymentTermsDays, setPaymentTermsDays] = useState('0')
  const [contact, setContact] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Butwal')
  const [isActive, setIsActive] = useState(true)
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(
    new Set(),
  )

  // Item filter state inside dialog
  const [itemSearch, setItemSearch] = useState('')
  const [catalogTab, setCatalogTab] = useState<'all' | 'liquor' | 'grocery'>(
    'all',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If availableCatalogItems not supplied, fetch from query cache
  const { data: adminDealersData } = useQuery({
    ...adminQueries.dealers(),
    enabled: !availableCatalogItems && open,
  })

  const catalogItems = useMemo(() => {
    return availableCatalogItems || adminDealersData?.catalogItems || []
  }, [availableCatalogItems, adminDealersData])

  // Initialize or reset form whenever dealer or open changes
  useEffect(() => {
    if (open) {
      if (dealer) {
        setName(dealer.name || '')
        setPan(dealer.pan || '')
        setVatNumber(dealer.vatNumber || '')
        setProvidesVatBill(Boolean(dealer.providesVatBill))
        setTdsRate(String(dealer.tdsRate ?? '0'))
        setCreditLimitNpr(
          String(dealer.creditLimit ? fromPaisa(dealer.creditLimit) : 0),
        )
        setPaymentTermsDays(String(dealer.paymentTermsDays ?? 0))
        setContact(dealer.contact || '')
        setWhatsappNumber(dealer.whatsappNumber || '')
        setAddress(dealer.address || '')
        setCity(dealer.city || 'Butwal')
        setIsActive(dealer.isActive !== false)

        const initialKeys = new Set(
          dealer.assignedItems.map(
            (item) => `${item.catalogType}:${item.productId}`,
          ),
        )
        setSelectedItemKeys(initialKeys)
      } else {
        setName('')
        setPan('')
        setVatNumber('')
        setProvidesVatBill(false)
        setTdsRate('0')
        setCreditLimitNpr('0')
        setPaymentTermsDays('0')
        setContact('')
        setWhatsappNumber('')
        setAddress('')
        setCity('Butwal')
        setIsActive(true)
        setSelectedItemKeys(new Set())
      }
      setItemSearch('')
      setCatalogTab('all')
    }
  }, [open, dealer])

  // Quick copy contact into WhatsApp
  const handleCopyContactToWhatsapp = () => {
    if (!contact) {
      toast.error('Enter a contact number first')
      return
    }
    setWhatsappNumber(contact)
    toast.success('Copied contact number to WhatsApp number')
  }

  // Filtered catalog items
  const filteredCatalogItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    return catalogItems.filter((item) => {
      if (catalogTab !== 'all' && item.catalogType !== catalogTab) {
        return false
      }
      if (!q) return true
      const matchName = item.name.toLowerCase().includes(q)
      const matchCat = (item.categoryName || '').toLowerCase().includes(q)
      const matchBrand = (item.brandName || '').toLowerCase().includes(q)
      return matchName || matchCat || matchBrand
    })
  }, [catalogItems, catalogTab, itemSearch])

  // Selection helpers
  const toggleItem = (catalogType: 'liquor' | 'grocery', productId: string) => {
    const key = `${catalogType}:${productId}`
    setSelectedItemKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev)
      for (const item of filteredCatalogItems) {
        next.add(`${item.catalogType}:${item.id}`)
      }
      return next
    })
  }

  const clearAllSelected = () => {
    setSelectedItemKeys(new Set())
  }

  // Count breakdown
  const selectedCounts = useMemo(() => {
    let liquor = 0
    let grocery = 0
    selectedItemKeys.forEach((key) => {
      if (key.startsWith('liquor:')) liquor++
      else if (key.startsWith('grocery:')) grocery++
    })
    return { liquor, grocery, total: selectedItemKeys.size }
  }, [selectedItemKeys])

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Dealer name is required')
      return
    }
    if (!contact.trim()) {
      toast.error('Contact number is required')
      return
    }
    if (!address.trim()) {
      toast.error('Address is required')
      return
    }

    setIsSubmitting(true)

    try {
      const assignedItems = Array.from(selectedItemKeys).map((key) => {
        const [catalogType, productId] = key.split(':') as [
          'liquor' | 'grocery',
          string,
        ]
        return { catalogType, productId }
      })

      const res = await upsertDealerFn({
        data: {
          id: dealer?.id,
          name: name.trim(),
          pan: pan.trim() || null,
          vatNumber: vatNumber.trim() || null,
          providesVatBill,
          tdsRate: tdsRate.trim() || '0',
          creditLimit: toPaisa(Math.max(0, Number(creditLimitNpr) || 0)),
          paymentTermsDays: Math.max(0, parseInt(paymentTermsDays, 10) || 0),
          contact: contact.trim(),
          whatsappNumber: whatsappNumber.trim() || null,
          address: address.trim(),
          city: city.trim() || 'Butwal',
          isActive,
          assignedItems,
        },
      })

      toast.success(
        dealer
          ? `Dealer "${res.name}" updated successfully`
          : `Dealer "${res.name}" registered successfully`,
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'dealers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'liquor'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
      ])

      if (onSuccess) {
        onSuccess(res)
      }
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save dealer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {dealer ? 'Edit Dealer Profile' : 'Register New Dealer'}
              </DialogTitle>
              <DialogDescription>
                Configure dealer contact, PAN/VAT credentials, and assign
                supplied items.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 click-scroll">
            {/* Basic Info Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dealer-name" className="text-sm font-medium">
                  Dealer / Supplier Name{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dealer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Butwal Spirits & Beverage Wholesale"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="dealer-pan"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  PAN or VAT Number
                </Label>
                <Input
                  id="dealer-pan"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  placeholder="e.g. 601234567"
                  className="h-10 font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  9-digit Tax Identification or VAT certificate number
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="dealer-contact"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Contact Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dealer-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. +977-9841234567 / 01-4412345"
                  required
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">
                  Primary phone number for dispatch and order alerts
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="dealer-whatsapp"
                    className="text-sm font-medium flex items-center gap-1.5"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    WhatsApp Number
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyContactToWhatsapp}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Same as Contact
                  </Button>
                </div>
                <Input
                  id="dealer-whatsapp"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g. +977-9841234567"
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">
                  For instant dispatch notifications, bill images, and order
                  coordination
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="dealer-address"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dealer-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Putalisadak Chowk, Ward 28"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="dealer-city"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  City
                </Label>
                <Input
                  id="dealer-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Butwal"
                  className="h-10"
                />
              </div>
            </div>

            {/* Tax, VAT & Credit Terms */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Receipt className="h-4 w-4 text-primary" />
                <span>Tax, Invoicing & Credit Terms (Nepal Sourcing)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dealer-vat" className="text-xs font-medium">
                    VAT Registration No.
                  </Label>
                  <Input
                    id="dealer-vat"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="e.g. 601234567"
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="dealer-tds"
                    className="text-xs font-medium flex items-center gap-1"
                  >
                    <Percent className="h-3 w-3 text-muted-foreground" />
                    TDS Rate (%)
                  </Label>
                  <Input
                    id="dealer-tds"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={tdsRate}
                    onChange={(e) => setTdsRate(e.target.value)}
                    placeholder="0.0"
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="dealer-credit"
                    className="text-xs font-medium flex items-center gap-1"
                  >
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                    Credit Limit (NPR)
                  </Label>
                  <Input
                    id="dealer-credit"
                    type="number"
                    min="0"
                    step="500"
                    value={creditLimitNpr}
                    onChange={(e) => setCreditLimitNpr(e.target.value)}
                    placeholder="0"
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dealer-terms" className="text-xs font-medium">
                    Payment Terms (Days)
                  </Label>
                  <Input
                    id="dealer-terms"
                    type="number"
                    min="0"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    placeholder="0"
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center space-x-2 pt-3">
                  <Checkbox
                    id="dealer-vat-bill"
                    checked={providesVatBill}
                    onCheckedChange={(checked) =>
                      setProvidesVatBill(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="dealer-vat-bill"
                    className="text-xs font-medium leading-none cursor-pointer"
                  >
                    Provides 13% VAT Bill (Tax Invoice with PAN/VAT)
                  </Label>
                </div>
              </div>
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center space-x-2 pt-1 border-t border-border">
              <Checkbox
                id="dealer-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(Boolean(checked))}
              />
              <Label
                htmlFor="dealer-active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Active Dealer (Available for item assignment and order
                fulfillment)
              </Label>
            </div>

            {/* Item Assignment Section */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Assigned Catalog Items
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select the specific liquor or grocery products supplied by
                    this dealer.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {selectedCounts.total} selected
                    {selectedCounts.total > 0 &&
                      ` (${selectedCounts.liquor} Liquor, ${selectedCounts.grocery} Grocery)`}
                  </Badge>
                  {selectedCounts.total > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllSelected}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {/* Filter tabs and search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Tabs
                  value={catalogTab}
                  onValueChange={(val: any) => setCatalogTab(val)}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="h-9">
                    <TabsTrigger value="all" className="text-xs px-2.5">
                      All Items
                    </TabsTrigger>
                    <TabsTrigger
                      value="liquor"
                      className="text-xs px-2.5 flex items-center gap-1"
                    >
                      <Wine className="h-3 w-3" />
                      Liquor
                    </TabsTrigger>
                    <TabsTrigger
                      value="grocery"
                      className="text-xs px-2.5 flex items-center gap-1"
                    >
                      <ShoppingBag className="h-3 w-3" />
                      Grocery
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Filter items by name, category or brand..."
                    className="h-9 pl-8 text-xs"
                  />
                  {itemSearch && (
                    <button
                      type="button"
                      onClick={() => setItemSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {filteredCatalogItems.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllFiltered}
                    className="h-9 text-xs whitespace-nowrap"
                  >
                    Select Filtered ({filteredCatalogItems.length})
                  </Button>
                )}
              </div>

              {/* Item checklist scroll area */}
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border p-2 space-y-1 bg-muted/20">
                {filteredCatalogItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No catalog items found matching your filter.
                  </div>
                ) : (
                  filteredCatalogItems.map((item) => {
                    const key = `${item.catalogType}:${item.id}`
                    const isChecked = selectedItemKeys.has(key)
                    return (
                      <div
                        key={key}
                        onClick={() => toggleItem(item.catalogType, item.id)}
                        className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-amber-500/40 bg-amber-500/10 text-foreground'
                            : 'border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              toggleItem(item.catalogType, item.id)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.catalogType === 'liquor' ? (
                              <Wine className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            ) : (
                              <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span className="font-medium truncate text-foreground">
                              {item.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.brandName && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 h-4 font-normal"
                            >
                              {item.brandName}
                            </Badge>
                          )}
                          {item.categoryName && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5 h-4 font-normal"
                            >
                              {item.categoryName}
                            </Badge>
                          )}
                          {isChecked && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 ml-1" />
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : dealer ? (
                'Save Changes'
              ) : (
                'Register Dealer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
