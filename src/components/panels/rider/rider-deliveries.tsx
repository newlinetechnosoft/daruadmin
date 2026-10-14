import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { updateRiderDeliveryStatusFn } from '#/server/operations/operations.functions'
import { queueOutboxAction } from '#/lib/idb/outbox'
import type { Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Package, Phone, MapPin, CheckCircle2, Truck } from 'lucide-react'
import { toast } from 'sonner'

interface RiderDeliveriesProps {
  orders: Order[]
}

export function RiderDeliveries({ orders }: RiderDeliveriesProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active')
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  const activeOrders = orders.filter((o) =>
    ['assigned', 'out_for_delivery'].includes(o.status),
  )
  const completedOrders = orders.filter((o) => o.status === 'delivered')

  const displayedOrders =
    filter === 'active'
      ? activeOrders
      : filter === 'completed'
        ? completedOrders
        : orders

  const handleUpdateStatus = async (
    orderId: string,
    status: 'out_for_delivery' | 'delivered',
  ) => {
    try {
      setUpdatingOrderId(orderId)

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueOutboxAction('delivery_status', { orderId, status })
        toast.info(
          status === 'delivered'
            ? 'Saved offline! Status & cash queued.'
            : 'Saved offline!',
        )
        return
      }

      await updateRiderDeliveryStatusFn({
        data: {
          orderId,
          status,
        },
      })
      toast.success(
        status === 'delivered'
          ? 'Delivery completed! Cash on hand updated.'
          : 'Delivery started!',
      )
      await router.invalidate()
    } catch (err: any) {
      if (
        !navigator.onLine ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('Network')
      ) {
        await queueOutboxAction('delivery_status', { orderId, status })
        toast.info('Network failed. Saved offline to outbox.')
      } else {
        toast.error(err?.message || 'Failed to update order status')
      }
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Delivery Orders
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your assigned parcels and complete customer deliveries
          </p>
        </div>

        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 w-full sm:w-auto h-8">
            <TabsTrigger value="active" className="text-xs">
              Active ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              Done ({completedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All ({orders.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {displayedOrders.length === 0 ? (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="p-12 text-center space-y-2">
            <Package className="h-8 w-8 text-muted-foreground mx-auto" />
            <h4 className="text-xs font-semibold text-foreground">
              No deliveries in this tab
            </h4>
            <p className="text-xs text-muted-foreground">
              New deliveries assigned to your rider profile will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedOrders.map((order) => {
            const isDelivered = order.status === 'delivered'
            const isOut = order.status === 'out_for_delivery'
            const isCOD = order.paymentMethod === 'cod'
            const isUpdating = updatingOrderId === order.id

            return (
              <Card
                key={order.id}
                className={`border-border bg-card flex flex-col justify-between ${
                  isDelivered ? 'opacity-75' : ''
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {order.number}
                        </span>
                        <Badge
                          variant={
                            isDelivered
                              ? 'secondary'
                              : isOut
                                ? 'default'
                                : 'outline'
                          }
                          className="text-[10px] uppercase tracking-wider"
                        >
                          {order.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-foreground mt-1">
                        {order.customerName}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {formatNPR(order.total)}
                      </span>
                      <div className="text-[10px]">
                        {isCOD ? (
                          <span className="text-warning font-semibold">
                            Collect COD
                          </span>
                        ) : (
                          <span className="text-success font-medium">
                            Prepaid ({order.paymentMethod})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1 text-xs">
                    <div className="flex items-start gap-2 text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span>
                        {order.address}, {order.city}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {order.customerPhone}
                      </a>
                    </div>
                    {order.notes && (
                      <div className="pt-1 text-[11px] text-muted-foreground italic border-t border-border mt-1">
                        Note: {order.notes}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground font-medium">
                      Items ({order.items.reduce((sum, it) => sum + it.qty, 0)}
                      ):
                    </div>
                    <ul className="text-xs text-foreground space-y-0.5 pl-2 border-l border-border">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between text-[11px]"
                        >
                          <span>
                            {item.qty}x {item.name}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatNPR(item.lineTotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs flex-1"
                    >
                      <a
                        href={getGoogleMapsUrl(order)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        Map
                      </a>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs flex-1"
                    >
                      <a href={`tel:${order.customerPhone}`}>
                        <Phone className="h-3.5 w-3.5 mr-1" />
                        Call
                      </a>
                    </Button>

                    {!isDelivered && (
                      <>
                        {!isOut ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleUpdateStatus(order.id, 'out_for_delivery')
                            }
                            disabled={isUpdating}
                            className="h-8 text-xs flex-1 bg-info hover:bg-info/90 text-info-foreground"
                          >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            {isUpdating ? 'Updating...' : 'Start'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleUpdateStatus(order.id, 'delivered')
                            }
                            disabled={isUpdating}
                            className="h-8 text-xs flex-1 bg-success hover:bg-success/90 text-success-foreground"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {isUpdating
                              ? 'Saving...'
                              : isCOD
                                ? 'Collect & Complete'
                                : 'Complete'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
