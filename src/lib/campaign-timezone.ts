/**
 * Campaign Scheduling Timezone & Validation Engine
 * Default timezone: Asia/Kathmandu (Nepal Standard Time, UTC+05:45)
 * Handles DST, cross-timezone conversions, and strict scheduling validation rules.
 */

export interface SupportedTimezone {
  value: string
  label: string
  shortLabel: string
  offsetLabel: string
  hasDst: boolean
}

export const DEFAULT_TIMEZONE = 'Asia/Kathmandu'

export const SUPPORTED_TIMEZONES: SupportedTimezone[] = [
  {
    value: 'Asia/Kathmandu',
    label: 'Asia/Kathmandu (Nepal Standard Time, UTC+05:45)',
    shortLabel: 'NPT',
    offsetLabel: 'UTC+05:45',
    hasDst: false,
  },
  {
    value: 'Asia/Kolkata',
    label: 'Asia/Kolkata (Indian Standard Time, UTC+05:30)',
    shortLabel: 'IST',
    offsetLabel: 'UTC+05:30',
    hasDst: false,
  },
  {
    value: 'Asia/Dubai',
    label: 'Asia/Dubai (Gulf Standard Time, UTC+04:00)',
    shortLabel: 'GST',
    offsetLabel: 'UTC+04:00',
    hasDst: false,
  },
  {
    value: 'Asia/Singapore',
    label: 'Asia/Singapore (Singapore Time, UTC+08:00)',
    shortLabel: 'SGT',
    offsetLabel: 'UTC+08:00',
    hasDst: false,
  },
  {
    value: 'Asia/Tokyo',
    label: 'Asia/Tokyo (Japan Standard Time, UTC+09:00)',
    shortLabel: 'JST',
    offsetLabel: 'UTC+09:00',
    hasDst: false,
  },
  {
    value: 'UTC',
    label: 'UTC (Coordinated Universal Time, UTC+00:00)',
    shortLabel: 'UTC',
    offsetLabel: 'UTC+00:00',
    hasDst: false,
  },
  {
    value: 'Europe/London',
    label: 'Europe/London (GMT/BST, UTC+00:00 / +01:00)',
    shortLabel: 'UK',
    offsetLabel: 'UTC+00:00/+01:00',
    hasDst: true,
  },
  {
    value: 'America/New_York',
    label: 'America/New_York (US Eastern, UTC-05:00 / -04:00)',
    shortLabel: 'ET',
    offsetLabel: 'UTC-05:00/-04:00',
    hasDst: true,
  },
  {
    value: 'America/Los_Angeles',
    label: 'America/Los_Angeles (US Pacific, UTC-08:00 / -07:00)',
    shortLabel: 'PT',
    offsetLabel: 'UTC-08:00/-07:00',
    hasDst: true,
  },
  {
    value: 'Australia/Sydney',
    label: 'Australia/Sydney (AEST/AEDT, UTC+10:00 / +11:00)',
    shortLabel: 'AEST',
    offsetLabel: 'UTC+10:00/+11:00',
    hasDst: true,
  },
]

/**
 * Returns timezone descriptor by name, defaulting to Asia/Kathmandu.
 */
export function getTimezoneMeta(timeZone = DEFAULT_TIMEZONE): SupportedTimezone {
  return (
    SUPPORTED_TIMEZONES.find((t) => t.value === timeZone) || {
      value: timeZone,
      label: timeZone,
      shortLabel: timeZone,
      offsetLabel: 'Custom',
      hasDst: false,
    }
  )
}

/**
 * Parses date string ('YYYY-MM-DD') and time string ('HH:mm') in a specified
 * timezone into an exact UTC Date object.
 * Correctly accounts for DST changes and standard offsets.
 */
export function parseDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  const [yearStr, monthStr, dayStr] = dateStr.trim().split('-')
  const [hourStr, minStr] = timeStr.trim().split(':')

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)
  const hours = parseInt(hourStr, 10)
  const minutes = parseInt(minStr, 10)

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hours) ||
    isNaN(minutes)
  ) {
    throw new Error(`Invalid date/time format: ${dateStr} ${timeStr}`)
  }

  // Fast path for Asia/Kathmandu: UTC+05:45 constant (345 minutes)
  if (timeZone === 'Asia/Kathmandu') {
    const ms = Date.UTC(year, month - 1, day, hours, minutes, 0)
    return new Date(ms - 345 * 60 * 1000)
  }

  // Fast path for UTC
  if (timeZone === 'UTC') {
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0))
  }

  // General DST-aware calculation using native Intl
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0))
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(guess)
  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10)
    }
  }

  const formattedHour = map.hour === 24 ? 0 : (map.hour ?? hours)
  const formattedMs = Date.UTC(
    map.year ?? year,
    (map.month ?? month) - 1,
    map.day ?? day,
    formattedHour,
    map.minute ?? minutes,
    map.second ?? 0,
  )

  const offset = formattedMs - guess.getTime()
  return new Date(guess.getTime() - offset)
}

/**
 * Converts a UTC Date into local { dateStr, timeStr } components in the target timezone.
 */
export function formatUtcToParts(
  date: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): { dateStr: string; timeStr: string } {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return { dateStr: '', timeStr: '' }
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value
    }
  }

  const hour = map.hour === '24' ? '00' : (map.hour || '00')
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    timeStr: `${hour}:${map.minute}`,
  }
}

/**
 * Formats a UTC date for human display in the target timezone.
 * Example: "Nov 20, 2026, 02:30 PM (Asia/Kathmandu, UTC+05:45)"
 */
export function formatInTimezone(
  date: Date | string | null | undefined,
  timeZone = DEFAULT_TIMEZONE,
  includeTimezoneBadge = true,
): string {
  if (!date) return 'Not set'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const formatted = formatter.format(d)
  if (!includeTimezoneBadge) return formatted

  const meta = getTimezoneMeta(timeZone)
  return `${formatted} (${meta.shortLabel})`
}

export interface ScheduleValidationResult {
  valid: boolean
  errors: string[]
  scheduledUtc?: Date
  expiresUtc?: Date
}

/**
 * Validates campaign schedule parameters according to system rules:
 * - Expiry must be later than the scheduled publication time.
 * - Past publication times cannot be scheduled as future campaigns.
 * - Expired campaigns cannot be published as active offers.
 * - Valid format for dates and times.
 */
export function validateCampaignSchedule(params: {
  scheduledDate: string
  scheduledTime: string
  expiryDate?: string | null
  expiryTime?: string | null
  timezone?: string
  isDraft?: boolean
  isPublishNow?: boolean
  now?: Date
}): ScheduleValidationResult {
  const errors: string[] = []
  const timezone = params.timezone || DEFAULT_TIMEZONE
  const now = params.now || new Date()

  // Drafts bypass future date requirement, but must have logical dates if provided
  if (params.isDraft) {
    let scheduledUtc: Date | undefined
    let expiresUtc: Date | undefined

    if (params.scheduledDate && params.scheduledTime) {
      try {
        scheduledUtc = parseDateTimeToUtc(
          params.scheduledDate,
          params.scheduledTime,
          timezone,
        )
      } catch {
        errors.push('Invalid scheduled date or time format')
      }
    }

    if (params.expiryDate && params.expiryTime) {
      try {
        expiresUtc = parseDateTimeToUtc(
          params.expiryDate,
          params.expiryTime,
          timezone,
        )
      } catch {
        errors.push('Invalid expiry date or time format')
      }
    }

    if (scheduledUtc && expiresUtc && expiresUtc <= scheduledUtc) {
      errors.push('Expiry date and time must be later than the scheduled publication time')
    }

    return {
      valid: errors.length === 0,
      errors,
      scheduledUtc,
      expiresUtc,
    }
  }

  // Publish Now validation
  if (params.isPublishNow) {
    const scheduledUtc = now
    let expiresUtc: Date | undefined

    if (params.expiryDate && params.expiryTime) {
      try {
        expiresUtc = parseDateTimeToUtc(
          params.expiryDate,
          params.expiryTime,
          timezone,
        )
        if (expiresUtc <= now) {
          errors.push('Expiry date and time must be in the future')
        }
      } catch {
        errors.push('Invalid expiry date or time format')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      scheduledUtc,
      expiresUtc,
    }
  }

  // Future scheduled campaign validation
  if (!params.scheduledDate || !params.scheduledTime) {
    errors.push('Schedule publication date and time are required')
    return { valid: false, errors }
  }

  let scheduledUtc: Date
  try {
    scheduledUtc = parseDateTimeToUtc(
      params.scheduledDate,
      params.scheduledTime,
      timezone,
    )
  } catch {
    errors.push('Invalid scheduled date or time format')
    return { valid: false, errors }
  }

  // Past publication times cannot be scheduled as future campaigns
  // Allow a 1-minute grace period for slow form submissions
  const gracePeriodMs = 60 * 1000
  if (scheduledUtc.getTime() < now.getTime() - gracePeriodMs) {
    errors.push(
      `Scheduled publication time cannot be in the past (${formatInTimezone(scheduledUtc, timezone)} vs current ${formatInTimezone(now, timezone)})`,
    )
  }

  let expiresUtc: Date | undefined
  if (params.expiryDate && params.expiryTime) {
    try {
      expiresUtc = parseDateTimeToUtc(
        params.expiryDate,
        params.expiryTime,
        timezone,
      )

      // Expiry must be later than the scheduled publication time
      if (expiresUtc <= scheduledUtc) {
        errors.push(
          'Expiry date and time must be later than the scheduled publication time',
        )
      }

      // Expired campaigns cannot be scheduled
      if (expiresUtc <= now) {
        errors.push('Campaign expiry date and time cannot be in the past')
      }
    } catch {
      errors.push('Invalid expiry date or time format')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    scheduledUtc,
    expiresUtc,
  }
}
