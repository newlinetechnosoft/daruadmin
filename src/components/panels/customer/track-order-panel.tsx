import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { trackPublicOrderFn } from '#/server/orders/order.functions'
import { formatNPR } from '#/lib/money'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { DeliveryStatusStepper } from '#/components/store/delivery-status-stepper'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { toast } from 'sonner'
import {
  Search,
  Bike,
  MapPin,
  Phone,
  PhoneCall,
  Copy,
  Clock,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Package,
  Calendar,
  MessageCircle,
  ShieldCheck,
  Camera,
} from 'lucide-react'

export interface PublicOrderData {
  id: string
  number: string
  trackingCode: string
  status: string
  paymentMethod: string
  paymentStatus: string
  customerName: string
  customerPhone: string
  address: string
  city: string
  lat: number | null
  lng: number | null
  subtotal: number
  deliveryCharge: number
  discount: number
  couponCode: string | null
  tax: number
  total: number
  cancellationReason: string | null
  deliveryOtp?: string | null
  deliveryProofPhotoUrl?: string | null
  createdAt: Date | string
  items: Array<{
    id: string
    name: string
    variantName: string
    sku: string
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  events: Array<{
    id: string
    status: string
    note: string | null
    createdAt: Date | string
  }>
  rider: {
    name: string
    phone: string
    vehicle: string | null
    rating: number | null
  } | null
}

interface TrackOrderPanelProps {
  initialCode?: string
}

export function TrackOrderPanel({ initialCode }: TrackOrderPanelProps) {
  const [searchInput, setSearchInput] = useState(initialCode || '')
  const [order, setOrder] = useState<PublicOrderData | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(initialCode))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadOrder = async (codeToSearch: string) => {
    const clean = codeToSearch.trim()
    if (!clean) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const data = await trackPublicOrderFn({
        data: { code: clean },
      })
      setOrder(data as unknown as PublicOrderData)
    } catch (err: unknown) {
      setOrder(null)
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to find order with that tracking code or number'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // Load when initialCode changes or mounts
  useEffect(() => {
    if (initialCode) {
      setSearchInput(initialCode)
      loadOrder(initialCode)
    }
  }, [initialCode])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!searchInput.trim()) {
      toast.error('Please enter a tracking code or order number')
      return
    }
    // Update route or search
    navigate({
      to: '/track/$code',
      params: { code: searchInput.trim() },
    })
  }

  const handleCopyLink = () => {
    if (!order) return
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/track/${order.trackingCode}`
        : `/track/${order.trackingCode}`
    navigator.clipboard.writeText(url)
    toast.success('Tracking link copied to clipboard!')
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="border-amber-500 text-amber-500 bg-amber-500/10 text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            Order Received
          </Badge>
        )
      case 'confirmed':
        return (
          <Badge
            variant="outline"
            className="border-blue-500 text-blue-500 bg-blue-500/10 text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            Confirmed
          </Badge>
        )
      case 'dealer_assigned':
        return (
          <Badge
            variant="outline"
            className="border-purple-500 text-purple-500 bg-purple-500/10 text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            Sourcing at Partner Dealer
          </Badge>
        )
      case 'rider_assigned':
      case 'picked_up':
        return (
          <Badge
            variant="outline"
            className="border-cyan-500 text-cyan-500 bg-cyan-500/10 text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            Rider Dispatched
          </Badge>
        )
      case 'out_for_delivery':
        return (
          <Badge
            variant="outline"
            className="border-primary text-primary bg-primary/10 animate-pulse text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            ⚡ Out for Delivery
          </Badge>
        )
      case 'delivered':
        return (
          <Badge
            variant="outline"
            className="border-emerald-500 text-emerald-500 bg-emerald-500/10 text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            ✓ Delivered
          </Badge>
        )
      case 'delivery_failed':
        return (
          <Badge
            variant="outline"
            className="border-red-500 text-red-500 bg-red-500/10 text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            Delivery Failed
          </Badge>
        )
      case 'cancelled':
      case 'returned':
        return (
          <Badge
            variant="outline"
            className="border-muted-foreground text-muted-foreground text-xs px-2.5 py-0.5 uppercase tracking-wide font-semibold"
          >
            Cancelled
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs uppercase">
            {status}
          </Badge>
        )
    }
  }

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'pending':
        return 'We have received your order and our Butwal dispatch center is confirming it.'
      case 'confirmed':
        return 'Order is confirmed! Items are being sourced from partner dealers in Butwal/Tilottama.'
      case 'dealer_assigned':
        return 'Partner dealer is preparing your items for rider pickup.'
      case 'rider_assigned':
      case 'picked_up':
        return 'Our express rider is picking up your items and preparing for departure.'
      case 'out_for_delivery':
        return 'Your rider is on the road! Estimated arrival in 20-35 minutes.'
      case 'delivered':
        return 'Order successfully delivered. Enjoy your drinks and refreshments!'
      case 'cancelled':
        return (
          order?.cancellationReason ||
          'This order has been cancelled upon request.'
        )
      case 'delivery_failed':
        return 'Delivery could not be completed. Our customer support will contact you shortly.'
      default:
        return 'Your order is currently being processed.'
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Page Title & Search Bar */}
        <div className="text-center max-w-xl mx-auto mb-8">
          <Badge
            variant="outline"
            className="mb-2 text-[11px] font-medium border-primary/30 text-primary"
          >
            Live Logistics Tracking
          </Badge>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time status, dealer sourcing progress &amp; rider details for
            fast 45-min delivery across Butwal and Tilottama.
          </p>

          <form
            onSubmit={handleSearchSubmit}
            className="mt-6 flex gap-2 items-center"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter Tracking Code or Order # (e.g. MZ-...)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-11 text-xs sm:text-sm font-mono uppercase"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 px-5 text-xs font-semibold shrink-0"
            >
              Track
            </Button>
          </form>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">
              Fetching real-time delivery status...
            </p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!isLoading && errorMessage && (
          <Card className="border-destructive/30 bg-destructive/5 text-center p-8 max-w-lg mx-auto">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              Order Not Found
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
            <p className="text-xs text-muted-foreground mt-3">
              Need assistance? Call our support team at{' '}
              <a
                href="tel:+9779802088800"
                className="font-medium text-foreground underline hover:text-primary"
              >
                +977-9802088800
              </a>
            </p>
          </Card>
        )}

        {/* Initial Prompt (No code entered yet) */}
        {!isLoading && !errorMessage && !order && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <Card className="border-border/60 p-5 text-center">
              <Clock className="h-7 w-7 text-primary mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">
                45-Min Express Delivery
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Fast doorstep fulfillment across Butwal, Tilottama &amp;
                surrounding areas.
              </p>
            </Card>

            <Card className="border-border/60 p-5 text-center">
              <Bike className="h-7 w-7 text-primary mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">
                Dedicated Fleet
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Direct rider contact with live dispatch updates &amp; zero
                hassle cash on delivery.
              </p>
            </Card>

            <Card className="border-border/60 p-5 text-center">
              <PhoneCall className="h-7 w-7 text-primary mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">
                Live Support
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Questions about your delivery? Reach us directly at
                +977-9802088800 anytime.
              </p>
            </Card>
          </div>
        )}

        {/* Order Tracking Details */}
        {!isLoading && order && (
          <div className="space-y-6">
            {/* Top Overview Card */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                        Order #{order.number}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <CardTitle className="text-lg md:text-xl font-bold mt-1 text-foreground">
                      Tracking Code:{' '}
                      <span className="font-mono text-primary font-extrabold select-all">
                        {order.trackingCode}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      Placed on{' '}
                      {new Date(order.createdAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </CardDescription>
                  </div>

                  {/* Quick Share Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-xs h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                    >
                      <a
                        href={getWhatsAppShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Share
                      </a>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-0">
                {/* Stepper Timeline */}
                <div className="pt-2 pb-2">
                  <DeliveryStatusStepper
                    status={order.status}
                    cancellationReason={order.cancellationReason}
                  />
                </div>

                {/* Status Notice Banner */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
                    order.status === 'delivered'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : order.status === 'cancelled' ||
                          order.status === 'delivery_failed'
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : 'bg-primary/5 border-primary/20 text-foreground'
                  }`}
                >
                  <Package className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <div>
                    <strong className="font-semibold block">
                      Status Update:
                    </strong>
                    <span className="text-muted-foreground mt-0.5 block">
                      {getStatusDescription(order.status)}
                    </span>
                  </div>
                </div>

                {/* Delivery Verification PIN / OTP for Active Orders */}
                {order.deliveryOtp &&
                  order.status !== 'delivered' &&
                  order.status !== 'cancelled' &&
                  order.status !== 'delivery_failed' && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                            Delivery Handover PIN (OTP)
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Please provide this 4-digit verification code to your
                          rider upon arrival to confirm package receipt.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 self-center sm:self-auto bg-background px-4 py-2 rounded-lg border border-border shadow-xs">
                        {order.deliveryOtp.split('').map((digit, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-xl font-extrabold text-primary px-1"
                          >
                            {digit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Delivered Proof Card if delivered with Photo Proof */}
                {order.status === 'delivered' &&
                  order.deliveryProofPhotoUrl && (
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                          Proof of Delivery (Handoff Photo)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your rider captured proof of delivery at the time of
                        package handoff:
                      </p>
                      <div className="pt-1">
                        <a
                          href={order.deliveryProofPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block"
                        >
                          <img
                            src={order.deliveryProofPhotoUrl}
                            alt="Delivery Proof"
                            className="h-32 w-auto object-cover rounded-lg border border-border hover:opacity-90 transition-opacity"
                          />
                        </a>
                      </div>
                    </div>
                  )}

                {/* Two-Column Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Delivery Destination */}
                  <Card className="border-border/70 bg-card/50 p-4">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      Delivery Destination
                    </div>
                    <p className="text-xs font-medium text-foreground">
                      {order.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.address}, {order.city}
                    </p>
                    {order.customerPhone && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-1">
                        Contact: {order.customerPhone}
                      </p>
                    )}

                    {order.lat && order.lng && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <a
                            href={getGoogleMapsUrl({
                              lat: order.lat,
                              lng: order.lng,
                              address: order.address,
                              city: order.city,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open Pin in Google Maps
                          </a>
                        </Button>
                      </div>
                    )}
                  </Card>

                  {/* Rider / Courier Info */}
                  <Card className="border-border/70 bg-card/50 p-4">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-foreground">
                      <Bike className="h-4 w-4 text-primary" />
                      Express Courier
                    </div>
                    {order.rider ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">
                            {order.rider.name}
                          </p>
                          {order.rider.rating && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            >
                              ★ {order.rider.rating.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        {order.rider.vehicle && (
                          <p className="text-xs text-muted-foreground">
                            Vehicle: {order.rider.vehicle}
                          </p>
                        )}
                        <div className="pt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            asChild
                            className="h-7 text-xs gap-1.5 flex-1"
                          >
                            <a href={`tel:${order.rider.phone}`}>
                              <Phone className="h-3 w-3" />
                              Call Rider
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-7 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <a
                              href={`https://wa.me/${order.rider.phone.replace(
                                /[^0-9]/g,
                                '',
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2">
                        <p className="text-xs text-muted-foreground">
                          {order.status === 'pending' ||
                          order.status === 'confirmed'
                            ? 'Rider will be assigned once partner dealer prepares your items.'
                            : 'Dedicated rider dispatch in progress.'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Support line: +977-9802088800
                        </p>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Items Summary Table */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
                    Order Items ({order.items.length})
                  </h4>
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between text-xs bg-card/30"
                      >
                        <div className="pr-4">
                          <p className="font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.variantName} × {item.qty}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-foreground">
                            {formatNPR(item.lineTotal)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatNPR(item.unitPrice)} each
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Breakdown Card */}
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>{formatNPR(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Charge:</span>
                    <span>
                      {order.deliveryCharge === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          FREE
                        </span>
                      ) : (
                        formatNPR(order.deliveryCharge)
                      )}
                    </span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>
                        Promo Discount{' '}
                        {order.couponCode && `(${order.couponCode})`}:
                      </span>
                      <span>-{formatNPR(order.discount)}</span>
                    </div>
                  )}
                  {order.tax > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Included VAT (13%):</span>
                      <span>{formatNPR(order.tax)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center text-sm font-bold text-foreground">
                    <span>Total Amount:</span>
                    <span className="text-base text-primary">
                      {formatNPR(order.total)}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Payment Mode:{' '}
                      <strong className="text-foreground uppercase">
                        {order.paymentMethod === 'cod'
                          ? 'Cash on Delivery (COD)'
                          : order.paymentMethod}
                      </strong>
                    </span>
                    <Badge
                      variant={
                        order.paymentStatus === 'paid' ? 'default' : 'secondary'
                      }
                      className="text-[10px] uppercase font-semibold"
                    >
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Payment Due'}
                    </Badge>
                  </div>
                </div>

                {/* Action Links */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    <Link to="/orders">
                      <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                      View All My Orders
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1 text-xs">
                    <Link to="/drinks">
                      Continue Shopping
                      <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
