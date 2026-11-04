import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { ThemeToggle } from '#/components/shared/theme-toggle'
import { Badge } from '#/components/ui/badge'
import { useRiderOutbox } from '#/lib/idb/outbox'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { riderQueries } from '#/queries/rider'
import {
  playOrderAlertSound,
  showBrowserNotification,
  unlockNotificationSound,
} from '#/lib/order-notifications'
import type { OrderNotification } from '#/lib/order-notifications'
import { toast } from 'sonner'
import {
  Bike,
  Package,
  Wallet,
  User,
  LayoutDashboard,
  CloudOff,
  RefreshCw,
  Bell,
} from 'lucide-react'
import { Button } from '#/components/ui/button'

export function RiderLayout() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const { pendingCount, isOnline, flushOutbox } = useRiderOutbox()
  const { data: portalData } = useQuery({
    ...riderQueries.portal(),
    refetchInterval: 15_000,
  })
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  )

  useEffect(() => {
    const unlock = () => unlockNotificationSound()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    const notifications = (portalData?.notifications ||
      []) as OrderNotification[]
    if (!notifications.length) return

    const storageKey = 'rider-last-notification-id'
    const previousId = localStorage.getItem(storageKey)
    const unread = notifications.find(
      (item) => item.id !== previousId && !item.read,
    )

    if (!previousId) {
      localStorage.setItem(storageKey, notifications[0].id)
      return
    }

    if (unread) {
      playOrderAlertSound()
      showBrowserNotification(unread.title, unread.body, unread.href)
      localStorage.setItem(storageKey, unread.id)
    }
  }, [portalData?.notifications])

  const requestRiderNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications are not supported on this device.')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    unlockNotificationSound()
    if (permission === 'granted') {
      toast.success('Delivery notifications enabled.')
    } else {
      toast.error('Notification permission was not enabled.')
    }
  }

  const navItems = [
    {
      to: '/rider',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: pathname === '/rider' || pathname === '/rider/',
    },
    {
      to: '/rider/deliveries',
      label: 'Deliveries',
      icon: Package,
      active: pathname.startsWith('/rider/deliveries'),
    },
    {
      to: '/rider/earnings',
      label: 'Earnings',
      icon: Wallet,
      active: pathname.startsWith('/rider/earnings'),
    },
    {
      to: '/rider/profile',
      label: 'Profile',
      icon: User,
      active: pathname.startsWith('/rider/profile'),
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
              <Bike className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">
                Mezmani
              </span>
              <Badge
                variant="outline"
                className="ml-1.5 text-xs py-0 px-1 font-mono"
              >
                RIDER
              </Badge>
              {!isOnline && (
                <Badge
                  variant="destructive"
                  className="ml-1.5 text-xs py-0 px-1 gap-1"
                >
                  <CloudOff className="h-2.5 w-2.5" />
                  Offline
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs py-0 px-1 cursor-pointer gap-1"
                  onClick={() => flushOutbox()}
                  title="Click to sync now"
                >
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  {pendingCount} queued
                </Badge>
              )}
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    item.active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={requestRiderNotifications}
              >
                <Bell className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Enable alerts</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur px-2 py-1 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                item.active
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
