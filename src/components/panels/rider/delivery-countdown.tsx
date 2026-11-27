import { useEffect, useState } from 'react'
import { Clock, TimerOff, Timer } from 'lucide-react'
import type { Order } from '#/server/operations/types'
import {
  formatDurationMinutes,
  getDeliveryDeadline,
  getDeliveryDurationMinutes,
} from '#/lib/delivery-time'
import { cn } from '#/lib/utils'

interface DeliveryCountdownProps {
  order: Pick<
    Order,
    | 'status'
    | 'createdAt'
    | 'confirmedAt'
    | 'deliveredAt'
    | 'deliveryScheduledFor'
  >
  className?: string
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [active])

  return now
}

/**
 * Rider-facing delivery timer. Counts down to the customer-selected window
 * (or confirmation + 45 minutes for express orders) and reports the actual
 * confirmation → delivery duration once completed.
 */
export function DeliveryCountdown({
  order,
  className,
}: DeliveryCountdownProps) {
  const isCompleted = order.status === 'delivered'
  const isStopped =
    order.status === 'cancelled' ||
    order.status === 'returned' ||
    order.status === 'delivery_failed'
  const now = useNow(!isCompleted && !isStopped)

  if (isCompleted) {
    const minutes = getDeliveryDurationMinutes(order)
    if (minutes == null) return null
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400',
          className,
        )}
        title="Time from order confirmation to successful delivery"
      >
        <Timer className="h-3 w-3" />
        Delivered in {formatDurationMinutes(minutes)}
      </span>
    )
  }

  if (isStopped) return null

  const deadline = getDeliveryDeadline(order)
  if (!deadline) return null

  const diffMs = deadline.getTime() - now
  const isOverdue = diffMs < 0
  const minutes = Math.max(1, Math.round(Math.abs(diffMs) / 60_000))

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
        isOverdue
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : diffMs <= 15 * 60_000
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'border-border bg-muted/50 text-muted-foreground',
        className,
      )}
      title={
        isOverdue
          ? 'Delivery window has passed'
          : 'Time remaining until the delivery window'
      }
    >
      {isOverdue ? (
        <TimerOff className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isOverdue ? 'Overdue' : 'Due in'} {formatDurationMinutes(minutes)}
    </span>
  )
}
