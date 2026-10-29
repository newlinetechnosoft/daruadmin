import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { riderQueries } from '#/queries/rider'
import {
  updateRiderDeliveryStatusFn,
  toggleRiderAvailabilityFn,
} from '#/server/operations/operations.functions'
import type { getRiderPortalFn } from '#/server/operations/operations.functions'
import {
  queueOutboxAction,
  useRiderOutbox,
  flushOutboxQueue,
} from '#/lib/idb/outbox'
import { useOnlineStatus, isNetworkError } from '#/hooks/use-online-status'
import type { Rider, Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { getGoogleMapsUrl } from '#/lib/map-config'
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
  CloudOff,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wifi,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { RiderDealerPickups } from './rider-dealer-pickups'
import { DeliveryProofDialog } from './delivery-proof-dialog'

type RiderPortalData = Awaited<ReturnType<typeof getRiderPortalFn>>

export interface RiderDashboardProps {
  data?: {
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
      rating: number | string
    }
  }
}

export function RiderDashboard({
  data: _fallbackData,
}: RiderDashboardProps = {}) {
  const queryClient = useQueryClient()
  const { data: portalData } = useSuspenseQuery(riderQueries.portal())

  const { isOnline, isReconnecting } = useOnlineStatus()
  const { pendingActions } = useRiderOutbox()

  // Track in-flight actions per order to prevent clobbering and double-taps
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set())
  const [isTogglingAvail, setIsTogglingAvail] = useState(false)
  const [deliveringOrder, setDeliveringOrder] = useState<any | null>(null)

  // Map pending offline outbox delivery actions by orderId
  const pendingDeliveryActionsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        targetStatus: 'out_for_delivery' | 'delivered'
        actionStatus: 'pending' | 'syncing' | 'failed'
        retries: number
      }
    >()
    for (const action of pendingActions) {
      if (action.type === 'delivery_status' && action.payload?.orderId) {
        map.set(action.payload.orderId, {
          targetStatus: action.payload.status,
          actionStatus: action.status,
          retries: action.retries,
        })
      }
    }
    return map
  }, [pendingActions])

  const { rider, orders } = portalData

  // Derive active and completed orders from the current cache
  const activeOrders = useMemo(() => {
    return orders.filter((o) =>
      ['assigned', 'rider_assigned', 'picked_up', 'out_for_delivery'].includes(
        o.status,
      ),
    )
  }, [orders])

  const completedOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'delivered')
  }, [orders])

  // Derive stats directly from cache data so numbers never drift from the order list
  const derivedStats = useMemo(() => {
    return {
      activeCount: activeOrders.length,
      completedCount: completedOrders.length,
      cashOnHand: rider.cashOnHand,
      earnings: rider.earnings,
      deliveries: rider.deliveries,
      rating: rider.rating,
    }
  }, [
    activeOrders.length,
    completedOrders.length,
    rider.cashOnHand,
    rider.earnings,
    rider.deliveries,
    rider.rating,
  ])

  // Availability toggle with optimistic write, rollback, and honest feedback
  const handleToggleOnline = async () => {
    if (!isOnline) {
      toast.error(
        'Cannot change availability while offline. Connect to internet first.',
      )
      return
    }

    if (isTogglingAvail) return

    const targetAvailable = !rider.available
    setIsTogglingAvail(true)

    // Cancel in-flight queries before optimistic write
    await queryClient.cancelQueries({
      queryKey: riderQueries.portal().queryKey,
    })

    // Snapshot current cache state
    const previousData = queryClient.getQueryData<RiderPortalData>(
      riderQueries.portal().queryKey,
    )

    // Optimistically update query cache
    queryClient.setQueryData<RiderPortalData>(
      riderQueries.portal().queryKey,
      (old) => {
        if (!old) return old
        return {
          ...old,
          rider: {
            ...old.rider,
            available: targetAvailable,
            status: targetAvailable ? 'available' : 'offline',
          },
        }
      },
    )

    try {
      await toggleRiderAvailabilityFn({ data: { available: targetAvailable } })
      toast.success(
        targetAvailable ? 'You are now ONLINE' : 'You are now OFFLINE',
      )
    } catch (err: unknown) {
      // Rollback to snapshot on failure
      if (previousData) {
        queryClient.setQueryData(riderQueries.portal().queryKey, previousData)
      }
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to update availability'
      toast.error(errorMsg, {
        action: {
          label: 'Retry',
          onClick: () => {
            void handleToggleOnline()
          },
        },
      })
    } finally {
      setIsTogglingAvail(false)
      // Targeted reconciliation refetch
      void queryClient.invalidateQueries({
        queryKey: riderQueries.portal().queryKey,
      })
    }
  }

  // Delivery status transitions: Start Delivery and Mark Delivered
  const handleUpdateStatus = async (
    orderId: string,
    targetStatus: 'out_for_delivery' | 'delivered',
  ) => {
    // Double-tap and duplicate action guards
    if (pendingOrderIds.has(orderId)) return

    if (pendingDeliveryActionsMap.has(orderId)) {
      toast.info(
        'This delivery action is already saved on this device and waiting to sync.',
      )
      return
    }

    const currentOrder = orders.find((o) => o.id === orderId)
    if (!currentOrder) return

    // Guard against duplicate or invalid transitions
    if (
      targetStatus === 'out_for_delivery' &&
      currentOrder.status !== 'rider_assigned' &&
      currentOrder.status !== 'picked_up'
    ) {
      return
    }
    if (
      targetStatus === 'delivered' &&
      currentOrder.status !== 'out_for_delivery'
    ) {
      return
    }

    // Offline queue branch
    if (!isOnline) {
      await queueOutboxAction('delivery_status', {
        orderId,
        status: targetStatus,
      })
      toast.info("Saved on this device. Will sync when you're online.")
      return
    }

    // Online branch: optimistic update, server dispatch, rollback on error
    setPendingOrderIds((prev) => new Set(prev).add(orderId))

    await queryClient.cancelQueries({
      queryKey: riderQueries.portal().queryKey,
    })
    const previousData = queryClient.getQueryData<RiderPortalData>(
      riderQueries.portal().queryKey,
    )

    // Optimistically update cache
    queryClient.setQueryData<RiderPortalData>(
      riderQueries.portal().queryKey,
      (old) => {
        if (!old) return old
        const orderToUpdate = old.orders.find((o) => o.id === orderId)
        if (!orderToUpdate) return old

        if (targetStatus === 'out_for_delivery') {
          const updatedOrders = old.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'out_for_delivery' as const,
                  updatedAt: new Date().toISOString(),
                }
              : o,
          )
          return {
            ...old,
            orders: updatedOrders,
            activeOrders: updatedOrders.filter((o) =>
              ['assigned', 'out_for_delivery'].includes(o.status),
            ),
            rider: {
              ...old.rider,
              status: 'busy',
            },
          }
        } else {
          // Delivered: calculate commission and cash on hand
          const commission = Math.round(
            orderToUpdate.deliveryCharge * (old.rider.commissionRate / 100),
          )
          const isCOD =
            orderToUpdate.paymentMethod === 'cod' &&
            orderToUpdate.paymentStatus !== 'paid'
          const newCashOnHand = isCOD
            ? old.rider.cashOnHand + orderToUpdate.total
            : old.rider.cashOnHand
          const newEarnings = old.rider.earnings + commission
          const newDeliveries = old.rider.deliveries + 1

          const updatedOrders = old.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'delivered' as const,
                  paymentStatus: isCOD ? ('paid' as const) : o.paymentStatus,
                  updatedAt: new Date().toISOString(),
                }
              : o,
          )

          const newActive = updatedOrders.filter((o) =>
            ['assigned', 'out_for_delivery'].includes(o.status),
          )
          const newCompleted = updatedOrders.filter(
            (o) => o.status === 'delivered',
          )

          return {
            ...old,
            orders: updatedOrders,
            activeOrders: newActive,
            completedOrders: newCompleted,
            rider: {
              ...old.rider,
              deliveries: newDeliveries,
              cashOnHand: newCashOnHand,
              earnings: newEarnings,
              status:
                newActive.length > 0
                  ? 'busy'
                  : old.rider.available
                    ? 'available'
                    : 'offline',
            },
            stats: {
              ...old.stats,
              activeCount: newActive.length,
              completedCount: newCompleted.length,
              cashOnHand: newCashOnHand,
              earnings: newEarnings,
              deliveries: newDeliveries,
            },
          }
        }
      },
    )

    try {
      await updateRiderDeliveryStatusFn({
        data: {
          orderId,
          status: targetStatus,
        },
      })

      if (targetStatus === 'delivered') {
        toast.success(
          'Delivery completed. COD collected and earnings credited.',
        )
      } else {
        toast.success('Delivery started. Order is now out for delivery.')
      }
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        // Roll back optimistic cache and queue offline
        if (previousData) {
          queryClient.setQueryData(riderQueries.portal().queryKey, previousData)
        }
        await queueOutboxAction('delivery_status', {
          orderId,
          status: targetStatus,
        })
        toast.info("Saved on this device. Will sync when you're online.")
      } else {
        // Real validation / auth error: roll back and notify user with retry
        if (previousData) {
          queryClient.setQueryData(riderQueries.portal().queryKey, previousData)
        }
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to update order status'
        toast.error(errorMsg, {
          action: {
            label: 'Retry',
            onClick: () => {
              void handleUpdateStatus(orderId, targetStatus)
            },
          },
        })
      }
    } finally {
      setPendingOrderIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
      // Settle cache with targeted invalidation
      void queryClient.invalidateQueries({
        queryKey: riderQueries.portal().queryKey,
      })
    }
  }

  const handleConfirmDelivery = async ({
    orderId,
    ageVerifiedAtDelivery,
    deliveryOtp,
    proofPhotoUrl,
    notes,
  }: {
    orderId: string
    ageVerifiedAtDelivery: boolean
    deliveryOtp?: string
    proofPhotoUrl?: string
    notes?: string
  }) => {
    try {
      setPendingOrderIds((prev) => new Set(prev).add(orderId))

      if (!isOnline) {
        await queueOutboxAction('delivery_status', {
          orderId,
          status: 'delivered',
        })
        toast.info("Saved on this device. Will sync when you're online.")
        return
      }

      await updateRiderDeliveryStatusFn({
        data: {
          orderId,
          status: 'delivered',
          ageVerifiedAtDelivery,
          deliveryOtp,
          proofPhotoUrl,
          notes,
        },
      })
      toast.success('Delivery completed with proof! Cash & earnings updated.')
      await queryClient.invalidateQueries({
        queryKey: riderQueries.portal().queryKey,
      })
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to complete delivery',
      )
      throw err
    } finally {
      setPendingOrderIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }

  return (
    <div className="space-y-6 pb-12 transition-colors duration-200">
      {/* Connectivity Status Banners */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3.5 rounded-lg border border-warning/30 bg-warning/10 text-warning text-xs font-medium motion-reduce:transition-none"
        >
          <div className="flex items-center gap-2.5">
            <CloudOff className="h-4 w-4 shrink-0 text-warning" />
            <span>
              No internet connection. Changes are saved on this device and will
              sync when you're back online.
            </span>
          </div>
          {pendingActions.length > 0 && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-warning/20 shrink-0">
              {pendingActions.length} saved action(s)
            </span>
          )}
        </div>
      )}

      {isOnline && isReconnecting && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 p-3 rounded-lg border border-info/30 bg-info/10 text-info text-xs font-medium motion-reduce:transition-none"
        >
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          <span>Back online, syncing offline queue…</span>
        </div>
      )}

      {/* Rider Status Card with Distinct Availability & Connectivity Signals */}
      <Card
        className={`border transition-all duration-300 motion-reduce:transition-none ${
          rider.available
            ? 'border-emerald-300/60 bg-gradient-to-r from-emerald-100 to-emerald-50/30 dark:border-emerald-500/30 dark:from-emerald-950/70 dark:to-emerald-950/10'
            : 'border-border bg-card'
        }`}
      >
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                rider.available
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Bike className="h-6 w-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {rider.name}
                </h2>

                {/* Availability Badge: Always Dot + Text */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    rider.available
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      rider.available
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-muted-foreground/60'
                    }`}
                  />
                  <span>
                    {rider.available
                      ? rider.status === 'busy'
                        ? 'Online (Busy)'
                        : 'Online'
                      : 'Offline'}
                  </span>
                </span>

                {/* Connectivity Badge: Distinct from Availability */}
                {!isOnline ? (
                  <Badge
                    variant="outline"
                    className="text-xs py-0 px-2 border-warning/40 text-warning bg-warning/10 gap-1 font-normal"
                  >
                    <CloudOff className="h-2.5 w-2.5" />
                    Offline Device
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs py-0 px-2 border-border text-muted-foreground gap-1 font-normal hidden sm:inline-flex"
                  >
                    <Wifi className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    Connected
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-1">
                Zone:{' '}
                <span className="text-foreground font-medium">
                  {rider.zone}
                </span>{' '}
                • Vehicle:{' '}
                <span className="text-foreground font-medium capitalize">
                  {rider.vehicle}
                </span>{' '}
                ({rider.licenseNo})
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {portalData.activeShift ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <Clock className="h-3 w-3" />
                    <span>
                      Shift active since{' '}
                      {new Date(
                        portalData.activeShift.startedAt,
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                ) : null}
                {portalData.attendanceStats ? (
                  <span className="text-xs text-muted-foreground font-mono">
                    {portalData.attendanceStats.totalHours}h logged (
                    {portalData.attendanceStats.totalShifts} shifts)
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto flex flex-col items-end gap-1">
            <Button
              variant={rider.available ? 'outline' : 'default'}
              size="sm"
              onClick={() => {
                void handleToggleOnline()
              }}
              disabled={isTogglingAvail || !isOnline}
              title={
                !isOnline
                  ? 'Cannot change availability while offline'
                  : rider.available
                    ? 'Switch off dispatch orders'
                    : 'Start receiving orders'
              }
              className={`w-full sm:w-auto h-10 sm:h-9 min-h-[44px] sm:min-h-0 gap-2 text-xs font-medium transition-all ${
                !isOnline ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isTogglingAvail ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
              {isTogglingAvail
                ? 'Updating...'
                : rider.available
                  ? 'Go Offline'
                  : 'Go Online'}
            </Button>

            {!isOnline && (
              <span className="text-xs text-muted-foreground">
                Reconnect to change availability
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Grid with Tabular Numbers and Consistent Copy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Deliveries */}
        <Card className="border-border bg-card transition-colors hover:border-info/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Active Deliveries
              </span>
              <div className="h-7 w-7 rounded-md bg-info/10 text-info flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums transition-all">
              {derivedStats.activeCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              In transit & assigned
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Completed Deliveries */}
        <Card className="border-border bg-card transition-colors hover:border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Completed Deliveries
              </span>
              <div className="h-7 w-7 rounded-md bg-success/10 text-success flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums transition-all">
              {derivedStats.completedCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total completed
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Cash in Hand (COD) */}
        <Card className="border-border bg-card transition-colors hover:border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Cash in Hand (COD)
              </span>
              <div className="h-7 w-7 rounded-md bg-warning/10 text-warning flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums transition-all">
              {formatNPR(derivedStats.cashOnHand)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending handover
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Earned Commission */}
        <Card className="border-border bg-card transition-colors hover:border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Earned Commission
              </span>
              <div className="h-7 w-7 rounded-md bg-success/10 text-success flex items-center justify-center">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums transition-all">
              {formatNPR(derivedStats.earnings)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {rider.commissionRate}% commission rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Orders Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Assigned Deliveries
            </h3>
            <p className="text-xs text-muted-foreground">
              Orders ready for pickup or on route
            </p>
          </div>
          <Link
            to="/rider/deliveries"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium min-h-[32px] px-1"
          >
            View all deliveries <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {activeOrders.length === 0 ? (
          <Card className="border-border border-dashed bg-card/50">
            <CardContent className="p-8 text-center space-y-2.5">
              {!isOnline ? (
                <>
                  <CloudOff className="h-8 w-8 text-warning mx-auto" />
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    No internet connection
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    You are currently offline. Active deliveries may not be up
                    to date until your device reconnects.
                  </p>
                </>
              ) : !rider.available ? (
                <>
                  <Power className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    You are currently offline
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Turn on your availability above to start receiving delivery
                    assignments in your zone.
                  </p>
                </>
              ) : (
                <>
                  <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    Waiting for dispatch
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    You are online and ready for deliveries. Keep the app open
                    and orders in your zone will appear here as soon as dispatch
                    assigns them.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((order) => {
              const pendingSync = pendingDeliveryActionsMap.get(order.id)
              const isUpdating = pendingOrderIds.has(order.id)

              return (
                <OrderDeliveryCard
                  key={order.id}
                  order={order}
                  pendingSync={pendingSync}
                  isUpdating={isUpdating}
                  onUpdateStatus={handleUpdateStatus}
                  onOpenDeliveryProof={setDeliveringOrder}
                />
              )
            })}
          </div>
        )}
      </div>

      <DeliveryProofDialog
        order={deliveringOrder}
        isOpen={Boolean(deliveringOrder)}
        onClose={() => setDeliveringOrder(null)}
        onConfirmDelivery={handleConfirmDelivery}
        isSubmitting={Boolean(
          deliveringOrder && pendingOrderIds.has(deliveringOrder.id),
        )}
      />
    </div>
  )
}

/**
 * Isolated Order Card sub-component for crisp hierarchy, collapsible item lists,
 * and distinct pending sync states.
 */
interface OrderDeliveryCardProps {
  order: Order
  pendingSync?: {
    targetStatus: 'out_for_delivery' | 'delivered'
    actionStatus: 'pending' | 'syncing' | 'failed'
    retries: number
  }
  isUpdating: boolean
  onUpdateStatus: (
    orderId: string,
    targetStatus: 'out_for_delivery' | 'delivered',
  ) => Promise<void>
  onOpenDeliveryProof?: (order: Order) => void
}

function OrderDeliveryCard({
  order,
  pendingSync,
  isUpdating,
  onUpdateStatus,
  onOpenDeliveryProof,
}: OrderDeliveryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const isOut = order.status === 'out_for_delivery'
  const isCOD = order.paymentMethod === 'cod'
  const totalItemCount = order.items.reduce((sum, it) => sum + it.qty, 0)

  // Show first 2 items collapsed, or all if 2 or fewer
  const displayedItems = isExpanded ? order.items : order.items.slice(0, 2)
  const hasMoreItems = order.items.length > 2

  return (
    <Card
      className={`border bg-card flex flex-col justify-between transition-all duration-300 motion-reduce:transition-none hover:shadow-sm ${
        pendingSync
          ? 'border-warning/40 bg-warning/[0.02]'
          : isOut
            ? 'border-info/30'
            : 'border-border'
      }`}
    >
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          {/* Top Hierarchy: Order # and Status Badge */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-foreground tracking-tight">
                {order.number}
              </span>

              {/* Status Badge */}
              <Badge
                variant={isOut ? 'default' : 'secondary'}
                className={`text-xs uppercase tracking-wider font-semibold ${
                  isOut
                    ? 'bg-info hover:bg-info/90 text-info-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isOut ? (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Out for delivery
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Assigned
                  </span>
                )}
              </Badge>

              {/* Distinct Offline Queued Tag */}
              {pendingSync && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                    pendingSync.actionStatus === 'failed'
                      ? 'bg-destructive/15 text-destructive border-destructive/30'
                      : 'bg-warning/15 text-warning border-warning/30'
                  }`}
                  title={
                    pendingSync.actionStatus === 'failed'
                      ? `Sync failed (${pendingSync.retries} retries). Tap to retry.`
                      : 'Saved on device, waiting to sync'
                  }
                >
                  {pendingSync.actionStatus === 'failed' ? (
                    <>
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Sync failed
                    </>
                  ) : (
                    <>
                      <Clock className="h-2.5 w-2.5 animate-pulse" />
                      Saved on device, waiting to sync
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Customer Name */}
            <p className="text-sm font-semibold text-foreground mt-1.5">
              {order.customerName}
            </p>
          </div>

          {/* Amount & COD vs Prepaid Treatment */}
          <div className="text-right shrink-0">
            <span className="font-mono text-sm font-bold text-foreground tabular-nums block">
              {formatNPR(order.total)}
            </span>
            <div className="mt-1">
              {isCOD ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                  <Coins className="h-2.5 w-2.5" />
                  Collect {formatNPR(order.total)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Paid ({order.paymentMethod})
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3.5">
        {/* Dealer Pickup Stations */}
        <RiderDealerPickups order={order} />

        {/* Customer Drop-off Destination */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary" />
            <span>Customer Drop-off Destination:</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border/80 space-y-2 text-xs">
            <div className="flex items-start gap-2.5 text-foreground">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="leading-snug">
                {order.address}, {order.city}
                {order.landmark ? ` (${order.landmark})` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a
                href={`tel:${order.customerPhone}`}
                className="font-mono text-primary hover:underline font-medium"
              >
                {order.customerPhone}
              </a>
            </div>
          </div>
        </div>

        {/* Collapsible Items List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Items ({totalItemCount}):</span>
            {hasMoreItems && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-primary hover:underline flex items-center gap-0.5 text-xs cursor-pointer"
              >
                <span>
                  {isExpanded ? 'Show less' : `+${order.items.length - 2} more`}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          <ul className="text-xs text-foreground space-y-1 pl-2.5 border-l-2 border-border/70">
            {displayedItems.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center text-xs"
              >
                <span className="truncate pr-2">
                  <span className="font-semibold text-foreground/80">
                    {item.qty}x
                  </span>{' '}
                  {item.name}
                </span>
                <span className="font-mono text-muted-foreground tabular-nums shrink-0">
                  {formatNPR(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons: Responsive Layout with >= 44px Touch Targets */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Secondary Actions: Map and Call (>= 44px touch targets) */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-11 min-h-[44px] min-w-[44px] px-3 text-xs flex-1 sm:flex-initial"
            >
              <a
                href={getGoogleMapsUrl(order)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open delivery location in Google Maps"
              >
                <MapPin className="h-4 w-4 mr-1.5 sm:mr-0 md:mr-1.5 text-muted-foreground" />
                <span className="sm:hidden md:inline">Map</span>
              </a>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-11 min-h-[44px] min-w-[44px] px-3 text-xs flex-1 sm:flex-initial"
            >
              <a
                href={`tel:${order.customerPhone}`}
                aria-label={`Call customer ${order.customerName}`}
              >
                <Phone className="h-4 w-4 mr-1.5 sm:mr-0 md:mr-1.5 text-muted-foreground" />
                <span className="sm:hidden md:inline">Call</span>
              </a>
            </Button>
          </div>

          {/* Primary Action Button (Visually Dominant & Full-Width on Mobile) */}
          <div className="flex-1">
            {pendingSync ? (
              <Button
                size="sm"
                disabled
                onClick={() => {
                  if (pendingSync.actionStatus === 'failed') {
                    void flushOutboxQueue()
                  }
                }}
                className={`w-full h-11 min-h-[44px] text-xs font-semibold gap-1.5 cursor-not-allowed ${
                  pendingSync.actionStatus === 'failed'
                    ? 'bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 cursor-pointer'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {pendingSync.actionStatus === 'failed' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Sync failed (Retry)
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Waiting to sync
                  </>
                )}
              </Button>
            ) : !isOut ? (
              <Button
                size="sm"
                onClick={() => {
                  void onUpdateStatus(order.id, 'out_for_delivery')
                }}
                disabled={isUpdating}
                className="w-full h-11 min-h-[44px] text-xs font-semibold bg-info hover:bg-info/90 text-info-foreground shadow-sm transition-all"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Starting delivery...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4 mr-1.5" />
                    Start Delivery
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  if (onOpenDeliveryProof) {
                    onOpenDeliveryProof(order)
                  } else {
                    void onUpdateStatus(order.id, 'delivered')
                  }
                }}
                disabled={isUpdating}
                className="w-full h-11 min-h-[44px] text-xs font-semibold bg-success hover:bg-success/90 text-success-foreground shadow-sm transition-all"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Saving delivery...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {isCOD ? (
                      <span>Delivered & Collect {formatNPR(order.total)}</span>
                    ) : (
                      'Mark Delivered'
                    )}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
