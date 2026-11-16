import { useState, useEffect } from 'react'
import { Timer } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { storeQueries } from '#/queries/admin'
import { cn } from '#/lib/utils'

export interface CountdownTimerProps {
  targetDateTime?: string | null
  fallbackFormatted?: string | null
  variant?: 'boxes' | 'header-badge' | 'compact'
  className?: string
  onComplete?: () => void
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
  isComplete: boolean
}

function resolveTargetTimestamp(targetIso?: string | null): number {
  if (targetIso) {
    const parsed = new Date(targetIso).getTime()
    if (!Number.isNaN(parsed) && parsed > Date.now()) {
      return parsed
    }
  }

  // Fallback: next 10:00 AM in Asia/Kathmandu (UTC+5:45)
  const now = new Date()
  const ktmOffsetMs = 345 * 60 * 1000
  const ktmNow = new Date(now.getTime() + ktmOffsetMs)

  const targetYear = ktmNow.getUTCFullYear()
  const targetMonth = ktmNow.getUTCMonth()
  let targetDate = ktmNow.getUTCDate()

  // If already past 10:00 AM KTM today, target tomorrow 10:00 AM
  if (ktmNow.getUTCHours() >= 10) {
    targetDate += 1
  }

  // 10:00 KTM is 04:15 UTC (10h - 5h45m = 4h15m)
  return Date.UTC(targetYear, targetMonth, targetDate, 4, 15, 0)
}

function calculateTimeLeft(targetTimestamp: number): TimeLeft {
  const diff = Math.max(0, targetTimestamp - Date.now())
  const totalSeconds = Math.floor(diff / 1000)

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs: diff,
    isComplete: diff <= 0,
  }
}

export function StoreCountdownTimer({
  targetDateTime,
  fallbackFormatted,
  variant = 'boxes',
  className,
  onComplete,
}: CountdownTimerProps) {
  const queryClient = useQueryClient()
  const [targetMs, setTargetMs] = useState<number>(() => resolveTargetTimestamp(targetDateTime))
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetMs))
  const [isClient, setIsClient] = useState(false)

  // Sync target when prop changes
  useEffect(() => {
    setTargetMs(resolveTargetTimestamp(targetDateTime))
  }, [targetDateTime])

  useEffect(() => {
    setIsClient(true)
    const tick = () => {
      const remaining = calculateTimeLeft(targetMs)
      setTimeLeft(remaining)

      if (remaining.isComplete) {
        if (onComplete) onComplete()
        // Refresh store status when countdown ends
        queryClient.invalidateQueries({ queryKey: storeQueries.operatingStatus().queryKey })
      }
    }

    tick()
    const timerId = setInterval(tick, 1000)
    return () => clearInterval(timerId)
  }, [targetMs, queryClient, onComplete])

  const { days, hours, minutes, seconds, isComplete } = timeLeft

  if (isComplete) {
    if (variant === 'compact') {
      return <span className={cn('font-mono font-bold text-amber-600 dark:text-amber-400', className)}>Opening shortly</span>
    }
    return (
      <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300', className)}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span>Reopening in progress...</span>
      </div>
    )
  }

  // Variant 1: Header Badge (fits perfectly in sticky announcement bar)
  if (variant === 'header-badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/25 border border-amber-500/40 text-amber-950 dark:text-amber-100 font-mono shadow-xs transition-colors',
          className,
        )}
      >
        <Timer className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
        <span className="hidden xs:inline">Opens in</span>
        <span className="tracking-tight text-amber-900 dark:text-amber-200 tabular-nums">
          {days > 0 && `${days}d `}
          {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
        </span>
      </span>
    )
  }

  // Variant 2: Compact Inline (for pills or tight spaces)
  if (variant === 'compact') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-mono font-bold text-amber-700 dark:text-amber-300 tabular-nums', className)}>
        {days > 0 && `${days}d `}
        {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
      </span>
    )
  }

  // Variant 3: Stylish Boxes (for Modal, Bottom Popup, and Hero Card)
  return (
    <div className={cn('flex items-center justify-center gap-1.5 sm:gap-2.5 select-none', className)}>
      {days > 0 && (
        <>
          <div className="flex flex-col items-center">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-zinc-900/90 shadow-inner transition-transform">
              <span className="font-mono text-base sm:text-lg font-black tracking-tight text-amber-950 dark:text-amber-100 tabular-nums">
                {String(days).padStart(2, '0')}
              </span>
            </div>
            <span className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-sans">
              Days
            </span>
          </div>
          <span className="font-mono text-base sm:text-lg font-bold text-amber-500/70 -mt-4">:</span>
        </>
      )}

      <div className="flex flex-col items-center">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-zinc-900/90 shadow-inner">
          <span className="font-mono text-base sm:text-lg font-black tracking-tight text-amber-950 dark:text-amber-100 tabular-nums">
            {String(hours).padStart(2, '0')}
          </span>
        </div>
        <span className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-sans">
          Hours
        </span>
      </div>

      <span className="font-mono text-base sm:text-lg font-bold text-amber-500/70 -mt-4">:</span>

      <div className="flex flex-col items-center">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-zinc-900/90 shadow-inner">
          <span className="font-mono text-base sm:text-lg font-black tracking-tight text-amber-950 dark:text-amber-100 tabular-nums">
            {String(minutes).padStart(2, '0')}
          </span>
        </div>
        <span className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-sans">
          Mins
        </span>
      </div>

      <span className="font-mono text-base sm:text-lg font-bold text-amber-500/70 -mt-4">:</span>

      <div className="flex flex-col items-center">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/20 dark:bg-amber-950/50 shadow-inner ring-1 ring-amber-500/30">
          <span className="font-mono text-base sm:text-lg font-black tracking-tight text-amber-600 dark:text-amber-300 tabular-nums">
            {String(seconds).padStart(2, '0')}
          </span>
        </div>
        <span className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300 font-sans font-bold">
          Secs
        </span>
      </div>
    </div>
  )
}
