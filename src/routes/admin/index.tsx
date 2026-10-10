import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { getDashboardFn } from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import { StatusBadge } from '#/components/admin/status-badge'
import { LineChart, BarChart, DoughnutChart } from '#/components/admin/charts'
import {
  Wallet,
  ShoppingCart,
  TrendingUp,
  Users,
  Bike,
  Boxes,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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

const searchSchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'ytd', 'custom']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const Route = createFileRoute('/admin/')({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return getDashboardFn({
      data: {
        range: deps.range ?? '30d',
        from: deps.from,
        to: deps.to,
      },
    })
  },
  component: AdminDashboard,
})

function AdminDashboard() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const range = search.range ?? '30d'

  const kpis = [
    {
      label: 'Revenue',
      value: formatNPR(data.kpis.revenue),
      note: 'Delivered orders in range',
      icon: Wallet,
    },
    {
      label: 'Orders',
      value: data.kpis.orders,
      note: `${data.kpis.sales} delivered`,
      icon: ShoppingCart,
    },
    {
      label: 'Profit',
      value: formatNPR(data.kpis.profit),
      note: 'After estimated COGS & refunds',
      icon: TrendingUp,
      tone: 'success' as const,
    },
    {
      label: 'Customers',
      value: data.kpis.customers,
      note: 'Registered accounts',
      icon: Users,
    },
    {
      label: 'Riders',
      value: data.kpis.riders,
      note: `${data.ridersOnline} currently active`,
      icon: Bike,
    },
    {
      label: 'Inventory units',
      value: data.kpis.inventory,
      note: formatNPR(data.inventoryValue) + ' on hand',
      icon: Boxes,
    },
    {
      label: 'Low stock',
      value: data.kpis.lowStock,
      note: `≤ 20 units remaining`,
      icon: AlertTriangle,
      tone: data.kpis.lowStock > 0 ? ('danger' as const) : ('default' as const),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Overview"
        title="Operations dashboard"
        description="Live catalog inventory plus order, rider, and ledger activity for the Kathmandu hub."
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
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/admin/orders">
                <Plus className="h-3.5 w-3.5" /> New order
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Sales trend</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">NPR · {range}</span>
          </CardHeader>
          <CardContent className="p-0">
            <LineChart data={data.salesTrend} money />
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-medium">Order status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DoughnutChart data={data.orderStatus} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-medium">Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <BarChart data={data.orderStatus} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-4 py-3 space-y-0">
            <CardTitle className="text-sm font-medium">Top products</CardTitle>
            <Link to="/admin/liquor" className="text-xs text-muted-foreground hover:text-foreground">
              Catalog
            </Link>
          </CardHeader>
          <ul className="m-0 divide-y divide-border/40 p-0">
            {data.topProducts.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <div>
                  <div className="font-medium text-foreground">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.qty} sold</div>
                </div>
                <div className="font-mono font-medium tabular-nums text-foreground">
                  {formatNPR(p.revenue)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-4 py-3 space-y-0">
            <CardTitle className="text-sm font-medium">Recent orders</CardTitle>
            <Link to="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Order</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <a
                      href={`/admin/orders/${o.id}`}
                      className="font-mono font-medium text-foreground hover:underline"
                    >
                      {o.number}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.customerName}</TableCell>
                  <TableCell>
                    <StatusBadge value={o.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums">
                    {formatNPR(o.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="m-0 space-y-3 p-0">
              {data.activities.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <div>
                    <div className="font-medium text-foreground">{a.detail}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.actor} · {a.module} · {new Date(a.at).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
