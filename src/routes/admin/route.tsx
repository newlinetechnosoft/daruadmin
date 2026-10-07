import { useState } from 'react'
import {
  createFileRoute,
  Outlet,
  Link,
  redirect,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router'
import { checkAdminSessionFn } from '#/server/catalog/catalog.functions'
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
  X,
  ChevronRight,
  Database,
} from 'lucide-react'
import { toast } from 'sonner'

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
      throw redirect({
        to: '/',
      })
    }
    return { adminUser: session.user }
  },
  component: AdminLayout,
})

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/admin',
    exact: true,
    icon: LayoutDashboard,
  },
  {
    label: 'Liquor Catalog',
    to: '/admin/liquor',
    exact: false,
    icon: Wine,
  },
  {
    label: 'Grocery & Munchies',
    to: '/admin/grocery',
    exact: false,
    icon: ShoppingBag,
  },
  {
    label: 'Categories & Brands',
    to: '/admin/taxonomy',
    exact: false,
    icon: Tags,
  },
  {
    label: 'User Roles',
    to: '/admin/users',
    exact: false,
    icon: Users,
  },
]

function AdminLayout() {
  const { adminUser } = Route.useRouteContext()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const currentPath = routerState.location.pathname

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

  const isCurrent = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.exact) return currentPath === item.to
    return currentPath.startsWith(item.to)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#101010] antialiased md:flex-row">
      {/* Mobile top header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black bg-white px-5 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center bg-black text-sm font-black tracking-tighter text-white">
            D
          </div>
          <div className="leading-none">
            <span className="text-base font-black uppercase tracking-tighter">
              Mezmani
            </span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Admin
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="grid h-10 w-10 cursor-pointer place-items-center border border-black bg-white transition-colors hover:bg-black hover:text-white"
          aria-label="Toggle Menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-black text-white transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 md:shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-white/15 p-6">
          <div className="flex items-center gap-3.5">
            <div className="grid h-10 w-10 place-items-center bg-white text-lg font-black tracking-tighter text-black">
              D
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black uppercase tracking-tighter">
                  Mezmani
                </span>
                <span className="border border-white/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/80">
                  Admin
                </span>
              </div>
              <span className="mt-1.5 block text-[11px] text-neutral-400">
                Kathmandu Central Hub
              </span>
            </div>
          </div>
          {mobileMenuOpen && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              className="grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent text-neutral-400 transition-colors hover:text-white md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* DB status */}
        <div className="flex items-center justify-between border-b border-white/15 px-6 py-3 text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Neon Postgres</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Live
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Core modules
          </div>

          {NAV_ITEMS.map((item) => {
            const active = isCurrent(item)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-white font-semibold text-black'
                    : 'text-neutral-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {active && <ChevronRight className="h-3.5 w-3.5" />}
              </Link>
            )
          })}

          <div className="px-3 pb-2 pt-7 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Storefront
          </div>

          <Link
            to="/"
            target="_blank"
            className="flex items-center justify-between px-3.5 py-3 text-sm text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="h-4 w-4" />
              <span>Live Storefront</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              New tab
            </span>
          </Link>
        </nav>

        {/* Admin profile */}
        <div className="border-t border-white/15 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-black">
              {adminUser.name.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {adminUser.name}
              </div>
              <div className="truncate text-[11px] text-neutral-400">
                {adminUser.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border border-white/30 bg-transparent px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main */}
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-white">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-black bg-white/90 px-8 py-4 backdrop-blur md:flex">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            <span className="text-black">Mezmani Admin</span>
            <span className="text-neutral-300">/</span>
            <span className="text-black">
              {currentPath.replace('/admin', '').replace('/', '') ||
                'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border border-black/20 px-3 py-2 text-[11px] font-medium text-neutral-600">
              <Database className="h-3.5 w-3.5" />
              <span>PostgreSQL • Ready</span>
            </div>

            <Link
              to="/"
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 bg-black px-4 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
            >
              <span>View store</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {/* Child route outlet — pages provide their own padding */}
        <div className="mx-auto w-full max-w-7xl flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
