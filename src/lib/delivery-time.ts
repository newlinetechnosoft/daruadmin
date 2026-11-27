import { DEFAULT_TIMEZONE, parseDateTimeToUtc } from './campaign-timezone'
import type { Order } from '#/server/operations/types'

export const EXPRESS_DELIVERY_MINUTES = 45

export const DELIVERY_SLOT_LABELS: Record<string, string> = {
  express: 'Express (ASAP)',
  evening: 'Evening (6–8 PM)',
  late_night: 'Late night (8–10 PM)',
  custom: 'Scheduled',
}

/** Returns today's calendar date (YYYY-MM-DD) in the store timezone. */
export function getStoreDateString(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

interface DeliveryScheduleInput {
  deliverySlot?: string | null
  customDeliveryDate?: string | null
  customDeliveryTime?: string | null
  now?: Date
}

/**
 * Converts the customer-selected checkout slot into a concrete UTC instant.
 * Express orders have no fixed instant (countdown falls back to confirmation
 * time + 45 minutes); evening/late-night slots use today's store date and roll
 * to tomorrow when the window has already started.
 */
export function resolveDeliverySchedule({
  deliverySlot,
  customDeliveryDate,
  customDeliveryTime,
  now = new Date(),
}: DeliveryScheduleInput): {
  deliverySlot: string | null
  deliveryScheduledFor: Date | null
} {
  if (!deliverySlot) {
    return { deliverySlot: null, deliveryScheduledFor: null }
  }

  if (deliverySlot === 'express') {
    return { deliverySlot, deliveryScheduledFor: null }
  }

  if (deliverySlot === 'custom') {
    if (!customDeliveryTime) {
      return { deliverySlot, deliveryScheduledFor: null }
    }
    const date = customDeliveryDate || getStoreDateString(now)
    try {
      return {
        deliverySlot,
        deliveryScheduledFor: parseDateTimeToUtc(
          date,
          customDeliveryTime,
          DEFAULT_TIMEZONE,
        ),
      }
    } catch {
      return { deliverySlot, deliveryScheduledFor: null }
    }
  }

  const windowStart =
    deliverySlot === 'evening'
      ? '18:00'
      : deliverySlot === 'late_night'
        ? '20:00'
        : null

  if (!windowStart) {
    return { deliverySlot, deliveryScheduledFor: null }
  }

  let date = getStoreDateString(now)
  let scheduled = parseDateTimeToUtc(date, windowStart, DEFAULT_TIMEZONE)
  if (scheduled.getTime() <= now.getTime()) {
    date = addDays(date, 1)
    scheduled = parseDateTimeToUtc(date, windowStart, DEFAULT_TIMEZONE)
  }

  return { deliverySlot, deliveryScheduledFor: scheduled }
}

function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

/** Human-readable label for the customer-selected delivery window. */
export function formatOrderDeliveryTime(
  order: Pick<Order, 'deliverySlot' | 'deliveryScheduledFor' | 'notes'>,
): string {
  if (order.deliveryScheduledFor) {
    const label = DELIVERY_SLOT_LABELS[order.deliverySlot ?? ''] ?? 'Scheduled'
    return `${label} · ${formatInstant(order.deliveryScheduledFor)}`
  }

  if (order.deliverySlot) {
    return DELIVERY_SLOT_LABELS[order.deliverySlot] ?? order.deliverySlot
  }

  // Legacy rows only carry the slot inside notes.
  const legacyMatch = order.notes?.match(/\[Slot:\s*([^\]]+)\]/i)
  if (legacyMatch) {
    return legacyMatch[1].trim()
  }

  return 'Express (ASAP)'
}

/**
 * The instant used by the rider countdown. Prefers the customer-selected
 * schedule, then falls back to confirmation time + express SLA.
 */
export function getDeliveryDeadline(
  order: Pick<Order, 'deliveryScheduledFor' | 'confirmedAt' | 'createdAt'>,
): Date | null {
  if (order.deliveryScheduledFor) {
    return new Date(order.deliveryScheduledFor)
  }
  const base = order.confirmedAt ?? order.createdAt
  if (!base) return null
  return new Date(
    new Date(base).getTime() + EXPRESS_DELIVERY_MINUTES * 60 * 1000,
  )
}

/** Confirmation → delivery duration, in minutes, for completed orders. */
export function getDeliveryDurationMinutes(
  order: Pick<Order, 'confirmedAt' | 'deliveredAt'>,
): number | null {
  if (!order.confirmedAt || !order.deliveredAt) return null
  const minutes = Math.round(
    (new Date(order.deliveredAt).getTime() -
      new Date(order.confirmedAt).getTime()) /
      60000,
  )
  return Math.max(0, minutes)
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}
