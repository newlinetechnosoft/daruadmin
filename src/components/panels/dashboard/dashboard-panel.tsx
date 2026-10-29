import { Link, getRouteApi } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { DataRefreshButton } from '#/components/shared/data-refresh-button'
import { DataSection } from '#/components/shared/data-section'
import { MoneyText } from '#/components/shared/money-text'
import { DateText } from '#/components/shared/date-text'
import { StatusIndicator } from '#/components/shared/status-indicator'
import { PageShell, PageHeader } from '#/components/shared/page-shell'
import { LineChart } from '#/components/shared/charts'
import {
  Wallet,
  ShoppingCart,
  TrendingUp,
  Bike,
  Store,
  PlusCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  Banknote,
  Sparkles,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Badge } from '#/components/ui/badge'

const routeApi = getRouteApi('/admin/')

export function DashboardPanel() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const range = search.range ?? '30d'

  const { data, isFetching, refetch } = useSuspenseQuery(
    adminQueries.dashboard({
      range: range as any,
      from: search.from,
      to: search.to,
    }),
  )

  // Determine attention queue numbers based on current order status counts
  const pendingOrders =
    data.orderStatus.find((s) => s.label.toLowerCase().includes('pending'))
      ?.value ?? 0
  const confirmedOrders =
    data.orderStatus.find((s) => s.label.toLowerCase().includes('confirmed'))
      ?.value ?? 0
  const outForDelivery =
    data.orderStatus.find(
      (s) =>
        s.label.toLowerCase().includes('delivery') ||
        s.label.toLowerCase().includes('picked'),
    )?.value ?? 0

  const attentionItems = [
    {
      id: 'pending_orders',
      title: 'Awaiting confirmation',
      count: pendingOrders,
      tone: pendingOrders > 0 ? 'warning' : 'neutral',
      href: '/admin/orders',
      icon: Clock,
      description: 'Customer COD & online orders needing operator approval',
    },
    {
      id: 'unassigned_orders',
      title: 'Awaiting dispatch',
      count: confirmedOrders,
      tone: confirmedOrders > 0 ? 'info' : 'neutral',
      href: '/admin/orders',
      icon: PackageCheck,
      description: 'Confirmed orders ready to source from nearest dealer',
    },
    {
      id: 'in_transit',
      title: 'Out for delivery',
      count: outForDelivery,
      tone: outForDelivery > 0 ? 'info' : 'neutral',
      href: '/admin/orders',
      icon: Bike,
      description: 'Active riders en route to customers across Butwal',
    },
    {
      id: 'rider_cash',
      title: 'Riders & fleet',
      count: data.ridersOnline,
      tone: 'neutral',
      href: '/admin/riders',
      icon: Banknote,
      description: `${data.ridersOnline} active couriers currently on duty`,
    },
  ]

  const shortcuts = [
    { label: 'New Order', href: '/admin/orders/new', icon: PlusCircle },
    { label: 'New Dealer', href: '/admin/dealers/new', icon: Store },
    { label: 'Riders & Fleet', href: '/admin/riders', icon: Bike },
    { label: 'Accounts & Ledger', href: '/admin/accounts', icon: Wallet },
    { label: 'Catalog Directory', href: '/admin/liquor', icon: Sparkles },
    { label: 'Settings', href: '/admin/settings', icon: ShieldCheck },
  ]

  return (
    <PageShell>
      <PageHeader
        kicker="Mezmani Operations Desk"
        title="Workspace"
        description="Action-first hub for order desk dispatch, dealer sourcing, rider handovers, and cash reconciliation in Butwal."
        actions={
          <div className="flex items-center gap-2.5">
            <DataRefreshButton
              queryKeys={[
                adminQueries.dashboard({
                  range: range as any,
                  from: search.from,
                  to: search.to,
                }).queryKey,
              ]}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              variant="button"
            />

            <Select
              value={range}
              onValueChange={(val) =>
                navigate({
                  search: { range: val as typeof range },
                })
              }
            >
              <SelectTrigger className="h-9 w-[160px] text-xs sm:text-sm font-medium bg-card">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today (Daily)</SelectItem>
                <SelectItem value="7d">Last 7 days (Weekly)</SelectItem>
                <SelectItem value="30d">Last 30 days (Monthly)</SelectItem>
                <SelectItem value="90d">Last 90 days (Quarterly)</SelectItem>
                <SelectItem value="ytd">Year to date (Yearly)</SelectItem>
              </SelectContent>
            </Select>

            <Button asChild size="sm" className="h-9 px-4 gap-2 text-xs sm:text-sm font-semibold shadow-xs">
              <Link to="/admin/orders">
                <PlusCircle className="size-4" /> New Order
              </Link>
            </Button>
          </div>
        }
      />

      <DataSection isRefreshing={isFetching}>
        {/* 1. Needs Attention Work Queues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-500" />
            <span>Needs Attention</span>
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            Actionable work queues
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {attentionItems.map((item) => {
            const Icon = item.icon
            const isUrgent = item.count > 0 && item.tone !== 'neutral'

            return (
              <Link
                key={item.id}
                to={item.href}
                className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-border bg-card hover:bg-muted/30 hover:border-primary/50 transition-all shadow-xs hover:shadow-sm"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-lg bg-secondary text-foreground group-hover:text-primary transition-colors">
                      <Icon className="size-5" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs font-bold px-2.5 py-0.5 ${
                        isUrgent
                          ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          : 'text-muted-foreground border-border bg-muted/40'
                      }`}
                    >
                      {item.count}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center text-xs font-semibold text-primary pt-3 border-t border-border/50 mt-4">
                  <span>Open queue</span>
                  <ArrowRight className="size-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 2. Quick Shortcuts */}
      <div className="space-y-3">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Quick Shortcuts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {shortcuts.map((sc) => {
            const Icon = sc.icon
            return (
              <Link
                key={sc.label}
                to={sc.href}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-border/80 transition-all text-xs sm:text-sm font-semibold text-foreground group shadow-xs"
              >
                <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="truncate">{sc.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 3. Primary Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-5 border-border bg-card rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Delivered Revenue</span>
            <Wallet className="size-4 text-primary" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-2">
            <MoneyText paisa={data.kpis.revenue} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            In selected range
          </p>
        </Card>

        <Card className="p-5 border-border bg-card rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Total Orders</span>
            <ShoppingCart className="size-4 text-primary" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-2">
            {data.kpis.orders}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {data.kpis.sales} delivered
          </p>
        </Card>

        <Card className="p-5 border-border bg-card rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Realized Profit</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            <MoneyText paisa={data.kpis.profit} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            After dealer payouts & COGS
          </p>
        </Card>

        <Card className="p-5 border-border bg-card rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Active Sourcing Hubs</span>
            <Store className="size-4 text-primary" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-2">
            {data.kpis.dealers}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {data.kpis.activeDealers} online in Butwal
          </p>
        </Card>
      </div>

      {/* 4. Sales Trend & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border bg-card p-5 rounded-xl shadow-xs">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Sales & Revenue Trend
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Revenue progression in NPR over {range}
              </CardDescription>
            </div>
            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">NPR</span>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <LineChart data={data.salesTrend} money />
          </CardContent>
        </Card>

        <Card className="border-border bg-card overflow-hidden flex flex-col rounded-xl shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-5 py-4 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Orders
            </CardTitle>
            <Link
              to="/admin/orders"
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <div className="flex-1 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border">
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-3 px-4">Order</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-3 px-4">Status</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider py-3 px-4">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {data.recentOrders.slice(0, 5).map((o) => (
                  <TableRow key={o.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="py-3 px-4">
                      <Link
                        to="/admin/orders"
                        className="font-mono text-sm font-bold text-foreground hover:text-primary transition-colors"
                      >
                        {o.number}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate max-w-[140px] mt-0.5">
                        {o.customerName}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <StatusIndicator status={o.status} />
                    </TableCell>
                    <TableCell className="text-right py-3 px-4">
                      <MoneyText paisa={o.total} className="text-sm font-bold" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* 5. Recent Activity Feed */}
      <Card className="border-border bg-card p-5 rounded-xl shadow-xs">
        <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-3">
          <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Recent Audit & Operations Activity
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono font-medium">
            Live events
          </span>
        </CardHeader>
        <CardContent className="p-0 pt-3">
          <ul className="divide-y divide-border/50">
            {data.activities.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-3 text-xs sm:text-sm"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <span className="size-2 rounded-full bg-primary shrink-0" />
                  <span className="font-semibold text-foreground truncate">
                    {a.detail}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    · <strong className="font-medium text-foreground/70">{a.actor}</strong> ({a.module})
                  </span>
                </div>
                <DateText
                  date={a.at}
                  showRelative
                  className="text-xs text-muted-foreground font-medium shrink-0"
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      </DataSection>
    </PageShell>
  )
}
