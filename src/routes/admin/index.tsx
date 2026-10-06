import { createFileRoute, Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  getAdminStatsFn,
  getAdminLiquorProductsFn,
  getAdminGroceryProductsFn,
} from '#/server/catalog/catalog.functions'
import { formatNPR } from '#/lib/money'
import {
  Wine,
  ShoppingBag,
  Tags,
  Users,
  AlertTriangle,
  Boxes,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const [stats, liquorProducts, groceryProducts] = await Promise.all([
      getAdminStatsFn(),
      getAdminLiquorProductsFn(),
      getAdminGroceryProductsFn(),
    ])
    return { stats, liquorProducts, groceryProducts }
  },
  component: AdminDashboard,
})

interface RecentItem {
  id: string
  name: string
  primaryImage?: string | null
  isFeatured: boolean
  isActive: boolean
  categoryName: string
  variants: { price: number }[]
}

function RecentList({
  title,
  icon: Icon,
  to,
  items,
  fallbackImage,
}: {
  title: string
  icon: LucideIcon
  to: '/admin/liquor' | '/admin/grocery'
  items: RecentItem[]
  fallbackImage: string
}) {
  return (
    <section className="border border-black">
      <div className="flex items-center justify-between border-b border-black px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4" />
          <h2 className="text-sm font-black uppercase tracking-tight">
            {title}
          </h2>
        </div>
        <Link
          to={to}
          className="inline-flex items-center gap-1 border-b border-black pb-0.5 text-xs font-semibold transition-opacity hover:opacity-60"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-500">
          Nothing here yet.
        </p>
      ) : (
        <ul className="m-0 list-none divide-y divide-black/10 p-0">
          {items.map((item) => {
            const primaryVariant = item.variants[0]
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <img
                    src={item.primaryImage || fallbackImage}
                    alt={item.name}
                    className="h-11 w-11 shrink-0 bg-[#f3f2ee] object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{item.name}</span>
                      {item.isFeatured && (
                        <Sparkles
                          className="h-3 w-3 shrink-0"
                          aria-label="Featured"
                        />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {item.categoryName} · {item.variants.length} variant
                      {item.variants.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold tabular-nums">
                    {formatNPR(primaryVariant.price)}
                  </div>
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium">
                    {item.isActive ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-neutral-400">
                        <XCircle className="h-3 w-3" /> Draft
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function AdminDashboard() {
  const { stats, liquorProducts, groceryProducts } = Route.useLoaderData()

  const recentLiquor = liquorProducts.slice(0, 5)
  const recentGrocery = groceryProducts.slice(0, 5)

  const metrics: {
    label: string
    value: number
    note: string
    icon: LucideIcon
    alert?: boolean
  }[] = [
    {
      label: 'Liquor SKUs',
      value: stats.totalLiquorProducts,
      note: 'Active in catalog',
      icon: Wine,
    },
    {
      label: 'Grocery SKUs',
      value: stats.totalGroceryProducts,
      note: 'Mixers & snacks',
      icon: ShoppingBag,
    },
    {
      label: 'Brands',
      value: stats.totalBrands,
      note: 'Nepal & imported',
      icon: Tags,
    },
    {
      label: 'Stock units',
      value: stats.totalStockUnits,
      note: 'Physical bottles/cans',
      icon: Boxes,
    },
    {
      label: 'Low stock',
      value: stats.lowStockCount,
      note: '≤ 20 units remaining',
      icon: AlertTriangle,
      alert: true,
    },
    {
      label: 'Users',
      value: stats.totalUsers,
      note: 'Registered accounts',
      icon: Users,
    },
  ]

  return (
    <div className="space-y-10 bg-white p-5 text-[#101010] sm:p-8">
      {/* Heading */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl">
            Operations
            <br />
            dashboard
          </h1>
          <p className="mt-4 max-w-md text-sm text-neutral-600">
            Real-time catalog inventory, stock alerts, and Kathmandu hub
            metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/liquor"
            className="inline-flex h-11 items-center gap-2 bg-black px-5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Add liquor SKU
          </Link>
          <Link
            to="/admin/grocery"
            className="inline-flex h-11 items-center gap-2 border border-black px-5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-black hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Add grocery SKU
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-px border border-black bg-black md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-[#f3f2ee] p-5">
              <div className="mb-6 flex items-center justify-between text-neutral-500">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  {m.label}
                </span>
                <Icon className="h-4 w-4" />
              </div>
              <div
                className={`text-4xl font-black tabular-nums tracking-tighter sm:text-5xl ${
                  m.alert && m.value > 0 ? 'text-red-700' : ''
                }`}
              >
                {m.value}
              </div>
              <div className="mt-2 text-[11px] text-neutral-500">{m.note}</div>
            </div>
          )
        })}
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentList
          title="Recent liquor inventory"
          icon={Wine}
          to="/admin/liquor"
          items={recentLiquor}
          fallbackImage="https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=100&q=80"
        />
        <RecentList
          title="Recent grocery & munchies"
          icon={ShoppingBag}
          to="/admin/grocery"
          items={recentGrocery}
          fallbackImage="https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=100&q=80"
        />
      </div>
    </div>
  )
}
