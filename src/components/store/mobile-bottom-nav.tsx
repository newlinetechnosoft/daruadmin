import { Link, useRouterState } from '@tanstack/react-router'
import {
  Home,
  Wine,
  UtensilsCrossed,
  ReceiptText,
  User,
} from 'lucide-react'
import { cn } from '#/lib/utils'

interface NavItem {
  id: string
  label: string
  to: string
  icon: typeof Home
  match: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    to: '/',
    icon: Home,
    match: (path) => path === '/',
  },
  {
    id: 'drinks',
    label: 'Drinks',
    to: '/drinks',
    icon: Wine,
    match: (path) => path === '/drinks' || path.startsWith('/drinks/'),
  },
  {
    id: 'food',
    label: 'Food',
    to: '/food',
    icon: UtensilsCrossed,
    match: (path) => path === '/food' || path.startsWith('/food/'),
  },
  {
    id: 'orders',
    label: 'Orders',
    to: '/orders',
    icon: ReceiptText,
    match: (path) =>
      path === '/orders' ||
      path.startsWith('/orders/') ||
      path.startsWith('/track'),
  },
  {
    id: 'profile',
    label: 'Profile',
    to: '/profile',
    icon: User,
    match: (path) => path === '/profile' || path.startsWith('/profile/'),
  },
]

export function MobileBottomNav() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  })

  // Do not render on administrative, driver, or API routes
  const isExcluded =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/superadmin') ||
    pathname.startsWith('/rider') ||
    pathname.startsWith('/api')

  if (isExcluded) return null

  return (
    <aside
      aria-label="Mobile Navigation"
      className="fixed bottom-3 inset-x-3 sm:max-w-md sm:mx-auto z-40 md:hidden pointer-events-auto select-none"
    >
      <nav className="relative rounded-2xl border border-border/80 bg-card/85 dark:bg-card/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.55)] p-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)]">
        {/* Subtle ambient gradient sheen */}
        <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

        <ul className="grid grid-cols-5 items-center justify-around gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.match(pathname)
            const Icon = item.icon

            return (
              <li key={item.id} className="relative">
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-90',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {/* Icon Container with subtle animation */}
                  <div className="relative flex items-center justify-center transition-transform duration-200">
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-all duration-200',
                        isActive
                          ? 'scale-110 text-primary drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)] stroke-[2.25]'
                          : 'stroke-[1.75] group-hover:scale-105 group-hover:text-foreground',
                      )}
                    />

                    {/* Small glowing dot indicator for active tab */}
                    {isActive && (
                      <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'mt-1 text-[10px] tracking-tight leading-none transition-colors duration-150',
                      isActive
                        ? 'font-bold text-primary'
                        : 'font-medium text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
