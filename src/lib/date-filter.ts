import {
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
} from 'date-fns'
import { formatBS } from './nepal-date'

export type DateFilterPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'custom'
  | 'all'

export interface DateFilterValue {
  preset: DateFilterPreset
  from?: string // YYYY-MM-DD or ISO string
  to?: string // YYYY-MM-DD or ISO string
}

export interface DateRangeBounds {
  start: Date | null
  end: Date | null
  label: string
  secondaryLabel: string
  nepaliLabel?: string
  isFiltered: boolean
}

/**
 * Computes exact start and end Date boundaries in local/Nepal timezone
 * for a given filter preset or custom date range.
 */
export function getDateRangeBounds(
  filter: DateFilterValue = { preset: 'today' },
  referenceDate = new Date(),
): DateRangeBounds {
  const { preset, from, to } = filter

  if (preset === 'all') {
    return {
      start: null,
      end: null,
      label: 'All Time',
      secondaryLabel: 'All historical records',
      isFiltered: false,
    }
  }

  if (preset === 'yesterday') {
    const yesterday = subDays(referenceDate, 1)
    const start = startOfDay(yesterday)
    const end = endOfDay(yesterday)
    return {
      start,
      end,
      label: 'Yesterday',
      secondaryLabel: format(yesterday, 'd MMM yyyy'),
      nepaliLabel: `${formatBS(yesterday, { format: 'long' })}`,
      isFiltered: true,
    }
  }

  if (preset === 'this_week') {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 })
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 })
    return {
      start,
      end,
      label: 'This Week',
      secondaryLabel: `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`,
      nepaliLabel: `${formatBS(start)} – ${formatBS(end)}`,
      isFiltered: true,
    }
  }

  if (preset === 'this_month') {
    const start = startOfMonth(referenceDate)
    const end = endOfMonth(referenceDate)
    return {
      start,
      end,
      label: 'This Month',
      secondaryLabel: format(referenceDate, 'MMMM yyyy'),
      nepaliLabel: formatBS(referenceDate, { format: 'long' }),
      isFiltered: true,
    }
  }

  if (preset === 'custom') {
    const startDate = from ? new Date(from) : referenceDate
    const endDate = to ? new Date(to) : startDate
    const start = startOfDay(startDate)
    const end = endOfDay(endDate)

    const isSingleDay = isSameDay(start, end)
    const label = isSingleDay
      ? format(start, 'd MMM yyyy')
      : `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`

    return {
      start,
      end,
      label: 'Custom Range',
      secondaryLabel: label,
      nepaliLabel: isSingleDay
        ? formatBS(start, { format: 'long' })
        : `${formatBS(start)} – ${formatBS(end)}`,
      isFiltered: true,
    }
  }

  // Default: 'today'
  const start = startOfDay(referenceDate)
  const end = endOfDay(referenceDate)
  return {
    start,
    end,
    label: 'Today',
    secondaryLabel: format(referenceDate, 'd MMM yyyy'),
    nepaliLabel: formatBS(referenceDate, { format: 'long' }),
    isFiltered: true,
  }
}

/**
 * Checks whether a given timestamp or Date falls within the specified start and end bounds.
 */
export function isDateInRange(
  dateInput: Date | string | number | null | undefined,
  start: Date | null,
  end: Date | null,
): boolean {
  if (start === null && end === null) return true
  if (dateInput === null || dateInput === undefined) return false

  const time = new Date(dateInput).getTime()
  if (isNaN(time)) return false

  if (start !== null && time < start.getTime()) return false
  if (end !== null && time > end.getTime()) return false

  return true
}

/**
 * Step forward or backward in time (ERPNext / Frappe chevron style).
 */
export function stepPeriod(
  current: DateFilterValue,
  direction: -1 | 1,
  referenceDate = new Date(),
): DateFilterValue {
  if (current.preset === 'today') {
    if (direction === -1) {
      return { preset: 'yesterday' }
    }
    // Cannot step to future today
    return current
  }

  if (current.preset === 'yesterday') {
    if (direction === 1) {
      return { preset: 'today' }
    }
    const twoDaysAgo = subDays(referenceDate, 2)
    const iso = format(twoDaysAgo, 'yyyy-MM-dd')
    return { preset: 'custom', from: iso, to: iso }
  }

  if (current.preset === 'custom') {
    const bounds = getDateRangeBounds(current, referenceDate)
    if (!bounds.start || !bounds.end) return current

    const isSingleDay = isSameDay(bounds.start, bounds.end)
    if (isSingleDay) {
      const target = direction === 1 ? addDays(bounds.start, 1) : subDays(bounds.start, 1)
      if (isSameDay(target, referenceDate)) {
        return { preset: 'today' }
      }
      if (isSameDay(target, subDays(referenceDate, 1))) {
        return { preset: 'yesterday' }
      }
      const iso = format(target, 'yyyy-MM-dd')
      return { preset: 'custom', from: iso, to: iso }
    }

    // Range shift by day span
    const diffMs = bounds.end.getTime() - bounds.start.getTime()
    const daysSpan = Math.round(diffMs / 86_400_000) + 1
    const shift = daysSpan * direction
    const nextStart = addDays(bounds.start, shift)
    const nextEnd = addDays(bounds.end, shift)
    return {
      preset: 'custom',
      from: format(nextStart, 'yyyy-MM-dd'),
      to: format(nextEnd, 'yyyy-MM-dd'),
    }
  }

  return current
}

export const DATE_FILTER_PRESET_OPTIONS: {
  value: DateFilterPreset
  label: string
  description?: string
}[] = [
  { value: 'today', label: 'Today', description: 'Records created today' },
  { value: 'yesterday', label: 'Yesterday', description: 'Records from yesterday' },
  { value: 'this_week', label: 'This Week', description: 'Monday to Sunday' },
  { value: 'this_month', label: 'This Month', description: 'Current calendar month' },
  { value: 'custom', label: 'Custom Range...', description: 'Select start & end date' },
  { value: 'all', label: 'All Dates', description: 'Show all recorded data' },
]
