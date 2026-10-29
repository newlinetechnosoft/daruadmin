import { useEffect, useState, useMemo } from 'react'
import {
  createFileRoute,
  Outlet,
  Link,
  redirect,
  useRouterState,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { markNotificationsFn } from '#/server/operations/operations.functions'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import type { ModuleKey } from '#/server/operations/types'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import { Awesomebar } from '#/components/shared/awesomebar'
import { ShortcutsHelp } from '#/components/shared/shortcuts-help'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
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
  Award,
  Store,
  Trash2,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  beforeLoad: async ({ location, context }) => {
    const access = await context.queryClient.fetchQuery(adminQueries.access())
    if (!access.authenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    if (!access.user.isActive || access.user.banned) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    if (access.user.role === 'rider') {
      throw redirect({ to: '/rider' })
    }
    if (access.user.role !== 'admin' && access.user.role !== 'manager') {
      throw redirect({ to: '/' })
    }
    return {
      user: access.user,
      grants: access.grants,
      adminUser: access.user,
    }
  },
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.chrome())
  },
  component: AdminLayout,
})

type NavSubItem = {
  label: string
  to: string
  search?: Record<string, string>
}

type NavItem = {
  label: string
  to: string
  exact?: boolean
  icon: LucideIcon
  module: ModuleKey
  subItems?: NavSubItem[]
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Home',
    items: [
      {
        label: 'Workspace',
        to: '/admin',
        exact: true,
        icon: LayoutDashboard,
        module: 'dashboard',
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        label: 'Orders',
        to: '/admin/orders',
        icon: ClipboardList,
        module: 'orders',
      },
      {
        label: 'Customers',
        to: '/admin/customers',
        icon: Users,
        module: 'customers',
      },
      {
        label: 'Marketing',
        to: '/admin/marketing',
        icon: Megaphone,
        module: 'marketing',
      },
    ],
  },
  {
    label: 'Sourcing and delivery',
    items: [
      {
        label: 'Dealers',
        to: '/admin/dealers',
        icon: Store,
        module: 'dealers',
      },
      { label: 'Riders', to: '/admin/riders', icon: Bike, module: 'riders' },
      {
        label: 'Shipping',
        to: '/admin/shipping',
        icon: Truck,
        module: 'shipping',
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Liquor', to: '/admin/liquor', icon: Wine, module: 'liquor' },
      {
        label: 'Grocery',
        to: '/admin/grocery',
        icon: ShoppingBag,
        module: 'grocery',
      },
      {
        label: 'Categories',
        to: '/admin/taxonomy',
        icon: Tags,
        module: 'categories',
      },
      {
        label: 'Brands',
        to: '/admin/brands',
        icon: Award,
        module: 'brands',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        label: 'Accounts',
        to: '/admin/accounts',
        icon: Wallet,
        module: 'accounts',
        subItems: [
          {
            label: 'Ledger',
            to: '/admin/accounts',
            search: { tab: 'ledger' },
          },
          {
            label: 'Transaction',
            to: '/admin/accounts',
            search: { tab: 'transactions' },
          },
          {
            label: 'Dealer Ledger',
            to: '/admin/accounts',
            search: { tab: 'dealer-ledger' },
          },
          {
            label: 'Sales Account',
            to: '/admin/accounts',
            search: { tab: 'sales-account' },
          },
          {
            label: 'Salary Account',
            to: '/admin/accounts',
            search: { tab: 'salary-account' },
          },
          {
            label: 'Chart of Accounts',
            to: '/admin/accounts',
            search: { tab: 'chart-of-accounts' },
          },
        ],
      },
      {
        label: 'Payments',
        to: '/admin/payments',
        icon: CreditCard,
        module: 'payments',
      },
      {
        label: 'Reports',
        to: '/admin/reports',
        icon: BarChart3,
        module: 'reports',
      },
    ],
  },
  {
    label: 'People and system',
    items: [
      {
        label: 'Staff & Users',
        to: '/admin/staff',
        icon: Shield,
        module: 'staff',
      },
      {
        label: 'Settings',
        to: '/admin/settings',
        icon: Settings,
        module: 'settings',
      },
      {
        label: 'Recycle Bin',
        to: '/admin/recycle-bin',
        icon: Trash2,
        module: 'settings',
      },
    ],
  },
]

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items)

function crumbLabel(path: string) {
  if (path === '/admin') return 'Workspace'
  const item = ALL_NAV.find((n) => n.to !== '/admin' && path.startsWith(n.to))
  if (item) return item.label
  const last = path.split('/').filter(Boolean).pop() ?? 'Admin'
  return last.replaceAll('-', ' ')
}

function AdminLayout() {
  const { adminUser, grants } = Route.useRouteContext()
  const { unread, notifications } = Route.useLoaderData()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchOpen, setSearchOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
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

  const isCurrent = (item: NavItem) => {
    if (item.exact) return currentPath === item.to
    return currentPath === item.to || currentPath.startsWith(item.to + '/')
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      await authClient.signOut()
      await clearAllLocalData()
      queryClient.clear()
      await router.invalidate()
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

  const visibleNavGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => can(grants, item.module, 'view')),
    })).filter((group) => group.items.length > 0)
  }, [grants])

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground antialiased">
        <Sidebar
          collapsible="icon"
          className="border-r border-border bg-sidebar"
        >
          <SidebarHeader className="border-b border-border/40">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link to="/admin" className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-black text-sm text-primary-foreground shadow-xs">
                      M
                    </div>

                    <div className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="font-bold text-sm text-sidebar-foreground tracking-tight">
                        Mezmani
                      </span>
                      <span className="text-xs text-sidebar-foreground/60 font-medium">
                        {adminUser.role === 'manager'
                          ? 'Manager Console'
                          : 'Admin Console'}
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent className="gap-2 px-2 py-2">
            {visibleNavGroups.map((group) => (
              <SidebarGroup key={group.label} className="p-0">
                <SidebarGroupLabel className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
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
                            className="h-9 px-3 text-sm font-medium transition-colors data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-semibold hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                          >
                            <Link to={item.to}>
                              <Icon className="h-4.5 w-4.5 shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                          {item.subItems &&
                            item.subItems.length > 0 &&
                            active && (
                              <SidebarMenuSub className="my-1 ml-3 border-l border-border/60 pl-2">
                                {item.subItems.map((sub) => {
                                  const currentTab =
                                    (routerState.location.search as any)?.tab ||
                                    'ledger'
                                  const isSubActive =
                                    currentPath === sub.to &&
                                    (sub.search?.tab === currentTab ||
                                      (!sub.search?.tab &&
                                        currentTab === 'ledger'))
                                  return (
                                    <SidebarMenuSubItem key={sub.label}>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={isSubActive}
                                        size="sm"
                                        className="h-7 py-1 px-2.5 text-xs font-medium rounded-md transition-colors"
                                      >
                                        <Link to={sub.to} search={sub.search}>
                                          <span>{sub.label}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  )
                                })}
                              </SidebarMenuSub>
                            )}
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
                <SidebarMenuButton
                  asChild
                  tooltip="Storefront"
                  className="text-xs text-muted-foreground"
                >
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

        <SidebarInset className="flex flex-1 flex-col min-w-0 overflow-x-clip">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />

            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/admin">
                      {adminUser.role === 'manager' ? 'Manager' : 'Admin'}
                    </Link>
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
                className="h-9 w-full max-w-sm justify-between bg-card border-border px-3 text-xs sm:text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:w-64 md:w-80 shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {adminUser.role === 'manager'
                      ? 'Search console...'
                      : 'Search admin...'}
                  </span>
                  <span className="sm:hidden">Search...</span>
                </span>
                <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8"
                  >
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
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-medium"
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
                          <span className="font-medium text-foreground">
                            {n.title}
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {n.body}
                          </span>
                        </a>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 gap-2 rounded-full p-1 pl-1 pr-2 hover:bg-accent"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground font-bold">
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
                      <p className="text-xs font-semibold leading-none">
                        {adminUser.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {adminUser.email}
                      </p>
                      <div className="pt-1">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold capitalize px-2 py-0.5"
                        >
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
                    onSelect={() => setShowSignOutConfirm(true)}
                    disabled={isLoggingOut}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 min-w-0 bg-background p-4 sm:p-6 lg:p-7 overflow-x-clip">
            <Outlet />
          </main>
        </SidebarInset>

        <Awesomebar open={searchOpen} onOpenChange={setSearchOpen} />
        <ShortcutsHelp />

        <ConfirmDialog
          open={showSignOutConfirm}
          onOpenChange={setShowSignOutConfirm}
          title="Sign out of Admin Portal?"
          description="Are you sure you want to sign out? Any unsaved edits in active forms may be lost."
          confirmLabel="Sign out"
          tone="destructive"
          isLoading={isLoggingOut}
          icon={<LogOut className="h-5 w-5 text-destructive" />}
          onConfirm={handleSignOut}
        />
      </div>
    </SidebarProvider>
  )
}
