import type { ReactNode } from 'react'
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
import { cn } from '#/lib/utils'
import {
  AlertCircle,
  ArrowRight,
  Bike,
  ChevronRight,
  Clock,
  PackageCheck,
  PlusCircle,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

const routeApi = getRouteApi('/admin/')

const RANGE_LABELS: Record<string, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  ytd: 'Year to date',
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE_STYLES: Record<
  Tone,
  { card: string; icon: string; value: string; chip: string; dot: string }
> = {
  neutral: {
    card: 'border-t-border',
    icon: 'text-muted-foreground/70',
    value: 'text-foreground',
    chip: 'border-transparent text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  info: {
    card: 'border-t-info',
    icon: 'text-info',
    value: 'text-foreground',
    chip: 'border-info/25 bg-info/10 text-info',
    dot: 'bg-info',
  },
  success: {
    card: 'border-t-success',
    icon: 'text-success',
    value: 'text-success',
    chip: 'border-success/25 bg-success/10 text-success',
    dot: 'bg-success',
  },
  warning: {
    card: 'border-t-warning',
    icon: 'text-warning',
    value: 'text-foreground',
    chip: 'border-warning/25 bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  danger: {
    card: 'border-t-destructive',
    icon: 'text-destructive',
    value: 'text-destructive',
    chip: 'border-destructive/25 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
}

export function DashboardPanel() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const range = search.range ?? '30d'

  const dashboardQuery = adminQueries.dashboard({
    range,
    from: search.from,
    to: search.to,
  })
  const { data, isFetching, refetch } = useSuspenseQuery(dashboardQuery)

  const statusCounts = new Map(
    data.orderStatus.map((status) => [status.label, status.value]),
  )
  const countStatuses = (...statuses: string[]) =>
    statuses.reduce(
      (total, status) => total + (statusCounts.get(status) ?? 0),
      0,
    )

  const actionQueues: Array<{
    label: string
    count: number
    href: string
    icon: LucideIcon
    tone: Tone
  }> = [
    {
      label: 'Pending confirmation',
      count: countStatuses('pending'),
      href: '/admin/orders',
      icon: Clock,
      tone: 'warning',
    },
    {
      label: 'Ready for sourcing',
      count: countStatuses('confirmed'),
      href: '/admin/orders',
      icon: PackageCheck,
      tone: 'info',
    },
    {
      label: 'Awaiting rider',
      count: countStatuses('dealer_assigned'),
      href: '/admin/orders',
      icon: Bike,
      tone: 'warning',
    },
    {
      label: 'In transit',
      count: countStatuses('rider_assigned', 'picked_up', 'out_for_delivery'),
      href: '/admin/orders',
      icon: Truck,
      tone: 'info',
    },
    {
      label: 'Delivery failed',
      count: countStatuses('delivery_failed'),
      href: '/admin/orders',
      icon: AlertCircle,
      tone: 'danger',
    },
  ]

  const openActions = [
    'pending',
    'confirmed',
    'dealer_assigned',
    'delivery_failed',
  ].reduce((total, status) => total + (statusCounts.get(status) ?? 0), 0)

  const profitTone: Tone =
    data.kpis.profit > 0
      ? 'success'
      : data.kpis.profit < 0
        ? 'danger'
        : 'neutral'
  const profitMargin =
    data.kpis.revenue > 0
      ? ((data.kpis.profit / data.kpis.revenue) * 100).toFixed(1)
      : '0.0'

  const metrics: Array<{
    label: string
    value: ReactNode
    note: string
    icon: LucideIcon
    tone: Tone
  }> = [
    {
      label: 'Delivered revenue',
      value: <MoneyText paisa={data.kpis.revenue} />,
      note: `${data.kpis.sales} delivered orders`,
      icon: Wallet,
      tone: 'info',
    },
    {
      label: 'Orders',
      value: data.kpis.orders.toLocaleString('en-IN'),
      note: 'In selected period',
      icon: ShoppingCart,
      tone: 'neutral',
    },
    {
      label: 'Realized profit',
      value: <MoneyText paisa={data.kpis.profit} />,
      note: `${profitMargin}% margin · after COGS`,
      icon: TrendingUp,
      tone: profitTone,
    },
    {
      label: 'Active dealers',
      value: data.kpis.activeDealers.toLocaleString('en-IN'),
      note: `${data.kpis.dealers} registered dealers`,
      icon: Store,
      tone: 'neutral',
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Orders, payables, and daily operations at a glance."
        actions={
          <>
            <DataRefreshButton
              queryKeys={[dashboardQuery.queryKey]}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              variant="icon"
            />

            <Select
              value={range}
              onValueChange={(value) =>
                navigate({
                  search: { range: value as typeof range },
                })
              }
            >
              <SelectTrigger
                aria-label="Date range"
                className="h-9 w-[140px] bg-card text-xs font-medium"
              >
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>

            <Button asChild size="sm" className="h-9 gap-2 px-3 text-xs">
              <Link to="/admin/orders">
                <PlusCircle className="size-4" />
                New Order
              </Link>
            </Button>
          </>
        }
      />

      <DataSection isRefreshing={isFetching}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon
              const tone = TONE_STYLES[metric.tone]
              return (
                <Card
                  key={metric.label}
                  className={cn(
                    'gap-0 rounded-lg border-border border-t-[3px] py-0 shadow-none',
                    tone.card,
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {metric.label}
                      </p>
                      <Icon className={cn('size-4 shrink-0', tone.icon)} />
                    </div>
                    <div
                      className={cn(
                        'mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl',
                        tone.value,
                      )}
                    >
                      {metric.value}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {metric.note}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="gap-0 rounded-lg border-border py-0 shadow-none lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 px-4 py-3">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Sales trend
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Revenue in NPR · {RANGE_LABELS[range] ?? 'Selected range'}
                  </CardDescription>
                </div>
                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                  NPR
                </span>
              </CardHeader>
              <CardContent className="px-2 pt-3 pb-2 sm:px-4">
                <LineChart data={data.salesTrend} money />
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-lg border-border py-0 shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/70 px-4 py-3">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Action queues
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Orders needing attention
                  </CardDescription>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] font-medium',
                    openActions > 0 ? 'text-warning' : 'text-success',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      openActions > 0 ? 'bg-warning' : 'bg-success',
                    )}
                  />
                  {openActions > 0 ? `${openActions} open` : 'All clear'}
                </span>
              </CardHeader>
              <div>
                {actionQueues.map((item) => {
                  const Icon = item.icon
                  const tone =
                    TONE_STYLES[item.count > 0 ? item.tone : 'neutral']
                  return (
                    <Link
                      key={item.label}
                      to={item.href}
                      className="group flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className={cn('size-4 shrink-0', tone.icon)} />
                        <span className="truncate text-xs font-medium text-foreground">
                          {item.label}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn(
                            'min-w-6 rounded border px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums',
                            tone.chip,
                          )}
                        >
                          {item.count}
                        </span>
                        <ChevronRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border/70 px-4 py-2.5">
                <span className="text-[11px] text-muted-foreground">
                  {data.ridersOnline} riders online
                </span>
                <Link
                  to="/admin/riders"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Manage fleet
                </Link>
              </div>
            </Card>
          </div>

          <Card className="gap-0 rounded-lg border-border py-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 px-4 py-3">
              <div>
                <CardTitle className="text-sm font-medium">
                  Recent orders
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Latest activity across all channels
                </CardDescription>
              </div>
              <Link
                to="/admin/orders"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/70 hover:bg-transparent">
                    <TableHead className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                      Order
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                      Customer
                    </TableHead>
                    <TableHead className="hidden px-4 py-2.5 text-[11px] font-medium text-muted-foreground sm:table-cell">
                      Placed
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="px-4 py-8 text-center text-xs text-muted-foreground"
                      >
                        No orders yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.recentOrders.slice(0, 6).map((order) => (
                    <TableRow
                      key={order.id}
                      className="border-b border-border/50 last:border-b-0 hover:bg-muted/30"
                    >
                      <TableCell className="px-4 py-2.5">
                        <Link
                          to="/admin/orders"
                          className="font-mono text-xs font-medium text-foreground hover:text-primary"
                        >
                          {order.number}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-foreground">
                        {order.customerName}
                      </TableCell>
                      <TableCell className="hidden px-4 py-2.5 sm:table-cell">
                        <DateText
                          date={order.createdAt}
                          showTime={false}
                          className="text-xs text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <StatusIndicator status={order.status} />
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-xs font-medium">
                        <MoneyText paisa={order.total} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </DataSection>
    </PageShell>
  )
}
