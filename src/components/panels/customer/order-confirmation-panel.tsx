import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getOrderDetailsFn } from '#/server/orders/order.functions'
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
  CheckCircle2,
  Bike,
  MapPin,
  Phone,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react'

export function OrderConfirmationPanel({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          {/* Top Success Badge */}
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
                  <CardDescription className="text-xs mt-0.5">
                    Tracking Code:{' '}
                    <span className="font-mono text-foreground font-semibold">
                      {order.trackingCode}
                    </span>
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="default"
                    className="text-xs font-semibold capitalize"
                  >
                    Status: {order.status}
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
                  <span>Kathmandu Express Delivery</span>
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
                  <Link to="/drinks">
                    Continue Shopping
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 text-xs"
                  size="lg"
                >
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
