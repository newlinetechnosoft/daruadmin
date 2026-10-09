import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { getDashboardFn } from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import { StatusBadge } from '#/components/admin/status-badge'
import { LineChart, BarChart, DoughnutChart } from '#/components/admin/charts'
import { pageClass, cardClass, selectClass } from '#/components/admin/styles'
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
      note: `≤ ${data.catalog.lowStockCount >= 0 ? 20 : 20} units remaining`,
      icon: AlertTriangle,
      tone: data.kpis.lowStock > 0 ? ('danger' as const) : ('default' as const),
    },
  ]

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="Overview"
        title="Operations dashboard"
        description="Live catalog inventory plus order, rider, and ledger activity for the Kathmandu hub."
        actions={
          <>
            <select
              aria-label="Date range"
              className={`${selectClass} w-auto`}
              value={range}
              onChange={(e) =>
                navigate({
                  search: { range: e.target.value as typeof range },
                })
              }
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
            </select>
            <Link
              to="/admin/orders"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> New order
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className={`${cardClass} p-5 xl:col-span-2`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Sales trend</h2>
            <span className="text-xs text-slate-500">NPR · {range}</span>
          </div>
          <LineChart data={data.salesTrend} money />
        </section>
        <section className={`${cardClass} p-5`}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Order status
          </h2>
          <DoughnutChart data={data.orderStatus} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-5`}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Orders by status
          </h2>
          <BarChart data={data.orderStatus} />
        </section>
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Top products</h2>
            <Link to="/admin/liquor" className="text-xs font-medium text-blue-600">
              Catalog
            </Link>
          </div>
          <ul className="m-0 divide-y divide-slate-100 p-0">
            {data.topProducts.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.qty} sold</div>
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatNPR(p.revenue)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-blue-600">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider text-slate-400 uppercase">
                  <th className="px-5 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <a
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {o.number}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{o.customerName}</td>
                    <td className="px-3 py-3">
                      <StatusBadge value={o.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatNPR(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className={`${cardClass} p-5`}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Recent activity
          </h2>
          <ul className="m-0 space-y-3 p-0">
            {data.activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <div className="font-medium text-slate-800">{a.detail}</div>
                  <div className="text-xs text-slate-500">
                    {a.actor} · {a.module} · {new Date(a.at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
