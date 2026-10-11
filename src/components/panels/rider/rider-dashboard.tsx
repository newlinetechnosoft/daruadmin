import { useState } from 'react'
import { useRouter, Link } from '@tanstack/react-router'
import {
  updateRiderDeliveryStatusFn,
  toggleRiderAvailabilityFn,
} from '#/server/operations/operations.functions'
import type { Rider, Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import {
  Bike,
  Package,
  Phone,
  MapPin,
  CheckCircle2,
  Wallet,
  Coins,
  ArrowRight,
  Power,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'

interface RiderDashboardProps {
  data: {
    rider: Rider
    orders: Order[]
    activeOrders: Order[]
    completedOrders: Order[]
    stats: {
      totalAssigned: number
      activeCount: number
      completedCount: number
      cashOnHand: number
      earnings: number
      deliveries: number
      rating: number
    }
  }
}

export function RiderDashboard({ data }: RiderDashboardProps) {
  const router = useRouter()
  const { rider, activeOrders, stats } = data
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [isTogglingAvail, setIsTogglingAvail] = useState(false)

  const handleToggleOnline = async () => {
    try {
      setIsTogglingAvail(true)
      const newStatus = !rider.available
      await toggleRiderAvailabilityFn({ data: { available: newStatus } })
      toast.success(newStatus ? 'You are now ONLINE' : 'You are now OFFLINE')
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status')
    } finally {
      setIsTogglingAvail(false)
    }
  }

  const handleUpdateStatus = async (
    orderId: string,
    status: 'out_for_delivery' | 'delivered',
  ) => {
    try {
      setUpdatingOrderId(orderId)
      await updateRiderDeliveryStatusFn({
        data: {
          orderId,
          status,
        },
      })
      toast.success(
        status === 'delivered'
          ? 'Delivery completed! COD collected & earnings credited.'
          : 'Order marked out for delivery!',
      )
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update order')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Rider Status Card */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">{rider.name}</h2>
                <Badge
                  variant={rider.available ? 'default' : 'secondary'}
                  className="text-[11px]"
                >
                  {rider.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Zone: <span className="text-foreground font-medium">{rider.zone}</span> • Vehicle:{' '}
                <span className="text-foreground font-medium capitalize">{rider.vehicle}</span> ({rider.licenseNo})
              </p>
            </div>
          </div>

          <Button
            variant={rider.available ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggleOnline}
            disabled={isTogglingAvail}
            className="w-full sm:w-auto h-9 gap-2 text-xs"
          >
            <Power className="h-3.5 w-3.5" />
            {rider.available ? 'Go Offline' : 'Go Online'}
          </Button>
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Active Deliveries</span>
              <Truck className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {stats.activeCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Pending delivery</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Completed Today</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {stats.completedCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Total deliveries</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cash in Hand (COD)</span>
              <Wallet className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatNPR(stats.cashOnHand)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Pending handover</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Earned Commission</span>
              <Coins className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatNPR(stats.earnings)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{rider.commissionRate}% rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Orders Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Assigned Deliveries</h3>
            <p className="text-xs text-muted-foreground">Orders ready for pickup or on route</p>
          </div>
          <Link
            to="/rider/deliveries"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
          >
            View all deliveries <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {activeOrders.length === 0 ? (
          <Card className="border-border border-dashed bg-card/50">
            <CardContent className="p-8 text-center space-y-2">
              <Package className="h-8 w-8 text-muted-foreground mx-auto" />
              <h4 className="text-xs font-semibold text-foreground">No active deliveries right now</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {rider.available
                  ? 'Keep app open and wait for dispatch to assign orders in your zone.'
                  : 'You are currently offline. Turn on your status above to receive delivery orders.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((order) => {
              const isOut = order.status === 'out_for_delivery'
              const isCOD = order.paymentMethod === 'cod'
              const isUpdating = updatingOrderId === order.id

              return (
                <Card key={order.id} className="border-border bg-card flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {order.number}
                          </span>
                          <Badge
                            variant={isOut ? 'default' : 'secondary'}
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
                        <div className="text-[10px] text-muted-foreground">
                          {isCOD ? (
                            <span className="text-amber-500 font-semibold">Collect COD</span>
                          ) : (
                            <span className="text-emerald-500 font-medium">Prepaid ({order.paymentMethod})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5 text-xs">
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
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-muted-foreground font-medium">
                        Items ({order.items.reduce((sum, it) => sum + it.qty, 0)}):
                      </div>
                      <ul className="text-xs text-foreground space-y-0.5 pl-2 border-l border-border">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex justify-between text-[11px]">
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
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.city}`)}`}
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

                      {!isOut ? (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                          disabled={isUpdating}
                          className="h-8 text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Truck className="h-3.5 w-3.5 mr-1" />
                          {isUpdating ? 'Updating...' : 'Start Delivery'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(order.id, 'delivered')}
                          disabled={isUpdating}
                          className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {isUpdating ? 'Saving...' : isCOD ? 'Delivered & Collect' : 'Mark Delivered'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
