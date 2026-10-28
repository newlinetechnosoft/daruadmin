import { formatNPR } from '#/lib/money'
import { cn } from '#/lib/utils'

export interface MoneyTextProps {
  paisa: number
  className?: string
  showZeroAsFree?: boolean
  prefix?: string
}

/**
 * Standardized money renderer for Mezmani.
 * Enforces integer paisa inputs and displays formatted Nepali Rupees (NPR).
 */
export function MoneyText({
  paisa,
  className,
  showZeroAsFree = false,
  prefix,
}: MoneyTextProps) {
  if (showZeroAsFree && paisa === 0) {
    return (
      <span
        className={cn(
          'font-medium text-emerald-600 dark:text-emerald-400',
          className,
        )}
      >
        Free
      </span>
    )
  }

  const formatted = formatNPR(paisa)

  return (
    <span
      className={cn(
        'font-mono tabular-nums tracking-tight',
        paisa < 0 && 'text-rose-600 dark:text-rose-400',
        className,
      )}
    >
      {prefix ? `${prefix} ` : ''}
      {formatted}
    </span>
  )
}
