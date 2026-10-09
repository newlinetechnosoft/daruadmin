import { useEffect, useMemo, useState } from 'react'
import {
  createFileRoute,
  Outlet,
  Link,
  redirect,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router'
import { checkAdminSessionFn } from '#/server/catalog/catalog.functions'
import {
  getAdminChromeFn,
  globalSearchFn,
  markNotificationsFn,
} from '#/server/operations/operations.functions'
import { authClient } from '#/lib/auth-client'
import {
  LayoutDashboard,
  Wine,
  ShoppingBag,
  Tags,
  Users,
  ExternalLink,
  LogOut,
  Menu,
  ChevronLeft,
  Search,
  Bell,
  Package,
  Bike,
  Shield,
  Wallet,
  CreditCard,
  Truck,
  Megaphone,
  BarChart3,
  Settings,
  ClipboardList,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const session = await checkAdminSessionFn()
    if (!session.authenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    if (!session.isAdmin) {
      throw redirect({ to: '/' })
    }
    return { adminUser: session.user }
  },
  loader: async () => {
    return getAdminChromeFn()
  },
  component: AdminLayout,
})

type NavItem = {
  label: string
  to: string
  exact?: boolean
  icon: LucideIcon
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/admin', exact: true, icon: LayoutDashboard }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Liquor', to: '/admin/liquor', icon: Wine },
      { label: 'Grocery', to: '/admin/grocery', icon: ShoppingBag },
      { label: 'Categories', to: '/admin/taxonomy', icon: Tags },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { label: 'Orders', to: '/admin/orders', icon: ClipboardList },
      { label: 'Customers', to: '/admin/customers', icon: Users },
      { label: 'Inventory', to: '/admin/inventory', icon: Package },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Riders', to: '/admin/riders', icon: Bike },
      { label: 'Staff', to: '/admin/staff', icon: Shield },
      { label: 'Shipping', to: '/admin/shipping', icon: Truck },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Accounts', to: '/admin/accounts', icon: Wallet },
      { label: 'Payments', to: '/admin/payments', icon: CreditCard },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Marketing', to: '/admin/marketing', icon: Megaphone },
      { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [{ label: 'Settings', to: '/admin/settings', icon: Settings }],
  },
]

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items)

function crumbLabel(path: string) {
  if (path === '/admin') return 'Dashboard'
  const item = ALL_NAV.find((n) => n.to !== '/admin' && path.startsWith(n.to))
  if (item) return item.label
  const last = path.split('/').filter(Boolean).pop() ?? 'Admin'
  return last.replaceAll('-', ' ')
}

function AdminLayout() {
  const { adminUser } = Route.useRouteContext()
  const { unread, notifications } = Route.useLoaderData()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  const [globalQ, setGlobalQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [results, setResults] = useState<
    { products: { id: string; name: string; href: string }[]; orders: { id: string; name: string; href: string }[]; customers: { id: string; name: string; href: string }[]; riders: { id: string; name: string; href: string }[] } | null
  >(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const currentPath = routerState.location.pathname

  useEffect(() => {
    const saved = localStorage.getItem('mezmani-admin-collapsed')
    if (saved === '1') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('mezmani-admin-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (globalQ.trim().length < 2) {
      setResults(null)
      return
    }
    const t = setTimeout(async () => {
      const data = await globalSearchFn({ data: { q: globalQ } })
      setResults(data)
    }, 220)
    return () => clearTimeout(t)
  }, [globalQ])

  const filteredGroups = useMemo(() => {
    const q = navQuery.trim().toLowerCase()
    if (!q) return NAV_GROUPS
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0)
  }, [navQuery])

  const isCurrent = (item: NavItem) => {
    if (item.exact) return currentPath === item.to
    return currentPath === item.to || currentPath.startsWith(item.to + '/')
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      await authClient.signOut()
      toast.success('Signed out successfully')
      navigate({ to: '/login' })
    } catch {
      toast.error('Failed to sign out')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-3">
        <Link to="/admin" className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm">
            M
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-slate-900">
                Mezmani
              </div>
              <div className="text-[11px] text-slate-500">Admin console</div>
            </div>
          )}
        </Link>
        <button
          type="button"
          className="hidden h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 md:grid"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search menu"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-8 text-xs outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isCurrent(item)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      active
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          to="/"
          target="_blank"
          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100 ${collapsed ? 'justify-center' : ''}`}
        >
          <ExternalLink className="h-4 w-4" />
          {!collapsed && <span>Storefront</span>}
        </Link>
      </div>
    </>
  )

  return (
    <div className="admin-shell flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          collapsed ? 'md:w-[72px]' : 'md:w-64'
        } w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {sidebar}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <nav className="hidden items-center gap-1.5 text-sm text-slate-500 md:flex">
            <Link to="/admin" className="hover:text-slate-900">
              Admin
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium capitalize text-slate-900">
              {crumbLabel(currentPath)}
            </span>
          </nav>

          <div className="relative mx-auto hidden w-full max-w-md md:block">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={globalQ}
              onChange={(e) => {
                setGlobalQ(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search orders, products, customers..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            />
            {searchOpen && results && (
              <div className="absolute top-11 z-40 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {['products', 'orders', 'customers', 'riders'].map((key) => {
                  const rows = results[key as keyof typeof results]
                  if (!rows.length) return null
                  return (
                    <div key={key} className="border-b border-slate-100 last:border-0">
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                        {key}
                      </div>
                      {rows.map((r) => (
                        <a
                          key={r.id}
                          href={r.href}
                          onClick={() => setSearchOpen(false)}
                          className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {r.name}
                        </a>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600"
                    onClick={() => markNotificationsFn()}
                  >
                    Mark read
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-slate-400">
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem key={n.id} asChild>
                      <a href={n.href} className="flex flex-col items-start gap-0.5">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="text-xs text-slate-500">{n.body}</span>
                      </a>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {adminUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left leading-tight sm:block">
                  <div className="text-sm font-medium">{adminUser.name}</div>
                  <div className="text-[11px] capitalize text-slate-500">
                    {adminUser.role}
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate text-sm">{adminUser.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/" target="_blank">
                    View store
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  className="text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Signing out...' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
