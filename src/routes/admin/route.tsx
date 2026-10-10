import { useEffect, useState } from 'react'
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
  Check,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Kbd } from '#/components/ui/kbd'
import { ThemeToggle } from '#/components/shared/theme-toggle'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [globalQ, setGlobalQ] = useState('')
  const [results, setResults] = useState<{
    products: { id: string; name: string; href: string }[]
    orders: { id: string; name: string; href: string }[]
    customers: { id: string; name: string; href: string }[]
    riders: { id: string; name: string; href: string }[]
  } | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)

  const currentPath = routerState.location.pathname

  // Global keyboard shortcut for Command Palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced search query
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

  const handleMarkNotifications = async () => {
    try {
      await markNotificationsFn()
      setNotificationsRead(true)
      toast.success('Notifications marked as read')
    } catch {
      toast.error('Failed to update notifications')
    }
  }

  const unreadCount = notificationsRead ? 0 : unread

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground antialiased">
        <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
          <SidebarHeader className="border-b border-border/40">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link
                    to="/admin"
                    className="flex items-center gap-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary font-bold text-xs text-primary-foreground">
                      M
                    </div>

                    <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                      <span className="font-semibold text-foreground">
                        Mezmani
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Admin console
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent className="gap-2 px-2 py-2">
            {NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.label} className="p-0">
                <SidebarGroupLabel className="px-2 text-[11px] font-medium tracking-normal text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = isCurrent(item)
                      const Icon = item.icon
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            className="text-xs transition-colors"
                          >
                            <Link to={item.to}>
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-border/40 p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Storefront" className="text-xs text-muted-foreground">
                  <Link to="/" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span>Storefront</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />

            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/admin">Admin</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="capitalize">
                    {crumbLabel(currentPath)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-1 items-center justify-center px-2 sm:px-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="h-8 w-full max-w-sm justify-between bg-muted/30 px-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:w-64 md:w-80"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Search admin...</span>
                  <span className="sm:hidden">Search...</span>
                </span>
                <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-8 w-8">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkNotifications}
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Check className="mr-1 h-3 w-3" /> Mark read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <a
                          key={n.id}
                          href={n.href}
                          className="flex flex-col gap-0.5 px-3 py-2.5 text-xs transition-colors hover:bg-muted/50"
                        >
                          <span className="font-medium text-foreground">{n.title}</span>
                          <span className="text-[11px] text-muted-foreground">{n.body}</span>
                        </a>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 gap-2 rounded-full p-1 pl-1 pr-2 hover:bg-accent">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary text-[10px] text-primary-foreground font-semibold">
                        {adminUser.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-xs font-medium text-foreground sm:inline-block">
                      {adminUser.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold leading-none">{adminUser.name}</p>
                      <p className="text-[11px] leading-none text-muted-foreground">{adminUser.email}</p>
                      <div className="pt-1">
                        <Badge variant="outline" className="text-[10px] font-normal capitalize">
                          {adminUser.role}
                        </Badge>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/" target="_blank" rel="noreferrer">
                      View storefront
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isLoggingOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 bg-muted/20 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>

        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput
            placeholder="Type a command or search..."
            value={globalQ}
            onValueChange={setGlobalQ}
          />
          <CommandList>
            <CommandEmpty>
              {globalQ.trim().length < 2
                ? 'Type at least 2 characters to search...'
                : 'No results found.'}
            </CommandEmpty>

            {results?.products && results.products.length > 0 && (
              <CommandGroup heading="Products">
                {results.products.map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => {
                      setSearchOpen(false)
                      window.location.href = p.href
                    }}
                  >
                    <Wine className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results?.orders && results.orders.length > 0 && (
              <CommandGroup heading="Orders">
                {results.orders.map((o) => (
                  <CommandItem
                    key={o.id}
                    onSelect={() => {
                      setSearchOpen(false)
                      window.location.href = o.href
                    }}
                  >
                    <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{o.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results?.customers && results.customers.length > 0 && (
              <CommandGroup heading="Customers">
                {results.customers.map((c) => (
                  <CommandItem
                    key={c.id}
                    onSelect={() => {
                      setSearchOpen(false)
                      window.location.href = c.href
                    }}
                  >
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results?.riders && results.riders.length > 0 && (
              <CommandGroup heading="Riders">
                {results.riders.map((r) => (
                  <CommandItem
                    key={r.id}
                    onSelect={() => {
                      setSearchOpen(false)
                      window.location.href = r.href
                    }}
                  >
                    <Bike className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{r.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
      </div>
    </SidebarProvider>
  )
}
