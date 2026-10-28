/**
 * Bikram Sambat (BS) & Nepal Fiscal Year (Shrawan 1 – Ashadh end) utility.
 *
 * Mezmani operates in Nepal (NPR, Bikram Sambat calendar, and Nepal Fiscal Year).
 * Databases store standard UTC timestamps; this helper provides conversions to
 * Bikram Sambat date representations and fiscal year identifiers.
 */

export interface BikramSambatDate {
  year: number
  month: number // 1 = Baisakh, ..., 12 = Chaitra
  day: number
}

export const BS_MONTH_NAMES_EN = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const

export const BS_MONTH_NAMES_NP = [
  'बैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भाद्र',
  'आश्विन',
  'कार्तिक',
  'मंसिर',
  'पौष',
  'माघ',
  'फाल्गुन',
  'चैत्र',
] as const

interface YearData {
  days: number[]
  startUtc: number
}

// Verified Bikram Sambat calendar data (2075 - 2088 BS)
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2080: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2081: [31, 31, 32, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2087: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
}

// Pre-computed year metadata
const BS_YEARS: Partial<Record<number, YearData>> = (() => {
  const result: Partial<Record<number, YearData>> = {}
  let currentStartUtc = Date.UTC(2018, 3, 14) // 2075-01-01 = 2018-04-14 UTC

  for (let yr = 2075; yr <= 2088; yr++) {
    const days = BS_CALENDAR_DATA[yr]
    result[yr] = {
      days,
      startUtc: currentStartUtc,
    }
    const yearLength = days.reduce((a, b) => a + b, 0)
    currentStartUtc += yearLength * 86_400_000
  }
  return result
})()

/**
 * Converts a JavaScript Date or ISO string into Bikram Sambat Date components.
 */
export function adToBs(dateInput: Date | string | number): BikramSambatDate {
  const d = new Date(dateInput)
  const targetUtc = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  )

  for (let yr = 2075; yr <= 2088; yr++) {
    const info = BS_YEARS[yr]
    if (!info) continue
    const yearLength = info.days.reduce((a, b) => a + b, 0)
    const endUtc = info.startUtc + yearLength * 86_400_000

    if (targetUtc >= info.startUtc && targetUtc < endUtc) {
      let diffDays = Math.floor((targetUtc - info.startUtc) / 86_400_000)
      for (let m = 0; m < 12; m++) {
        if (diffDays < info.days[m]) {
          return { year: yr, month: m + 1, day: diffDays + 1 }
        }
        diffDays -= info.days[m]
      }
    }
  }

  // Fallback approximate formula if out of calendar range
  const approxYear = d.getUTCFullYear() + 57
  return {
    year: approxYear,
    month: ((d.getUTCMonth() + 8) % 12) + 1,
    day: d.getUTCDate(),
  }
}

/**
 * Formats a date into a Bikram Sambat string.
 * @example
 * formatBS(new Date()) // '2083-06-30'
 * formatBS(new Date(), { format: 'long' }) // '30 Ashwin 2083 BS'
 */
export function formatBS(
  dateInput: Date | string | number,
  options: { format?: 'numeric' | 'long' | 'nepali' } = {},
): string {
  const bs = adToBs(dateInput)
  const format = options.format ?? 'numeric'

  if (format === 'numeric') {
    const mm = String(bs.month).padStart(2, '0')
    const dd = String(bs.day).padStart(2, '0')
    return `${bs.year}-${mm}-${dd}`
  }

  const monthName = BS_MONTH_NAMES_EN[bs.month - 1] ?? 'Baisakh'
  if (format === 'long') {
    return `${bs.day} ${monthName} ${bs.year} BS`
  }

  const nepaliMonth = BS_MONTH_NAMES_NP[bs.month - 1] ?? 'बैशाख'
  return `${bs.day} ${nepaliMonth} ${bs.year}`
}

/**
 * Displays both Gregorian (AD) and Bikram Sambat (BS) for accounting reports & audits.
 * @example '16 Oct 2026 (30 Ashwin 2083 BS)'
 */
export function formatDualDate(dateInput: Date | string | number): string {
  const d = new Date(dateInput)
  const adFormatted = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const bsFormatted = formatBS(d, { format: 'long' })
  return `${adFormatted} (${bsFormatted})`
}

export interface FiscalYearInfo {
  id: string // e.g. 'fy-2083-84'
  name: string // e.g. '2083/84'
  startDate: Date // Shrawan 1 start of day UTC
  endDate: Date // Ashadh end of day UTC
}

/**
 * Determines the Nepal Fiscal Year (Shrawan 1 to Ashadh end) for any given date.
 */
export function getNepalFiscalYear(
  dateInput: Date | string | number,
): FiscalYearInfo {
  const bs = adToBs(dateInput)
  let fyStartBsYear: number
  let fyEndBsYear: number

  // Months 4 (Shrawan) to 12 (Chaitra) belong to the FY starting in that BS year
  // Months 1 (Baisakh) to 3 (Ashadh) belong to the FY that started in the prior BS year
  if (bs.month >= 4) {
    fyStartBsYear = bs.year
    fyEndBsYear = bs.year + 1
  } else {
    fyStartBsYear = bs.year - 1
    fyEndBsYear = bs.year
  }

  const fySuffix = String(fyEndBsYear).slice(-2)
  const id = `fy-${fyStartBsYear}-${fySuffix}`
  const name = `${fyStartBsYear}/${fySuffix}`

  // Compute exact Shrawan 1 (AD) and Ashadh 31 (AD) for this fiscal year
  const startYearInfo = BS_YEARS[fyStartBsYear]
  let startDate: Date
  if (startYearInfo) {
    // Days in Baisakh (0) + Jestha (1) + Ashadh (2)
    const daysToShrawan =
      startYearInfo.days[0] + startYearInfo.days[1] + startYearInfo.days[2]
    startDate = new Date(startYearInfo.startUtc + daysToShrawan * 86_400_000)
  } else {
    startDate = new Date(Date.UTC(fyStartBsYear - 57, 6, 16))
  }

  const endYearInfo = BS_YEARS[fyEndBsYear]
  let endDate: Date
  if (endYearInfo) {
    // Ashadh end is day before Shrawan 1 of end year
    const daysToShrawanNext =
      endYearInfo.days[0] + endYearInfo.days[1] + endYearInfo.days[2]
    endDate = new Date(
      endYearInfo.startUtc + daysToShrawanNext * 86_400_000 - 1,
    )
  } else {
    endDate = new Date(Date.UTC(fyEndBsYear - 57, 6, 15, 23, 59, 59, 999))
  }

  return { id, name, startDate, endDate }
}
