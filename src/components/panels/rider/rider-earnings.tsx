import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { depositRiderCashFn } from '#/server/operations/operations.functions'
import { queueOutboxAction } from '#/lib/idb/outbox'
import type { Rider, Order } from '#/server/operations/types'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Wallet, Coins, ArrowUpRight, History } from 'lucide-react'
import { toast } from 'sonner'

interface RiderEarningsProps {
  rider: Rider
  orders: Order[]
}

export function RiderEarnings({ rider, orders }: RiderEarningsProps) {
  const router = useRouter()
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositNote, setDepositNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const completedOrders = orders.filter((o) => o.status === 'delivered')

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountVal = Math.round(parseFloat(depositAmount) * 100)
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (amountVal > rider.cashOnHand) {
      toast.error('Deposit cannot exceed current cash on hand')
      return
    }

    try {
      setIsSubmitting(true)

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueOutboxAction('cash_handover', {
          amount: amountVal,
          note: depositNote || undefined,
        })
        toast.info('Saved offline! Cash handover queued for sync.')
        setDepositOpen(false)
        setDepositAmount('')
        setDepositNote('')
        return
      }

      await depositRiderCashFn({
        data: {
          amount: amountVal,
          note: depositNote || undefined,
        },
      })
      toast.success('Cash deposit recorded and submitted to accounts!')
      setDepositOpen(false)
      setDepositAmount('')
      setDepositNote('')
      await router.invalidate()
    } catch (err: any) {
      if (
        !navigator.onLine ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('Network')
      ) {
        await queueOutboxAction('cash_handover', {
          amount: amountVal,
          note: depositNote || undefined,
        })
        toast.info('Network failed. Saved offline to outbox.')
        setDepositOpen(false)
        setDepositAmount('')
        setDepositNote('')
      } else {
        toast.error(err?.message || 'Failed to submit deposit')
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
          Track your delivery commissions and manage cash collected from COD
          orders
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
              Total cash collected from COD customers that must be deposited
              with store accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2">
            <Button
              size="sm"
              onClick={() => {
                setDepositAmount((rider.cashOnHand / 100).toString())
                setDepositOpen(true)
              }}
              disabled={rider.cashOnHand <= 0}
              className="w-full h-9 text-xs gap-1.5"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Hand Over Cash to Accounts
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

      {/* Deposit Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDepositSubmit}>
            <DialogHeader>
              <DialogTitle className="text-sm">
                Deposit Cash to Admin
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record physical cash handover of collected COD floats to Mezmani
                finance accounts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="dep-amount" className="text-xs">
                  Handover Amount (NPR)
                </Label>
                <Input
                  id="dep-amount"
                  type="number"
                  step="0.01"
                  max={(rider.cashOnHand / 100).toString()}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Current float in hand: {formatNPR(rider.cashOnHand)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-note" className="text-xs">
                  Deposit / Handover Note (Optional)
                </Label>
                <Input
                  id="dep-note"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  placeholder="e.g. Handed over at Durbar Marg store counter"
                  className="text-xs"
                />
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
                {isSubmitting ? 'Submitting...' : 'Confirm Handover'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
