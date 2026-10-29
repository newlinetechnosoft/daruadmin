import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { getCustomerOrdersFn } from '#/server/orders/order.functions'
import {
  getCustomerComplaintsFn,
  createCustomerComplaintFn,
} from '#/server/operations/operations.functions'
import type { Order, Complaint } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { useCart } from '#/lib/cart-context'
import { authClient } from '#/lib/auth-client'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { Card, CardContent } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#/components/ui/dialog'
import { toast } from 'sonner'
import {
  ShoppingBag,
  RotateCcw,
  ExternalLink,
  Printer,
  Copy,
  MapPin,
  Package,
  Calendar,
  LogIn,
  ChevronRight,
  HelpCircle,
  Plus,
  LifeBuoy,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

import { cn } from '#/lib/utils'

export function CustomerOrdersPanel() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const { addItem, setIsOpen } = useCart()
  const [orders, setOrders] = useState<Order[]>([])
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'tickets'>('orders')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedReceiptOrder, setSelectedReceiptOrder] =
    useState<Order | null>(null)
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null)
  const [ticketCategory, setTicketCategory] = useState('Delivery Delay')
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketBody, setTicketBody] = useState('')
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (isSessionPending) return

    if (!session?.user) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    Promise.all([
      getCustomerOrdersFn(),
      getCustomerComplaintsFn().catch(() => [] as Complaint[]),
    ])
      .then(([ordersRes, complaintsRes]) => {
        if (!isMounted) return
        setOrders(ordersRes)
        setComplaints(complaintsRes)
      })
      .catch((err) => {
        console.error('Failed to load customer account data:', err)
        toast.error('Failed to load past orders')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [session?.user, isSessionPending])

  const handleOpenTicketForOrder = (order: Order) => {
    setTicketOrder(order)
    setTicketCategory('Delivery Delay')
    setTicketSubject(`Issue with order #${order.number}`)
    setTicketBody('')
    setIsTicketModalOpen(true)
  }

  const handleOpenGeneralTicket = () => {
    setTicketOrder(null)
    setTicketCategory('General Inquiry')
    setTicketSubject('')
    setTicketBody('')
    setIsTicketModalOpen(true)
  }

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketBody.trim()) {
      toast.error('Please enter a subject and description')
      return
    }

    try {
      setIsSubmittingTicket(true)
      const formattedSubject = `[${ticketCategory}] ${ticketSubject.trim()}`
      await createCustomerComplaintFn({
        data: {
          orderId: ticketOrder?.id || null,
          subject: formattedSubject,
          body: ticketBody.trim(),
        },
      })
      toast.success(
        'Support ticket submitted! Our team will contact you promptly.',
      )
      setIsTicketModalOpen(false)
      setTicketSubject('')
      setTicketBody('')
      setTicketOrder(null)

      const updatedComplaints = await getCustomerComplaintsFn()
      setComplaints(updatedComplaints)
      setActiveTab('tickets')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit ticket',
      )
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  // 1-Click Reorder Action
  const handleReorder = (order: Order) => {
    let addedCount = 0

    for (const item of order.items) {
      if (item.variantId) {
        const success = addItem(
          {
            id: item.variantId,
            productId: item.productId,
            productName: item.name,
            productSlug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            variantId: item.variantId,
            variantName: item.variantName,
            catalogType: item.catalogType,
            price: item.unitPrice,
          },
          item.qty,
        )
        if (success) {
          addedCount += item.qty
        }
      }
    }

    if (addedCount > 0) {
      setIsOpen(true)
      toast.success(
        `Added ${addedCount} items from order #${order.number} to your cart`,
      )
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Tracking code copied to clipboard!')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="border-amber-500 text-amber-500 bg-amber-500/10 text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
          >
            Received
          </Badge>
        )
      case 'confirmed':
        return (
          <Badge
            variant="outline"
            className="border-blue-500 text-blue-500 bg-blue-500/10 text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
          >
            Confirmed
          </Badge>
        )
      case 'dealer_assigned':
        return (
          <Badge
            variant="outline"
            className="border-purple-500 text-purple-500 bg-purple-500/10 text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
          >
            Sourcing
          </Badge>
        )
      case 'rider_assigned':
      case 'picked_up':
      case 'out_for_delivery':
        return (
          <Badge
            variant="outline"
            className="border-primary text-primary bg-primary/10 text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
          >
            On the Way
          </Badge>
        )
      case 'delivered':
        return (
          <Badge
            variant="outline"
            className="border-emerald-500 text-emerald-500 bg-emerald-500/10 text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
          >
            Delivered
          </Badge>
        )
      case 'delivery_failed':
        return (
          <Badge
            variant="outline"
            className="border-red-500 text-red-500 bg-red-500/10 text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
          >
            Failed
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge
            variant="outline"
            className="border-muted-foreground text-muted-foreground text-xs px-2 py-0.5 uppercase tracking-wide font-medium"
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

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                My Orders
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Review your purchase history, download invoices, track live
              deliveries, or reorder favorite items in 1 click.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs self-start sm:self-auto"
          >
            <Link to="/track">
              Track by Code
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Not Logged In */}
        {!isSessionPending && !session?.user && (
          <Card className="border-border p-8 text-center max-w-md mx-auto">
            <LogIn className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground">
              Sign In to View Your Orders
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Please sign in to access your order history, track live
              deliveries, and re-order drinks with one click.
            </p>
            <Button
              className="mt-5 w-full text-xs font-semibold"
              onClick={() =>
                navigate({ to: '/login', search: { redirect: '/orders' } })
              }
            >
              Sign In
            </Button>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && session?.user && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 rounded-lg border border-border bg-card/40 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Main Content Tabs */}
        {!isLoading && session?.user && (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'orders' | 'tickets')}
            className="w-full"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-border/60 pb-3">
              <TabsList className="h-9">
                <TabsTrigger
                  value="orders"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>My Orders ({orders.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="tickets"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <LifeBuoy className="h-3.5 w-3.5" />
                  <span>Support Tickets ({complaints.length})</span>
                  {complaints.filter((c) => c.status !== 'resolved').length >
                    0 && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 text-xs font-mono bg-primary/20 text-primary"
                    >
                      {complaints.filter((c) => c.status !== 'resolved').length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {activeTab === 'tickets' && (
                <Button
                  size="sm"
                  onClick={handleOpenGeneralTicket}
                  className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Support Ticket
                </Button>
              )}
            </div>

            {/* Orders Tab Content */}
            <TabsContent value="orders" className="space-y-4 m-0">
              {orders.length === 0 ? (
                <Card className="border-border p-10 text-center max-w-lg mx-auto">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <h3 className="text-base font-bold text-foreground">
                    No Orders Found Yet
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    You haven&apos;t placed any orders yet. Explore our cold
                    beers, whiskeys, snacks, and mixers for express 45-minute
                    delivery across Butwal &amp; Tilottama.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                    <Button asChild size="sm" className="text-xs">
                      <Link to="/drinks">Browse Drinks Catalog</Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Link to="/grocery">Browse Food &amp; Snacks</Link>
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card
                      key={order.id}
                      className="border-border hover:border-primary/40 transition-colors shadow-xs overflow-hidden"
                    >
                      {/* Order Top Bar */}
                      <div className="bg-muted/30 px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-foreground">
                            #{order.number}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.createdAt).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              },
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(order.status)}
                          <Badge
                            variant="outline"
                            className="text-xs uppercase font-mono"
                          >
                            {order.paymentMethod === 'cod'
                              ? 'COD'
                              : order.paymentMethod}
                          </Badge>
                        </div>
                      </div>

                      {/* Order Body */}
                      <CardContent className="p-4 sm:p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Items List Column */}
                          <div className="md:col-span-2 space-y-2">
                            <p className="text-xs font-semibold text-foreground uppercase tracking-wider text-xs">
                              Items ({order.items.length})
                            </p>
                            <div className="divide-y divide-border/60">
                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="py-1.5 flex items-center justify-between text-xs"
                                >
                                  <span className="text-foreground">
                                    {item.name}{' '}
                                    <span className="text-muted-foreground text-xs">
                                      ({item.variantName})
                                    </span>
                                  </span>
                                  <span className="text-muted-foreground font-medium shrink-0 ml-2">
                                    × {item.qty} &bull;{' '}
                                    {formatNPR(item.lineTotal)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="truncate">
                                {order.address}, {order.city}
                              </span>
                            </div>
                          </div>

                          {/* Financial Summary & Actions Column */}
                          <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l md:pl-4 border-border pt-3 md:pt-0">
                            <div>
                              <span className="text-xs text-muted-foreground block">
                                Total Amount Paid / Due:
                              </span>
                              <span className="text-lg font-extrabold text-foreground">
                                {formatNPR(order.total)}
                              </span>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-xs font-mono text-muted-foreground">
                                  Code: {order.trackingCode}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyCode(order.trackingCode)
                                  }
                                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Copy tracking code"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 flex flex-col gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleReorder(order)}
                                className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                1-Click Reorder
                              </Button>

                              <div className="grid grid-cols-3 gap-1.5">
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs px-1 gap-1"
                                >
                                  <Link
                                    to="/track/$code"
                                    params={{ code: order.trackingCode }}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Track
                                  </Link>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs px-1 gap-1 cursor-pointer"
                                  onClick={() => setSelectedReceiptOrder(order)}
                                >
                                  <Printer className="h-3 w-3" />
                                  Receipt
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs px-1 gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() =>
                                    handleOpenTicketForOrder(order)
                                  }
                                  title="File a support ticket for this order"
                                >
                                  <HelpCircle className="h-3 w-3" />
                                  Help
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Support Tickets Tab Content */}
            <TabsContent value="tickets" className="space-y-4 m-0">
              {complaints.length === 0 ? (
                <Card className="border-border p-10 text-center max-w-lg mx-auto">
                  <LifeBuoy className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <h3 className="text-base font-bold text-foreground">
                    No Support Tickets Filed
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Have questions regarding a delivery, damaged items, or
                    payments? File a support ticket anytime and our dispatch
                    team in Butwal will resolve it.
                  </p>
                  <div className="mt-5">
                    <Button
                      size="sm"
                      onClick={handleOpenGeneralTicket}
                      className="text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Support Ticket
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {complaints.map((comp) => {
                    const isResolved = comp.status === 'resolved'
                    const isInProgress = comp.status === 'in_progress'
                    return (
                      <Card key={comp.id} className="border-border shadow-xs">
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">
                                  {comp.subject}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs uppercase font-semibold px-2 py-0.5',
                                    isResolved
                                      ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                                      : isInProgress
                                        ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                                        : 'border-blue-500 text-blue-500 bg-blue-500/10',
                                  )}
                                >
                                  {comp.status === 'in_progress'
                                    ? 'In Progress'
                                    : comp.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span className="font-mono">
                                  Ticket #{comp.id}
                                </span>
                                <span>&bull;</span>
                                <span>
                                  {new Date(
                                    comp.createdAt,
                                  ).toLocaleDateString()}
                                </span>
                                {comp.orderNumber && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="font-semibold text-foreground">
                                      Order #{comp.orderNumber}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-foreground bg-muted/30 p-3 rounded-lg border border-border/40 whitespace-pre-wrap leading-relaxed">
                            {comp.body}
                          </div>

                          <div className="text-xs flex items-center gap-1.5 text-muted-foreground pt-1">
                            {isResolved ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>
                                  Ticket resolved. Thank you for contacting
                                  support!
                                </span>
                              </>
                            ) : isInProgress ? (
                              <>
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                <span>
                                  Support agent assigned. Investigating order
                                  and contacting courier.
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                                <span>
                                  Ticket submitted and awaiting review by
                                  support dispatch.
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Order Receipt Modal */}
        {selectedReceiptOrder && (
          <Dialog
            open={Boolean(selectedReceiptOrder)}
            onOpenChange={(open) => {
              if (!open) setSelectedReceiptOrder(null)
            }}
          >
            <DialogContent className="max-w-md p-6 font-mono text-xs">
              <DialogHeader className="text-center pb-2 border-b border-border">
                <DialogTitle className="text-base font-extrabold tracking-wider uppercase">
                  MEZMANI NEPAL
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Express Sourcing &amp; Delivery &bull; Butwal, Rupandehi
                </p>
                <p className="text-xs text-muted-foreground">
                  VAT Reg: 609823145 &bull; Ph: +977-9802088800
                </p>
              </DialogHeader>

              <div className="py-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Invoice / Order:</span>
                  <span className="font-bold font-mono">
                    #{selectedReceiptOrder.number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tracking Code:</span>
                  <span className="font-mono">
                    {selectedReceiptOrder.trackingCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>
                    {new Date(selectedReceiptOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{selectedReceiptOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Address:</span>
                  <span className="text-right max-w-[200px] truncate">
                    {selectedReceiptOrder.address}, {selectedReceiptOrder.city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="uppercase font-semibold">
                    {selectedReceiptOrder.paymentMethod} (
                    {selectedReceiptOrder.paymentStatus})
                  </span>
                </div>

                <Separator className="my-2" />

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-xs border-b pb-1">
                    <span>ITEM</span>
                    <span>TOTAL</span>
                  </div>
                  {selectedReceiptOrder.items.map((it) => (
                    <div key={it.id} className="flex justify-between py-0.5">
                      <span className="truncate pr-2">
                        {it.name} ({it.variantName}) × {it.qty}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {formatNPR(it.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="my-2" />

                <div className="space-y-1 text-right">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>{formatNPR(selectedReceiptOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery:</span>
                    <span>
                      {selectedReceiptOrder.deliveryCharge === 0
                        ? 'FREE'
                        : formatNPR(selectedReceiptOrder.deliveryCharge)}
                    </span>
                  </div>
                  {selectedReceiptOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-{formatNPR(selectedReceiptOrder.discount)}</span>
                    </div>
                  )}
                  {selectedReceiptOrder.tax > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Included VAT (13%):</span>
                      <span>{formatNPR(selectedReceiptOrder.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold pt-1 border-t">
                    <span>GRAND TOTAL:</span>
                    <span>{formatNPR(selectedReceiptOrder.total)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  className="w-full text-xs gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Customer Slip
                </Button>
                <Button
                  variant="outline"
                  className="text-xs"
                  onClick={() => setSelectedReceiptOrder(null)}
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Support Ticket Submission Modal */}
        <Dialog
          open={isTicketModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsTicketModalOpen(false)
              setTicketOrder(null)
            }
          }}
        >
          <DialogContent className="max-w-md p-6">
            <DialogHeader className="p-0 pb-3">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-primary" />
                {ticketOrder
                  ? `Support for Order #${ticketOrder.number}`
                  : 'Submit Support Ticket'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {ticketOrder
                  ? 'Let us know what went wrong with this delivery and our dispatch team in Butwal will resolve it.'
                  : 'Send our customer support and dispatch team a message regarding your account or drinks delivery.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs py-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="ticket-category"
                  className="text-xs font-semibold"
                >
                  Issue Category
                </Label>
                <select
                  id="ticket-category"
                  value={ticketCategory}
                  onChange={(e) => {
                    const cat = e.target.value
                    setTicketCategory(cat)
                    if (!ticketOrder) {
                      setTicketSubject(cat)
                    }
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="Delivery Delay">
                    Delivery Delay / Taking Too Long
                  </option>
                  <option value="Missing or Wrong Item">
                    Missing or Incorrect Item
                  </option>
                  <option value="Damaged Goods">
                    Damaged or Broken Bottle / Can
                  </option>
                  <option value="Payment or Refund">
                    Payment or eSewa Refund Query
                  </option>
                  <option value="Rider Contact">
                    Rider Unreachable / Delivery Issue
                  </option>
                  <option value="General Inquiry">
                    General Question / Account Inquiry
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="ticket-subject"
                  className="text-xs font-semibold"
                >
                  Subject
                </Label>
                <Input
                  id="ticket-subject"
                  placeholder="e.g. Broken bottle during transit"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-body" className="text-xs font-semibold">
                  Detailed Description
                </Label>
                <textarea
                  id="ticket-body"
                  rows={4}
                  placeholder="Please describe what happened in detail so we can investigate and assist you immediately..."
                  value={ticketBody}
                  onChange={(e) => setTicketBody(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <DialogFooter className="p-0 pt-3 flex items-center justify-end gap-2 border-t border-border mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmittingTicket}
                onClick={() => setIsTicketModalOpen(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmittingTicket}
                onClick={handleSubmitTicket}
                className="text-xs font-semibold bg-primary text-primary-foreground cursor-pointer"
              >
                {isSubmittingTicket ? 'Submitting...' : 'Submit Support Ticket'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  )
}
