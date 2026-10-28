import { Link, getRouteApi } from '@tanstack/react-router'
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
  const data = routeApi.useLoaderData()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const range = search.range ?? '30d'

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
      title: 'Orders awaiting confirmation',
      count: pendingOrders,
      tone: pendingOrders > 0 ? 'warning' : 'neutral',
      href: '/admin/orders',
      icon: Clock,
      description: 'Customer COD & online orders needing operator approval',
    },
    {
      id: 'unassigned_orders',
      title: 'Orders awaiting dealer & rider dispatch',
      count: confirmedOrders,
      tone: confirmedOrders > 0 ? 'info' : 'neutral',
      href: '/admin/orders',
      icon: PackageCheck,
      description: 'Confirmed orders ready to source from nearest dealer',
    },
    {
      id: 'in_transit',
      title: 'Orders out for delivery',
      count: outForDelivery,
      tone: outForDelivery > 0 ? 'info' : 'neutral',
      href: '/admin/orders',
      icon: Bike,
      description: 'Active riders en route to customers across Butwal',
    },
    {
      id: 'rider_cash',
      title: 'Rider cash handovers & settlements',
      count: data.ridersOnline,
      tone: 'neutral',
      href: '/admin/riders',
      icon: Banknote,
      description: `${data.ridersOnline} active couriers currently on duty`,
    },
  ]

  const shortcuts = [
    { label: 'New order', href: '/admin/orders/new', icon: PlusCircle },
    { label: 'New dealer', href: '/admin/dealers/new', icon: Store },
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
          <div className="flex items-center gap-2">
            <Select
              value={range}
              onValueChange={(val) =>
                navigate({
                  search: { range: val as typeof range },
                })
              }
            >
              <SelectTrigger className="h-8 w-[145px] text-xs">
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

            <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/admin/orders">
                <PlusCircle className="size-3.5" /> New order
              </Link>
            </Button>
          </div>
        }
      />

      {/* 1. Needs Attention Work Queues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="size-3.5 text-amber-500" />
            <span>Needs Attention</span>
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Actionable work queues
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {attentionItems.map((item) => {
            const Icon = item.icon
            const isUrgent = item.count > 0 && item.tone !== 'neutral'

            return (
              <Link
                key={item.id}
                to={item.href}
                className="group relative flex flex-col justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 hover:border-primary/40 transition-all shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-md bg-muted/60 text-foreground group-hover:text-primary transition-colors">
                      <Icon className="size-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs px-2 py-0.5 ${
                        isUrgent
                          ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {item.count}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center text-[11px] font-medium text-muted-foreground group-hover:text-foreground pt-3 border-t border-border/40 mt-3">
                  <span>Open queue</span>
                  <ArrowRight className="size-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 2. Quick Shortcuts */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Shortcuts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {shortcuts.map((sc) => {
            const Icon = sc.icon
            return (
              <Link
                key={sc.label}
                to={sc.href}
                className="flex items-center gap-2 p-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/40 transition-colors text-xs font-medium text-foreground group"
              >
                <Icon className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                <span className="truncate">{sc.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 3. Primary Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Delivered Revenue</span>
            <Wallet className="size-4" />
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            <MoneyText paisa={data.kpis.revenue} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            In selected range
          </p>
        </Card>

        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Orders</span>
            <ShoppingCart className="size-4" />
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {data.kpis.orders}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {data.kpis.sales} delivered
          </p>
        </Card>

        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Realized Profit</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
            <MoneyText paisa={data.kpis.profit} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            After dealer payouts & COGS
          </p>
        </Card>

        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Active Sourcing Hubs</span>
            <Store className="size-4" />
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {data.kpis.dealers}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {data.kpis.activeDealers} online in Butwal
          </p>
        </Card>
      </div>

      {/* 4. Sales Trend & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/80 p-4">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold">
                Sales & Revenue Trend
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Revenue progression in NPR over {range}
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">NPR</span>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <LineChart data={data.salesTrend} money />
          </CardContent>
        </Card>

        <Card className="border-border/80 overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-4 py-3 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Orders
            </CardTitle>
            <Link
              to="/admin/orders"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <div className="flex-1 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[11px]">Order</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-right text-[11px]">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.slice(0, 5).map((o) => (
                  <TableRow key={o.id} className="hover:bg-muted/20">
                    <TableCell className="py-2">
                      <Link
                        to="/admin/orders"
                        className="font-mono text-xs font-medium text-foreground hover:underline"
                      >
                        {o.number}
                      </Link>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {o.customerName}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <StatusIndicator status={o.status} />
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <MoneyText paisa={o.total} className="text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* 5. Recent Activity Feed */}
      <Card className="border-border/80 p-4">
        <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Audit & Operations Activity
          </CardTitle>
          <span className="text-[11px] text-muted-foreground font-mono">
            Live events
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/40">
            {data.activities.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <span className="size-1.5 rounded-full bg-primary/70 shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {a.detail}
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    · {a.actor} ({a.module})
                  </span>
                </div>
                <DateText
                  date={a.at}
                  showRelative
                  className="text-[11px] text-muted-foreground shrink-0"
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  )
}
