import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { ThemeToggle } from '#/components/shared/theme-toggle'
import { Badge } from '#/components/ui/badge'
import {
  Bike,
  Package,
  Wallet,
  User,
  LayoutDashboard,
} from 'lucide-react'

export function RiderLayout() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

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
              <span className="font-semibold text-sm tracking-tight">Mezmani</span>
              <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1 font-mono">
                RIDER
              </Badge>
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
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors ${
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
