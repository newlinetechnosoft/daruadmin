import { useState, useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Clock, X, ChevronUp, ArrowRight, Timer } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { storeQueries } from '#/queries/admin'
import { StoreCountdownTimer } from '#/components/store/countdown-timer'

const STORAGE_KEY = 'mezmani_closed_notice_dismissed'

export function StoreClosedPopup() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  // Never render on management dashboards
  const isDashboard =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/superadmin') ||
    pathname.startsWith('/rider')

  const { data: storeStatus } = useQuery(storeQueries.operatingStatus())

  const [isDismissed, setIsDismissed] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // Initialize dismissed state from sessionStorage on client
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY)
      if (dismissed === 'true') {
        setIsDismissed(true)
        setIsExpanded(false)
      }
    } catch {
      // ignore
    }
  }, [])

  // If dashboard route, store is currently open, or notice is disabled, do not render
  if (isDashboard || !storeStatus || storeStatus.isOpen || storeStatus.showNotice === false) {
    return null
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setIsExpanded(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
  }

  const handleReopen = () => {
    setIsExpanded(true)
  }

  const openingTime = storeStatus.nextOpeningFormatted || 'Tomorrow at 10:00 AM'
  const allowAdvanceOrders = storeStatus.allowAdvanceOrders !== false

  // Minimized pill when dismissed: stays clearly accessible without cluttering the screen
  if (isDismissed && !isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <button
          type="button"
          onClick={handleReopen}
          className="group flex items-center gap-2.5 rounded-full border-2 border-amber-500/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2 shadow-xl shadow-black/20 transition-all hover:border-amber-500 hover:scale-105 active:scale-95"
          title="Click to view store operating hours and countdown"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <span>Closed</span>
            <span className="text-zinc-400">·</span>
            <StoreCountdownTimer
              targetDateTime={storeStatus.nextOpeningDateTime}
              fallbackFormatted={openingTime}
              variant="compact"
            />
          </span>
          <ChevronUp className="h-3.5 w-3.5 text-zinc-500 group-hover:text-amber-600 transition-colors shrink-0" />
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Store Operating Notice"
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 w-auto sm:w-[430px] max-w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-white dark:bg-zinc-950 p-4 sm:p-5 text-zinc-900 dark:text-zinc-50 shadow-2xl shadow-black/25 dark:shadow-black/75">
        {/* Subtle decorative amber glow */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />

        {/* Top Header: Status + Close Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-mono">
              {allowAdvanceOrders ? 'Store Closed · Pre-Orders Open' : 'Store Currently Closed'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            aria-label="Close operating notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main Notice Content */}
        <div className="mt-3 space-y-1">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
            Mezmani is currently closed for immediate delivery.
          </h4>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            Place your order now and it will be delivered after reopening!
          </p>
        </div>

        {/* Reopening Schedule & Stylish Countdown Box */}
        <div className="mt-3.5 space-y-3 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-3 sm:p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
              <div className="truncate">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium mr-1.5">Opens:</span>
                <strong className="font-mono font-bold text-sm text-amber-950 dark:text-amber-200">
                  {openingTime}
                </strong>
              </div>
            </div>
          </div>

          {/* Stylish Countdown Timer Display */}
          <div className="pt-2.5 border-t border-amber-200/70 dark:border-amber-500/20">
            <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2 font-mono">
              <span className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span>Live Countdown to Reopen</span>
              </span>
            </div>
            <StoreCountdownTimer
              targetDateTime={storeStatus.nextOpeningDateTime}
              fallbackFormatted={openingTime}
              variant="boxes"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5"
          >
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDismiss}
            className="h-8 text-xs font-semibold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 shadow-xs"
          >
            <span>Advance Order Now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
