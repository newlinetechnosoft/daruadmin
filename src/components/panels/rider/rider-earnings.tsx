import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { depositRiderCashFn } from '#/server/operations/operations.functions'
import { queueOutboxAction } from '#/lib/idb/outbox'
import {
  getAvailableRiderCash,
  RIDER_SETTLEMENT_METHOD_LABELS,
  RIDER_SETTLEMENT_PAYMENT_METHODS,
} from '#/server/riders/rider-settlements'
import type {
  Order,
  Rider,
  RiderCashHandover,
  RiderSettlementPaymentMethod,
} from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Wallet, Coins, ArrowUpRight, History, Receipt } from 'lucide-react'
import { toast } from 'sonner'

interface RiderEarningsProps {
  rider: Rider
  orders: Order[]
  cashHandovers?: RiderCashHandover[]
  pendingSettlementAmount?: number
}

export function RiderEarnings({
  rider,
  orders,
  cashHandovers = [],
  pendingSettlementAmount,
}: RiderEarningsProps) {
  const router = useRouter()
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [paymentMethod, setPaymentMethod] =
    useState<RiderSettlementPaymentMethod>('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [depositNote, setDepositNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const completedOrders = orders.filter((o) => o.status === 'delivered')
  const pendingAmount =
    pendingSettlementAmount ??
    cashHandovers
      .filter((h) => h.status === 'pending')
      .reduce((total, h) => total + h.amount, 0)
  const availableToSettle = getAvailableRiderCash(
    rider.cashOnHand,
    pendingAmount,
  )

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountVal = Math.round(parseFloat(depositAmount) * 100)
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (amountVal > availableToSettle) {
      toast.error(
        `Settlement cannot exceed available cash on hand (${formatNPR(availableToSettle)})`,
      )
      return
    }

    const reference = paymentReference.trim()
    if (paymentMethod !== 'cash' && !reference) {
      toast.error(
        'Payment reference is required for bank transfer and cheque settlements',
      )
      return
    }

    const payload = {
      amount: amountVal,
      note: depositNote || undefined,
      paymentMethod,
      paymentReference: reference || undefined,
    }

    try {
      setIsSubmitting(true)

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueOutboxAction('cash_handover', payload)
        toast.info('Saved offline! Settlement request queued for sync.')
        setDepositOpen(false)
        setDepositAmount('')
        setPaymentReference('')
        setDepositNote('')
        return
      }

      await depositRiderCashFn({ data: payload })
      toast.success(
        'Settlement request submitted and is pending manager/admin approval.',
      )
      setDepositOpen(false)
      setDepositAmount('')
      setPaymentReference('')
      setDepositNote('')
      await router.invalidate()
    } catch (err: any) {
      if (
        !navigator.onLine ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('Network')
      ) {
        await queueOutboxAction('cash_handover', payload)
        toast.info('Network failed. Settlement request saved to outbox.')
        setDepositOpen(false)
        setDepositAmount('')
        setPaymentReference('')
        setDepositNote('')
      } else {
        toast.error(err?.message || 'Failed to submit settlement request')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Earnings & Cash in Hand
        </h2>
        <p className="text-xs text-muted-foreground">
          Track your delivery commissions and settle cash collected from COD
          orders in full or in partial payments.
        </p>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cash in Hand */}
        <Card className="border-border bg-card">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Cash in Hand (COD Float)
              </span>
              <Wallet className="h-5 w-5 text-warning" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono mt-1">
              {formatNPR(rider.cashOnHand)}
            </div>
            <CardDescription className="text-xs mt-1">
              Total cash collected from COD customers that must be settled with
              store accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs">
              <div>
                <span className="text-muted-foreground block">
                  Pending approval
                </span>
                <span className="font-mono font-semibold text-warning">
                  {formatNPR(pendingAmount)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Available to settle
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {formatNPR(availableToSettle)}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setDepositAmount((availableToSettle / 100).toString())
                setPaymentMethod('cash')
                setPaymentReference('')
                setDepositOpen(true)
              }}
              disabled={availableToSettle <= 0}
              className="w-full h-9 text-xs gap-1.5"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Request Settlement
            </Button>
          </CardContent>
        </Card>

        {/* Commission Earnings */}
        <Card className="border-border bg-card">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Total Earned Commission
              </span>
              <Coins className="h-5 w-5 text-success" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono mt-1">
              {formatNPR(rider.earnings)}
            </div>
            <CardDescription className="text-xs mt-1">
              Earned based on {rider.commissionRate}% delivery fee share over{' '}
              {rider.deliveries} total trips.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2">
            <div className="p-2.5 rounded-md bg-muted/40 border border-border text-xs flex justify-between items-center">
              <span className="text-muted-foreground">
                Your Commission Rate:
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {rider.commissionRate}% of delivery fee
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlement Request History */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">
                Settlement Requests
              </CardTitle>
            </div>
            {pendingAmount > 0 && (
              <Badge variant="warning" className="text-xs">
                {formatNPR(pendingAmount)} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cashHandovers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No settlement requests yet. Use “Request Settlement” above to
              submit a partial or full payment.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cashHandovers.map((handover) => (
                <div
                  key={handover.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
                        {formatNPR(handover.amount)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {RIDER_SETTLEMENT_METHOD_LABELS[handover.paymentMethod]}
                      </Badge>
                      <Badge
                        variant={
                          handover.status === 'verified'
                            ? 'success'
                            : handover.status === 'rejected'
                              ? 'destructive'
                              : 'warning'
                        }
                        className="text-xs"
                      >
                        {handover.status === 'verified'
                          ? 'Settled'
                          : handover.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending approval'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested {new Date(handover.createdAt).toLocaleString()}
                      {handover.paymentReference
                        ? ` • Ref: ${handover.paymentReference}`
                        : ''}
                    </p>
                    {handover.status === 'rejected' &&
                      handover.rejectionReason && (
                        <p className="text-xs text-destructive mt-0.5">
                          Reason: {handover.rejectionReason}
                        </p>
                      )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">
                      {handover.status === 'pending'
                        ? 'Awaiting manager/admin acceptance'
                        : handover.status === 'verified'
                          ? 'Accepted by accounts'
                          : 'Not settled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Delivery History */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              Delivery Earnings Breakdown
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {completedOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No completed deliveries yet. Complete orders to build your
              earnings record.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {completedOrders.map((order) => {
                const commission = Math.round(
                  order.deliveryCharge * (rider.commissionRate / 100),
                )
                const isCOD = order.paymentMethod === 'cod'

                return (
                  <div
                    key={order.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          {order.number}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {order.city}
                        </Badge>
                        {isCOD && (
                          <Badge variant="warning" className="text-xs">
                            COD: {formatNPR(order.total)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Customer: {order.customerName} •{' '}
                        {new Date(order.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right sm:text-right">
                      <div className="text-success font-bold font-mono text-sm">
                        +{formatNPR(commission)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Fee: {formatNPR(order.deliveryCharge)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Request Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDepositSubmit}>
            <DialogHeader>
              <DialogTitle className="text-sm">Request Settlement</DialogTitle>
              <DialogDescription className="text-xs">
                Submit a partial or full COD cash settlement by cash, bank
                transfer, or cheque. A manager or admin must accept it before it
                is considered settled.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="dep-amount" className="text-xs">
                  Settlement Amount (NPR)
                </Label>
                <Input
                  id="dep-amount"
                  type="number"
                  step="0.01"
                  max={(availableToSettle / 100).toString()}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Available to settle: {formatNPR(availableToSettle)}
                  {pendingAmount > 0
                    ? ` • ${formatNPR(pendingAmount)} already pending`
                    : ''}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-method" className="text-xs">
                  Payment Method
                </Label>
                <NativeSelect
                  id="dep-method"
                  value={paymentMethod}
                  onChange={(e) => {
                    const method = e.target
                      .value as RiderSettlementPaymentMethod
                    setPaymentMethod(method)
                    if (method === 'cash') setPaymentReference('')
                  }}
                  className="w-full text-xs"
                >
                  {RIDER_SETTLEMENT_PAYMENT_METHODS.map((method) => (
                    <NativeSelectOption key={method} value={method}>
                      {RIDER_SETTLEMENT_METHOD_LABELS[method]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              {paymentMethod !== 'cash' && (
                <div className="space-y-1.5">
                  <Label htmlFor="dep-reference" className="text-xs">
                    Payment Reference / Transaction ID *
                  </Label>
                  <Input
                    id="dep-reference"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={
                      paymentMethod === 'cheque'
                        ? 'e.g. Cheque number'
                        : 'e.g. Bank transaction / UTR number'
                    }
                    className="text-xs font-mono"
                    required
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for bank transfer and cheque settlements.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="dep-note" className="text-xs">
                  Note (Optional)
                </Label>
                <Input
                  id="dep-note"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  placeholder="e.g. Handed over at store counter"
                  className="text-xs"
                  maxLength={500}
                />
              </div>

              <div className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                Your request stays pending until a manager or admin accepts it.
                You can submit multiple partial settlements as long as they do
                not exceed your available cash on hand.
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDepositOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
