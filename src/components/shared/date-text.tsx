import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { formatBS } from '#/lib/nepal-date'
import { cn } from '#/lib/utils'

export interface DateTextProps {
  date: Date | string | number | null | undefined
  className?: string
  showTime?: boolean
  showRelative?: boolean
  showBSPrimary?: boolean
}

function getRelativeTime(targetDate: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - targetDate.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin === 1) return '1 min ago'
  if (diffMin < 60) return `${diffMin} mins ago`
  if (diffHours === 1) return '1 hr ago'
  if (diffHours < 24) return `${diffHours} hrs ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Standardized Date renderer showing Gregorian (AD) and Bikram Sambat (BS) calendar dates.
 * Hovering displays full details for both calendar systems.
 */
export function DateText({
  date,
  className,
  showTime = true,
  showRelative = false,
  showBSPrimary = false,
}: DateTextProps) {
  if (!date) {
    return <span className={cn('text-muted-foreground', className)}>—</span>
  }

  const d = new Date(date)
  if (isNaN(d.getTime())) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        Invalid date
      </span>
    )
  }

  const bsFormatted = formatBS(d, { format: 'long' })
  const adFormatted = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const timeFormatted = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  let displayLabel = ''
  if (showRelative) {
    displayLabel = getRelativeTime(d)
  } else if (showBSPrimary) {
    displayLabel = bsFormatted + (showTime ? ` ${timeFormatted}` : '')
  } else {
    displayLabel = adFormatted + (showTime ? ` ${timeFormatted}` : '')
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            dateTime={d.toISOString()}
            className={cn(
              'cursor-default text-xs tabular-nums text-foreground/80 hover:text-foreground',
              className,
            )}
          >
            {displayLabel}
          </time>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs space-y-1">
          <p className="font-semibold">{bsFormatted} (BS)</p>
          <p className="text-muted-foreground">
            {adFormatted} {timeFormatted} (AD / Nepal Time)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
