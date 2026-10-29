import * as React from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { RotateCw, Check } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { Kbd } from '#/components/ui/kbd'
import { cn } from '#/lib/utils'

export interface DataRefreshButtonProps {
  /**
   * One or more TanStack Query keys to invalidate and refetch.
   */
  queryKeys?: QueryKey | QueryKey[]

  /**
   * Optional custom async callback to execute on refresh.
   */
  onRefresh?: () => Promise<unknown> | unknown

  /**
   * External refreshing / isFetching state from query.
   */
  isRefreshing?: boolean

  /**
   * Visual presentation variant.
   * - 'toolbar': Icon button styled for table toolbars (default)
   * - 'icon': Compact round ghost icon button
   * - 'button': Standard button with label and icon
   * - 'badge': Compact pill badge showing last updated info
   * - 'ghost': Ghost button with text
   */
  variant?: 'toolbar' | 'icon' | 'button' | 'badge' | 'ghost'

  /**
   * Button size.
   */
  size?: 'xs' | 'sm' | 'default' | 'icon'

  /**
   * Text label for button variants (defaults to 'Refresh').
   */
  label?: string

  /**
   * Whether to show keyboard shortcut hint (e.g. 'R').
   */
  showShortcut?: boolean

  /**
   * Keyboard shortcut key (defaults to 'r').
   */
  shortcutKey?: string

  /**
   * Whether keyboard shortcut is active (defaults to true).
   */
  enableShortcut?: boolean

  /**
   * Show relative or exact timestamp tooltip.
   */
  showLastUpdated?: boolean

  /**
   * Extra classes.
   */
  className?: string
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function DataRefreshButton({
  queryKeys,
  onRefresh,
  isRefreshing: externalIsRefreshing,
  variant = 'toolbar',
  size,
  label = 'Refresh',
  showShortcut = true,
  shortcutKey = 'r',
  enableShortcut = true,
  showLastUpdated = true,
  className,
}: DataRefreshButtonProps) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const [isTriggering, setIsTriggering] = React.useState(false)
  const [justFinished, setJustFinished] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date>(() => new Date())
  const [, setTick] = React.useState(0)

  // Periodic re-render to update relative time text
  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  const isSpinning = externalIsRefreshing || isTriggering

  const handleRefresh = React.useCallback(async () => {
    if (isSpinning) return

    setIsTriggering(true)
    const startTime = Date.now()

    try {
      // Invalidate queries if provided
      if (queryKeys) {
        const normalizedKeys = Array.isArray(queryKeys[0])
          ? (queryKeys as QueryKey[])
          : ([queryKeys] as QueryKey[])

        await Promise.all(
          normalizedKeys.map((key) =>
            queryClient.invalidateQueries({
              queryKey: key,
              refetchType: 'all',
            }),
          ),
        )
      }

      // Always invalidate router so route loaders stay in sync
      await router.invalidate()

      // Call custom refresh handler if passed
      if (onRefresh) {
        await onRefresh()
      }

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Data refresh error:', err)
    } finally {
      // Ensure the spin animation is visible for at least 600ms for tactile feedback
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 600 - elapsed)
      setTimeout(() => {
        setIsTriggering(false)
        setJustFinished(true)
        setTimeout(() => setJustFinished(false), 1200)
      }, remaining)
    }
  }, [isSpinning, queryKeys, queryClient, router, onRefresh])

  // Keyboard shortcut listener (R key when not in an input/textarea/editable)
  React.useEffect(() => {
    if (!enableShortcut) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]') !== null)

      if (
        e.key.toLowerCase() === shortcutKey.toLowerCase() &&
        !isInput &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault()
        handleRefresh()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableShortcut, shortcutKey, handleRefresh])

  const timeString = lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const relativeText = formatRelativeTime(lastUpdated)

  const tooltipText = (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <span>Refresh section data</span>
        {showShortcut && (
          <Kbd className="text-[10px] uppercase font-mono px-1 py-0.5">
            {shortcutKey}
          </Kbd>
        )}
      </div>
      {showLastUpdated && (
        <span className="text-[11px] opacity-75">
          Updated {relativeText} ({timeString})
        </span>
      )}
    </div>
  )

  // Badge Variant
  if (variant === 'badge') {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isSpinning}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:text-foreground shadow-2xs cursor-pointer select-none',
                isSpinning && 'opacity-80 pointer-events-none',
                className,
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full transition-colors duration-200',
                  isSpinning
                    ? 'bg-amber-500 animate-pulse'
                    : justFinished
                      ? 'bg-emerald-500'
                      : 'bg-emerald-500/80',
                )}
              />
              <span className="font-mono text-[11px]">
                {isSpinning ? 'Refreshing...' : `Synced ${relativeText}`}
              </span>
              <RotateCw
                className={cn(
                  'size-3 text-muted-foreground/70 transition-transform duration-200',
                  isSpinning && 'animate-spin text-primary',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Button with text
  if (variant === 'button' || variant === 'ghost') {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={variant === 'ghost' ? 'ghost' : 'outline'}
              size={size ?? 'sm'}
              onClick={handleRefresh}
              disabled={isSpinning}
              className={cn(
                'gap-1.5 text-xs font-medium transition-all duration-200 shadow-2xs',
                isSpinning && 'opacity-80 pointer-events-none',
                className,
              )}
            >
              {justFinished ? (
                <Check className="size-3.5 text-emerald-500 transition-all" />
              ) : (
                <RotateCw
                  className={cn(
                    'size-3.5 transition-transform duration-300',
                    isSpinning && 'animate-spin text-primary',
                  )}
                />
              )}
              <span>{isSpinning ? 'Refreshing...' : label}</span>
              {showShortcut && !isSpinning && (
                <Kbd className="hidden sm:inline-flex text-[10px] px-1 py-0 font-mono ml-0.5">
                  {shortcutKey.toUpperCase()}
                </Kbd>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Toolbar or icon-only variant
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={size ?? (variant === 'toolbar' ? 'icon' : 'sm')}
            onClick={handleRefresh}
            disabled={isSpinning}
            className={cn(
              'size-9 text-muted-foreground hover:text-foreground transition-all duration-200',
              variant === 'toolbar' &&
                'border border-border/50 bg-card hover:bg-accent shadow-2xs rounded-md',
              isSpinning && 'opacity-80 pointer-events-none',
              className,
            )}
            aria-label="Refresh section data"
          >
            {justFinished ? (
              <Check className="size-3.5 text-emerald-500 transition-all duration-200 scale-110" />
            ) : (
              <RotateCw
                className={cn(
                  'size-3.5 transition-transform duration-200',
                  isSpinning && 'animate-spin text-primary',
                )}
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
