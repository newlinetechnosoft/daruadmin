import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  getOrderDetailsFn,
  cancelCustomerOrderFn,
} from '#/server/orders/order.functions'
import type { Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Separator } from '#/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Bike,
  MapPin,
  Phone,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Ban,
  Copy,
  MessageCircle,
  Truck,
  ShoppingBag,
} from 'lucide-react'
import { DeliveryStatusStepper } from '#/components/store/delivery-status-stepper'

export function OrderConfirmationPanel({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState(
    'Placed order by mistake',
  )
  const [customReason, setCustomReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCopyTracking = () => {
    if (!order) return
    navigator.clipboard.writeText(order.trackingCode)
    toast.success('Tracking code copied to clipboard!')
  }

  const getWhatsAppShareUrl = () => {
    if (!order) return '#'
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/track/${order.trackingCode}`
        : `/track/${order.trackingCode}`
    return `https://wa.me/?text=${encodeURIComponent(
      `Track my Mezmani express delivery (${order.number}): ${url}`,
    )}`
  }

  const handleCancelOrder = async () => {
    const finalReason =
      selectedReason === 'Other' ? customReason.trim() : selectedReason
    if (!finalReason) {
      toast.error('Please specify a cancellation reason')
      return
    }

    setIsCancelling(true)
    try {
      const res = await cancelCustomerOrderFn({
        data: {
          orderId,
          reason: finalReason,
        },
      })
      setOrder(res.order)
      setIsCancelDialogOpen(false)
      toast.success('Your order has been cancelled')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order')
    } finally {
      setIsCancelling(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    getOrderDetailsFn({ data: { orderId } })
      .then((data) => {
        if (!isMounted) return
        setOrder(data)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(
          err instanceof Error ? err.message : 'Unable to load order details',
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [orderId])

  if (isLoading) {
    return (
      <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">
              Loading order confirmation...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16 px-4">
          <Card className="max-w-md w-full text-center p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Order Not Found
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {error || 'We could not retrieve this order record.'}
            </p>
            <Button asChild size="sm" className="mt-6 text-xs">
              <Link to="/drinks">Return to Storefront</Link>
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Top Status Header */}
          {order.status === 'cancelled' ? (
            <div className="text-center space-y-2 mb-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <Ban className="h-8 w-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-destructive">
                Order Cancelled
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                {order.cancellationReason
                  ? `Reason: ${order.cancellationReason}`
                  : 'This order has been cancelled.'}
              </p>
              {order.paymentStatus === 'paid' && (
                <div className="mx-auto max-w-md p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Your eSewa digital payment was received. Our finance desk will
                  initiate your refund within 24 hours.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-2 mb-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground">
                Order Confirmed!
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Thank you for ordering with Mezmani. Your express dispatch is in
                progress.
              </p>
            </div>
          )}

          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/15 border-b border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Order Reference
                  </span>
                  <CardTitle className="text-xl font-black font-mono text-foreground mt-0.5">
                    {order.number}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 flex flex-wrap items-center gap-2">
                    <span>Tracking Code:</span>
                    <button
                      type="button"
                      onClick={handleCopyTracking}
                      className="font-mono text-foreground font-semibold inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded border border-border"
                      title="Click to copy tracking code"
                    >
                      <span>{order.trackingCode}</span>
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <a
                      href={getWhatsAppShareUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline ml-1"
                      title="Share tracking link via WhatsApp"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span>Share on WhatsApp</span>
                    </a>
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="default"
                    className="text-xs font-semibold capitalize"
                  >
                    Status: {order.status.replaceAll('_', ' ')}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono font-semibold"
                  >
                    {order.paymentMethod === 'cod'
                      ? 'Cash on Delivery'
                      : 'eSewa'}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Visual Delivery Stepper */}
              <div className="bg-muted/15 p-4 rounded-xl border border-border">
                <DeliveryStatusStepper
                  status={order.status}
                  cancellationReason={order.cancellationReason}
                />
              </div>

              {/* ETA & Express Delivery Promise Banner */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bike className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground">
                    Estimated Delivery: Within 40–45 Minutes
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Our nearest dispatch hub has received your order. A rider
                    will be assigned shortly and will call you upon departure.
                  </p>
                </div>
              </div>

              {/* Delivery Destination & Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border bg-muted/10 p-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Delivery Destination
                  </span>
                  <a
                    href={getGoogleMapsUrl(order)}
                    target="_blank"
                    rel="noreferrer"
                    className="block group"
                  >
                    <p className="text-xs font-semibold text-foreground group-hover:underline">
                      {order.address}
                    </p>
                    {order.lat && order.lng && (
                      <p className="text-[11px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                        Coordinates: {order.lat.toFixed(6)}° N,{' '}
                        {order.lng.toFixed(6)}° E ↗
                      </p>
                    )}
                  </a>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    Contact Recipient
                  </span>
                  <p className="text-xs font-semibold text-foreground">
                    {order.customerName}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    +977 {order.customerPhone}
                  </p>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ordered Items ({order.items.length})
                </h4>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary font-mono">
                          {item.qty}x
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.variantName}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-foreground">
                        {formatNPR(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Price Breakdown */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-foreground font-medium">
                    {formatNPR(order.subtotal)}
                  </span>
                </div>

                {order.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>
                      Discount {order.couponCode ? `(${order.couponCode})` : ''}
                    </span>
                    <span className="font-mono font-medium">
                      -{formatNPR(order.discount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Express Delivery</span>
                  <span className="font-mono text-foreground font-medium">
                    {order.deliveryCharge === 0 ? (
                      <span className="text-success font-semibold">Free</span>
                    ) : (
                      formatNPR(order.deliveryCharge)
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                  <span>Total Amount</span>
                  <span className="font-mono">{formatNPR(order.total)}</span>
                </div>
              </div>

              {/* COD or eSewa Payment Note */}
              <div className="rounded-lg border border-border bg-card p-4 text-xs flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  {order.paymentMethod === 'cod' ? (
                    <>
                      <h5 className="font-bold text-foreground">
                        Cash on Delivery Reminder
                      </h5>
                      <p className="text-muted-foreground mt-0.5">
                        Please keep <strong>{formatNPR(order.total)}</strong> in
                        cash ready when the rider arrives at your doorstep.
                      </p>
                    </>
                  ) : (
                    <>
                      <h5 className="font-bold text-foreground">
                        eSewa Digital Payment
                      </h5>
                      <p className="text-muted-foreground mt-0.5">
                        Payment status: <strong>{order.paymentStatus}</strong>.
                        Your transaction reference is recorded on your invoice.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button asChild className="flex-1 text-xs gap-2" size="lg">
                  <Link to="/track/$code" params={{ code: order.trackingCode }}>
                    <Truck className="h-4 w-4" />
                    Track Live Delivery
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 text-xs gap-1.5"
                  size="lg"
                >
                  <Link to="/orders">
                    <ShoppingBag className="h-4 w-4" />
                    View My Orders
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="sm:w-auto text-xs"
                  size="lg"
                >
                  <Link to="/drinks">Continue Shopping</Link>
                </Button>

                {(order.status === 'pending' ||
                  order.status === 'confirmed') && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="sm:w-auto text-xs gap-1.5"
                    size="lg"
                    onClick={() => setIsCancelDialogOpen(true)}
                  >
                    <Ban className="h-4 w-4" />
                    Cancel Order
                  </Button>
                )}
              </div>

              {/* Cancellation Dialog */}
              <Dialog
                open={isCancelDialogOpen}
                onOpenChange={setIsCancelDialogOpen}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">
                      Cancel Order {order.number}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Are you sure you want to cancel this order? Please select
                      a reason below.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Cancellation Reason
                      </Label>
                      <select
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring"
                      >
                        <option value="Placed order by mistake">
                          Placed order by mistake
                        </option>
                        <option value="Delivery time too long / change of plan">
                          Delivery time too long / change of plan
                        </option>
                        <option value="Want to change items or quantity">
                          Want to change items or quantity
                        </option>
                        <option value="Incorrect delivery address or contact number">
                          Incorrect delivery address or contact number
                        </option>
                        <option value="Found better price elsewhere">
                          Found better price elsewhere
                        </option>
                        <option value="Other">Other reason...</option>
                      </select>
                    </div>

                    {selectedReason === 'Other' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          Please describe:
                        </Label>
                        <Input
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          placeholder="Tell us why you are cancelling..."
                          className="text-xs"
                        />
                      </div>
                    )}

                    {order.paymentStatus === 'paid' && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                        <strong>Pre-paid Notice:</strong> Since this order was
                        paid via eSewa, your payment will be refunded to your
                        account within 24 hours.
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setIsCancelDialogOpen(false)}
                      disabled={isCancelling}
                    >
                      Keep Order
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={handleCancelOrder}
                      disabled={isCancelling}
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Confirm Cancellation'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
