import { Users, Store, Bike, Package, Layers } from 'lucide-react'

interface KpiStripProps {
  overview?: {
    totalCustomers: number
    totalDealers: number
    totalRiders: number
    totalProducts: number
    totalVariants: number
  } | null
  isLoading?: boolean
}

export function KpiStrip({ overview, isLoading }: KpiStripProps) {
  const kpis = [
    { label: 'Customers', value: overview?.totalCustomers ?? 0, icon: Users },
    { label: 'Dealers', value: overview?.totalDealers ?? 0, icon: Store },
    { label: 'Delivery Fleet', value: overview?.totalRiders ?? 0, icon: Bike },
    { label: 'Products', value: overview?.totalProducts ?? 0, icon: Package },
    { label: 'Variant SKUs', value: overview?.totalVariants ?? 0, icon: Layers },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="p-3 rounded-lg border border-border/80 bg-card shadow-xs flex items-center justify-between"
          >
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {kpi.label}
              </p>
              <p className="text-lg font-bold text-foreground font-mono tabular-nums">
                {isLoading ? '...' : kpi.value.toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-8 rounded-md bg-muted/40 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
