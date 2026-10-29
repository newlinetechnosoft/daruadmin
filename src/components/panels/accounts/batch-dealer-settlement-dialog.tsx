import { useState, useEffect, useMemo } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  createDealerSettlementBatchFn,
  getUnsettledDealerItemsFn,
} from '#/server/finance/finance.functions'
import { formatNPR } from '#/lib/money'
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
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { CheckCircle2, Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'

export interface BatchDealerSettlementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealers: Array<{
    id: string
    name: string
    city?: string
    pan?: string | null
    defaultTdsRate?: number
  }>
  initialDealerId?: string
  onSettled?: (voucherNo: string, slug: string) => void
}

interface UnsettledItem {
  id: string
  orderId: string
  orderNumber: string
  orderDate: Date | string
  dealerId: string | null
  dealerName: string | null
  dealerPan: string | null
  name: string
  variantName?: string | null
  sku?: string | null
  qty: number
  unitPrice: number
  dealerCostPrice: number | null
  actualDealerCostPrice?: number | null
  sourcingStatus?: string | null
}

export function BatchDealerSettlementDialog({
  open,
  onOpenChange,
  dealers,
  initialDealerId,
  onSettled,
}: BatchDealerSettlementDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedDealerId, setSelectedDealerId] = useState<string>(
    initialDealerId || (dealers[0]?.id ?? ''),
  )
  const [items, setItems] = useState<UnsettledItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Payment form states
  const [tdsRate, setTdsRate] = useState<number>(0)
  const [paymentAccount, setPaymentAccount] = useState<'bank' | 'cash'>('bank')
  const [paymentMethod, setPaymentMethod] = useState<
    'bank_transfer' | 'cash' | 'esewa' | 'khalti' | 'cheque'
  >('bank_transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [memo, setMemo] = useState('')
  const [proofUrl, setProofUrl] = useState('')

  // Sync initialDealerId when modal opens
  useEffect(() => {
    if (open) {
      const activeId = initialDealerId || dealers[0]?.id || ''
      setSelectedDealerId(activeId)
      const dealer = dealers.find((d) => d.id === activeId)
      setTdsRate(dealer?.defaultTdsRate ?? 0)
    }
  }, [open, initialDealerId, dealers])

  // Fetch unsettled items whenever selected dealer changes
  useEffect(() => {
    if (!open || !selectedDealerId) return

    let isMounted = true
    setIsLoading(true)

    getUnsettledDealerItemsFn({ data: { dealerId: selectedDealerId } })
      .then((data) => {
        if (!isMounted) return
        setItems(data)
        // Select all by default
        setSelectedItemIds(new Set(data.map((d: any) => d.id)))
      })
      .catch((err) => {
        if (!isMounted) return
        toast.error(err?.message || 'Failed to load unsettled items')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [open, selectedDealerId])

  // Calculation summaries
  const selectedItems = useMemo(() => {
    return items.filter((i) => selectedItemIds.has(i.id))
  }, [items, selectedItemIds])

  const grossCost = useMemo(() => {
    return selectedItems.reduce((acc, it) => {
      const cost = it.dealerCostPrice || it.actualDealerCostPrice || 0
      return acc + cost * it.qty
    }, 0)
  }, [selectedItems])

  const tdsAmount = useMemo(() => {
    if (tdsRate <= 0) return 0
    return Math.round(grossCost * (tdsRate / 100))
  }, [grossCost, tdsRate])

  const netPayout = grossCost - tdsAmount

  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(items.map((i) => i.id)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItemIds.size === 0) {
      toast.error('Please select at least one delivered item to settle.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await createDealerSettlementBatchFn({
        data: {
          dealerId: selectedDealerId,
          orderItemIds: Array.from(selectedItemIds),
          paymentAccount,
          paymentMethod,
          paymentReference: paymentReference || undefined,
          tdsRate,
          memo: memo || undefined,
          proofUrls: proofUrl ? [proofUrl] : [],
        },
      })

      toast.success(
        `Settlement voucher ${res.voucherNo} posted! Net payout: Rs. ${(res.netAmount / 100).toLocaleString()}`,
        {
          action: {
            label: 'View Voucher',
            onClick: () => window.open(`/voucher/${res.slug}`, '_blank'),
          },
        },
      )

      if (onSettled) onSettled(res.voucherNo, res.slug)
      onOpenChange(false)
      await queryClient.invalidateQueries({
        queryKey: adminQueries.ledger().queryKey,
      })
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process batch settlement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentDealer = dealers.find((d) => d.id === selectedDealerId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Batch Settle Delivered Items
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Select delivered customer order items sourced from this
                  dealer, apply TDS withholding, and generate a double-entry
                  payment voucher with a public slug.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
            {/* Dealer Selection Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border border-border">
              <div className="space-y-1.5">
                <Label htmlFor="dealer-select" className="text-xs">
                  Sourcing Supplier / Dealer
                </Label>
                <NativeSelect
                  id="dealer-select"
                  value={selectedDealerId}
                  onChange={(e) => {
                    setSelectedDealerId(e.target.value)
                    const d = dealers.find((deal) => deal.id === e.target.value)
                    setTdsRate(d?.defaultTdsRate ?? 0)
                  }}
                  className="h-8 text-xs bg-background"
                  disabled={isLoading || isSubmitting}
                >
                  {dealers.map((d) => (
                    <NativeSelectOption key={d.id} value={d.id}>
                      {d.name} {d.city ? `(${d.city})` : ''}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs pt-2 sm:pt-4">
                <div>
                  <span className="text-muted-foreground block text-xs">
                    PAN / VAT No.
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {currentDealer?.pan || 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-xs">
                    Delivered Unsettled
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {items.length} items
                  </Badge>
                </div>
              </div>
            </div>

            {/* Delivered Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  Delivered Customer Order Items
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleAll}
                    disabled={items.length === 0 || isLoading}
                    className="h-6 text-xs px-2 text-primary"
                  >
                    {selectedItemIds.size === items.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                  <span className="text-muted-foreground">
                    ({selectedItemIds.size} of {items.length} selected)
                  </span>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading delivered order items...</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No delivered unsettled order lines found for this dealer.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center"></TableHead>
                        <TableHead className="text-xs">Order</TableHead>
                        <TableHead className="text-xs">Product Item</TableHead>
                        <TableHead className="text-xs text-center">
                          Qty
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Cost Price
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Line Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const cost =
                          item.dealerCostPrice ||
                          item.actualDealerCostPrice ||
                          0
                        const lineTotal = cost * item.qty
                        const isChecked = selectedItemIds.has(item.id)
                        return (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleToggleItem(item.id)}
                          >
                            <TableCell
                              className="text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() =>
                                  handleToggleItem(item.id)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {item.orderNumber}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {item.name}
                              {item.variantName && (
                                <span className="text-muted-foreground ml-1">
                                  ({item.variantName})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono">
                              {item.qty}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono text-muted-foreground">
                              {formatNPR(cost)}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold text-foreground">
                              {formatNPR(lineTotal)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* Payment & Deductions Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="tds-rate" className="text-xs">
                  TDS Withholding Rate (%)
                </Label>
                <div className="relative">
                  <Input
                    id="tds-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={tdsRate}
                    onChange={(e) =>
                      setTdsRate(parseFloat(e.target.value) || 0)
                    }
                    className="h-8 text-xs pr-8"
                    placeholder="e.g. 1.5"
                  />
                  <span className="absolute top-1/2 -translate-y-1/2 right-2.5 text-xs text-muted-foreground font-semibold">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Withheld into TDS Payable (default 0% until confirmed).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-method" className="text-xs">
                  Payment Channel
                </Label>
                <NativeSelect
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => {
                    const val = e.target.value as any
                    setPaymentMethod(val)
                    setPaymentAccount(val === 'cash' ? 'cash' : 'bank')
                  }}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="bank_transfer">
                    Bank Transfer
                  </NativeSelectOption>
                  <NativeSelectOption value="cash">
                    Cash Float
                  </NativeSelectOption>
                  <NativeSelectOption value="esewa">
                    eSewa Mobile Wallet
                  </NativeSelectOption>
                  <NativeSelectOption value="khalti">Khalti</NativeSelectOption>
                  <NativeSelectOption value="cheque">
                    Bank Cheque
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-ref" className="text-xs">
                  Transaction / Cheque Reference
                </Label>
                <Input
                  id="pay-ref"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. UTR-982342 or CHQ-002"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="settle-memo" className="text-xs">
                  Settlement Narration / Notes
                </Label>
                <Input
                  id="settle-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Bi-weekly procurement settlement for delivered orders"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settle-proof" className="text-xs">
                  Proof Photo / Slip URL
                </Label>
                <Input
                  id="settle-proof"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://... receipt image"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Breakdown Summary Card */}
            <div className="rounded-lg border border-border bg-gradient-to-r from-card to-muted/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Gross Sourcing Cost ({selectedItemIds.size} items)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {formatNPR(grossCost)}
                </span>
              </div>
              {tdsRate > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span>TDS Withholding ({tdsRate}%)</span>
                  <span className="font-mono font-medium">
                    -{formatNPR(tdsAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border text-sm font-bold text-foreground">
                <span>Net Disbursement Amount</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                  {formatNPR(netPayout)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting || selectedItemIds.size === 0 || netPayout <= 0
              }
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Posting Journal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Settle {selectedItemIds.size} Items ({formatNPR(netPayout)})
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
