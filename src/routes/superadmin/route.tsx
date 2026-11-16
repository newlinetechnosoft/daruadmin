import { useState, useMemo } from 'react'
import {
  createFileRoute,
  Outlet,
  Link,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { isSuperAdmin } from '#/server/auth/permissions-shared'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import { ThemeToggle } from '#/components/shared/theme-toggle'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { Button } from '#/components/ui/button'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Separator } from '#/components/ui/separator'
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import {
  Terminal,
  Store,
  LayoutDashboard,
  LogOut,
  Cpu,
  RefreshCw,
  ExternalLink,
  Users,
  Wine,
  Bike,
  Tags,
  Award,
  Sliders,
  DollarSign,
  Megaphone,
  Globe,
  Shield,
  FileText,
  KeyRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ChangePasswordDialog } from '#/components/auth/change-password-dialog'
import type { SuperAdminTabKey } from '#/components/panels/superadmin'

interface SuperAdminNavItem {
  key: SuperAdminTabKey
  label: string
  icon: LucideIcon
  category: string
}

interface SuperAdminNavGroup {
  label: string
  items: SuperAdminNavItem[]
}

const SUPERADMIN_NAV_GROUPS: SuperAdminNavGroup[] = [
  {
    label: 'Data & Fleet',
    items: [
      { key: 'customers', label: 'Customers Management', icon: Users, category: 'Data & Fleet' },
      { key: 'items', label: 'Catalog Items Management', icon: Wine, category: 'Data & Fleet' },
      { key: 'dealers', label: 'Dealers & Suppliers', icon: Store, category: 'Data & Fleet' },
      { key: 'riders', label: 'Delivery Riders', icon: Bike, category: 'Data & Fleet' },
      { key: 'categories', label: 'Categories Management', icon: Tags, category: 'Data & Fleet' },
      { key: 'brands', label: 'Brands Management', icon: Award, category: 'Data & Fleet' },
    ],
  },
  {
    label: 'Developer Engine',
    items: [
      { key: 'features', label: 'Dynamic Feature Flags', icon: Sliders, category: 'Developer Engine' },
      { key: 'pricing', label: 'Pricing & Delivery Rules', icon: DollarSign, category: 'Developer Engine' },
      { key: 'console', label: 'Telemetry & Sandbox', icon: Terminal, category: 'Developer Engine' },
    ],
  },
  {
    label: 'Live Governance',
    items: [
      { key: 'admin-panel', label: 'Admin Panel Management', icon: Megaphone, category: 'Live Governance' },
      { key: 'system', label: 'System Management', icon: Cpu, category: 'Live Governance' },
      { key: 'website', label: 'Website Management', icon: Globe, category: 'Live Governance' },
    ],
  },
  {
    label: 'Security & Access',
    items: [
      { key: 'users', label: 'User & Role Engine', icon: Shield, category: 'Security & Access' },
      { key: 'audit', label: 'Live Audit Trail', icon: FileText, category: 'Security & Access' },
    ],
  },
]

export const Route = createFileRoute('/superadmin')({
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
    if (!isSuperAdmin(access.user)) {
      throw redirect({ to: '/admin' })
    }
    return {
      user: access.user,
      grants: access.grants,
      adminUser: access.user,
    }
  },
  loader: async ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(adminQueries.superAdminOverview()),
      context.queryClient.ensureQueryData(adminQueries.superAdminFeatureFlags()),
      context.queryClient.ensureQueryData(adminQueries.superAdminPricingRules()),
      context.queryClient.ensureQueryData(adminQueries.superAdminTelemetry()),
    ])
  },
  component: SuperAdminLayout,
})

function SuperAdminLayout() {
  const navigate = useNavigate()
  const router = useRouter()
  const routerState = useRouterState()
  const queryClient = useQueryClient()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: access } = useQuery(adminQueries.access())
  const { data: telemetry } = useQuery(adminQueries.superAdminTelemetry())

  const currentTab =
    ((routerState.location.search as any)?.tab as SuperAdminTabKey) || 'customers'

  const currentItem = useMemo(() => {
    for (const group of SUPERADMIN_NAV_GROUPS) {
      const found = group.items.find((i) => i.key === currentTab)
      if (found) return found
    }
    return SUPERADMIN_NAV_GROUPS[0].items[0]
  }, [currentTab])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'superadmin'] })
      await router.invalidate()
      toast.success('Developer telemetry & system data refreshed')
    } catch {
      toast.error('Failed to refresh developer data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authClient.signOut()
      await clearAllLocalData().catch(() => {})
      queryClient.clear()
      await router.invalidate()
      toast.success('Logged out from Super Admin Command Center')
      navigate({ to: '/login' })
    } catch {
      toast.error('Error logging out')
    }
  }

  const currentUser = access?.user

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground antialiased font-sans">
        {/* Super Admin Side Menu Navigation */}
        <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
          {/* Header */}
          <SidebarHeader className="border-b border-border/40">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link to="/superadmin" search={{ tab: 'customers' }} className="flex items-center gap-2.5">
                    <div className="flex shrink-0 items-center">
                      <img
                        src="https://mezmani.com/mezmani_logo.webp"
                        onError={(e) => {
                          const target = e.currentTarget
                          if (target.src !== `${window.location.origin}/mezmani_logo.webp`) {
                            target.src = '/mezmani_logo.webp'
                          }
                        }}
                        alt="Mezmani"
                        width="110"
                        height="32"
                        className="h-7 w-auto object-contain dark:hidden"
                      />
                      <img
                        src="https://mezmani.com/mezmani_logo_bg.svg"
                        onError={(e) => {
                          const target = e.currentTarget
                          if (target.src !== `${window.location.origin}/mezmani_logo_bg.svg`) {
                            target.src = '/mezmani_logo_bg.svg'
                          }
                        }}
                        alt="Mezmani"
                        width="110"
                        height="32"
                        className="h-7 w-auto object-contain hidden dark:block"
                      />
                    </div>
                    <div className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="font-bold text-xs text-primary font-mono tracking-tight uppercase">
                        Super Admin
                      </span>
                      <span className="text-[10px] text-sidebar-foreground/60 font-medium truncate">
                        Developer Command Center
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          {/* Nav Groups matching user specifications */}
          <SidebarContent className="gap-2 px-2 py-2">
            {SUPERADMIN_NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.label} className="p-0">
                <SidebarGroupLabel className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = currentTab === item.key
                      const Icon = item.icon
                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.label}
                            className="h-9 px-3 text-sm font-medium transition-colors data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-semibold hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                          >
                            <Link to="/superadmin" search={{ tab: item.key }}>
                              <Icon className="h-4.5 w-4.5 shrink-0" />
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

          {/* Footer */}
          <SidebarFooter className="border-t border-border/40 p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Storefront">
                  <Link to="/" target="_blank" rel="noreferrer">
                    <Store className="h-4 w-4" />
                    <span>View Storefront</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Store Admin Operations">
                  <Link to="/admin/orders">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Store Admin (/admin)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLogoutOpen(true)}
                  tooltip="Sign Out"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        {/* Main Content View with Header Bar */}
        <SidebarInset className="min-w-0 flex-1 flex flex-col">
          {/* Header Bar */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link to="/superadmin" search={{ tab: 'customers' }}>
                        Super Admin
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden sm:block">
                    <span className="text-muted-foreground">{currentItem.category}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold text-foreground">
                      {currentItem.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2">
              {telemetry && (
                <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-muted/40 border border-border text-xs font-mono text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  <span>Node {telemetry.nodeVersion}</span>
                  <span className="text-border">|</span>
                  <span
                    className={
                      telemetry.dbStatus === 'connected'
                        ? 'text-emerald-500 flex items-center gap-1 font-semibold'
                        : 'text-amber-500 flex items-center gap-1 font-semibold'
                    }
                  >
                    DB: {telemetry.dbLatencyMs}ms
                  </span>
                  <span className="text-border">|</span>
                  <span className="uppercase text-[11px] font-bold">{telemetry.environment}</span>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 text-xs font-mono gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>

              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition"
                title="Open customer storefront"
              >
                <Store className="h-3.5 w-3.5" />
                <span>Storefront</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>

              <Link
                to="/admin/orders"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition"
                title="Jump to Store Operations (/admin)"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Store Admin</span>
              </Link>

              <ThemeToggle />

              {/* Profile badge & logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <Avatar className="h-7 w-7 ring-1 ring-primary/40">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-mono font-bold">
                    DEV
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-medium text-foreground leading-tight">
                    {currentUser?.name || 'Developer Admin'}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono leading-tight">
                    {currentUser?.email || 'admin@newline.com'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChangePasswordOpen(true)}
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                  title="Change Super Admin password"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLogoutOpen(true)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  title="Sign out of developer command center"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Body */}
          <main className="flex-1 p-4 lg:p-6 max-w-[1700px] w-full mx-auto">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="border-t border-border bg-muted/10 px-6 py-3 text-xs text-muted-foreground font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-primary">●</span>
              <span>Mezmani Developer Runtime Engine</span>
              <span className="text-border">|</span>
              <span>Zero-downtime Dynamic Configuration</span>
            </div>
            <div>Authorized Developer Team Session // Admin Superadmin</div>
          </footer>
        </SidebarInset>

        {/* Logout confirmation */}
        <ConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          title="Sign Out of Developer Command Center?"
          description="Are you sure you want to end your Super Admin developer session? You will be redirected to the sign-in page."
          confirmLabel="Sign Out"
          tone="destructive"
          onConfirm={handleLogout}
        />

        {/* Change password dialog */}
        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
          userName={currentUser?.name || 'Developer Super Admin'}
          userEmail={currentUser?.email || 'admin@newline.com'}
        />
      </div>
    </SidebarProvider>
  )
}
