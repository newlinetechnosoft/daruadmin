import { useState } from 'react'
import { formatNPR } from '#/lib/money'
import {
  Flame,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Download,
  Store,
  Clock,
  Search,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { ProductSourcingIntelligenceReport } from '#/server/operations/types'
import { useQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'

interface ProductVelocityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: ProductSourcingIntelligenceReport
}

export function exportProductVelocityCSV(
  report: ProductSourcingIntelligenceReport,
  daysFilter: number | null = null,
) {
  const timestamp = new Date().toISOString().slice(0, 10)
  const periodLabel = daysFilter ? `last-${daysFilter}-days` : 'all-time'

  // Multi-section CSV
  let csv = `DARU GANG - PRODUCT VELOCITY & SOURCING INTELLIGENCE AUDIT (${periodLabel.toUpperCase()})\n`
  csv += `Generated At: ${new Date().toISOString()}\n\n`

  // Section 1: Summary
  csv += `--- EXECUTIVE SOURCING SUMMARY ---\n`
  csv += `Total Net Merchandise Revenue (NPR),${report.summary.totalRevenue}\n`
  csv += `Total Units Sold,${report.summary.totalUnitsSold}\n`
  csv += `Top Selling Product,"${report.summary.topProductByRevenue ?? 'N/A'}"\n`
  csv += `Slow Moving Items Count,${report.summary.slowMoversCount}\n`
  csv += `Zero Sales / Dead Stock Items Count,${report.summary.zeroSalesCount}\n`
  csv += `Most-Unavailable Item Bottleneck,"${report.summary.mostUnavailableProduct ?? 'None'}"\n`
  csv += `Network Dealer Substitution Rate,"${report.summary.networkSubstitutionRatePercent}%"\n`
  csv += `Total Assigned Dealer Lines,${report.summary.totalAssignedDealerItems}\n`
  csv += `Total Substituted Dealer Lines,${report.summary.totalSubstitutedDealerItems}\n\n`

  // Section 2: Top Products
  csv += `--- 1. TOP PRODUCTS BY GROSS REVENUE ---\n`
  csv += `Rank,ProductName,CatalogType,UnitsSold,OrdersCount,GrossRevenueNPR,DealerCostNPR,GrossProfitNPR,GrossMarginPercent,AvgSellingPriceNPR\n`
  report.topProducts.forEach((p, idx) => {
    csv += `${idx + 1},"${p.name}","${p.catalogType}",${p.unitsSold},${p.ordersCount},${p.grossRevenue},${p.totalDealerCost},${p.grossProfit},"${p.marginPercent}%",${p.avgSellingPrice}\n`
  })
  csv += `\n`

  // Section 3: Slow Movers
  csv += `--- 2. SLOW MOVERS & DEAD STOCK RISK ---\n`
  csv += `ProductName,CatalogType,Category,Status,UnitsSold,GrossRevenueNPR,DaysSinceLastOrder,ActiveDealersCarrying,BasePriceNPR\n`
  report.slowMovers.forEach((s) => {
    csv += `"${s.name}","${s.catalogType}","${s.categoryName}","${s.status === 'zero_sales' ? 'Dead Stock Risk (0 Sales)' : 'Slow Mover (<=2 Units)'}",${s.unitsSold},${s.grossRevenue},"${s.daysSinceLastOrder != null ? s.daysSinceLastOrder : 'Never sold'}",${s.dealerCarryingCount},${s.basePrice}\n`
  })
  csv += `\n`

  // Section 4: Most Unavailable Items
  csv += `--- 3. MOST-UNAVAILABLE ITEMS (SOURCING BOTTLENECKS) ---\n`
  csv += `ProductName,CatalogType,TotalTimesRequested,UnavailableCount,FulfilledCount,UnavailabilityRatePercent,AffectedDealers\n`
  report.mostUnavailable.forEach((u) => {
    csv += `"${u.name}","${u.catalogType}",${u.totalRequested},${u.unavailableCount},${u.fulfilledCount},"${u.unavailabilityRatePercent}%","${u.affectedDealerNames.join('; ')}"\n`
  })
  csv += `\n`

  // Section 5: Dealer Substitution Rates
  csv += `--- 4. DEALER SUBSTITUTION & FULFILMENT SLA ---\n`
  csv += `DealerName,Contact,City,TotalAssignedLines,FulfilledLines,SubstitutedLines,SubstitutionRatePercent,FulfilmentSLAPercent,SeverityAlert\n`
  report.dealerSubstitutionRates.forEach((d) => {
    csv += `"${d.dealerName}","${d.contact}","${d.city}",${d.totalAssigned},${d.fulfilled},${d.substituted},"${d.substitutionRatePercent}%","${d.fulfilmentRatePercent}%","${d.severity.toUpperCase()}"\n`
  })

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sourcing-velocity-intelligence-${periodLabel}-${timestamp}.csv`
  a.click()
  toast.success('Product velocity & sourcing audit CSV downloaded')
}

export function ProductVelocityDialog({
  open,
  onOpenChange,
  initialData,
}: ProductVelocityDialogProps) {
  const [activeTab, setActiveTab] = useState<
    'top' | 'slow' | 'unavailable' | 'substitution'
  >('top')
  const [daysFilter, setDaysFilter] = useState<number | null>(null) // null = all time
  const [searchTerm, setSearchTerm] = useState('')
  const [slowMoverSubFilter, setSlowMoverSubFilter] = useState<
    'all' | 'zero' | 'slow'
  >('all')

  // Query fresh data when date filter changes
  const { data: queriedData, isFetching } = useQuery({
    ...adminQueries.sourcingIntelligence(daysFilter),
    enabled: open,
    initialData: daysFilter === null ? initialData : undefined,
  })

  const report = queriedData ?? initialData

  const handleExportCSV = () => {
    if (!report) {
      toast.error('No report data available to export')
      return
    }
    exportProductVelocityCSV(report, daysFilter)
  }

  // Filtered lists by search
  const filteredTopProducts = (report?.topProducts ?? []).filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredSlowMovers = (report?.slowMovers ?? []).filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (slowMoverSubFilter === 'zero') return s.status === 'zero_sales'
    if (slowMoverSubFilter === 'slow') return s.status === 'slow_mover'
    return true
  })

  const filteredMostUnavailable = (report?.mostUnavailable ?? []).filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredDealerRates = (report?.dealerSubstitutionRates ?? []).filter(
    (d) =>
      d.dealerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.city.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              Product Velocity &amp; Sourcing Intelligence
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top revenue drivers, dead-stock risks, dealer unavailabilities,
              and re-sourcing substitution rates across Butwal network.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Period Selector */}
            <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDaysFilter(null)}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  daysFilter === null
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDaysFilter(30)}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  daysFilter === 30
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysFilter(60)}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  daysFilter === 60
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                60 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysFilter(90)}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  daysFilter === 90
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                90 Days
              </button>
            </div>

            <Button
              size="sm"
              onClick={handleExportCSV}
              className="h-7 gap-1 text-xs cursor-pointer"
            >
              <Download className="h-3 w-3" />
              Download Audit CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Executive Sourcing Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Top Revenue Item</span>
                <Flame className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="font-semibold text-xs text-foreground truncate">
                {report?.summary.topProductByRevenue || 'None recorded'}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {formatNPR(report?.summary.totalRevenue ?? 0)} total turn
              </p>
            </div>

            <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Dead Stock Risk</span>
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              </div>
              <p className="font-semibold text-xs text-destructive">
                {report?.summary.zeroSalesCount ?? 0} zero-sale products
              </p>
              <p className="text-[11px] text-muted-foreground">
                +{report?.summary.slowMoversCount ?? 0} slow movers
              </p>
            </div>

            <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Most-Unavailable</span>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="font-semibold text-xs text-foreground truncate">
                {report?.summary.mostUnavailableProduct || 'Zero stockouts'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {report?.mostUnavailable.length ?? 0} items experienced
                stockouts
              </p>
            </div>

            <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Substitution Rate</span>
                <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="font-semibold text-xs text-foreground font-mono">
                {report?.summary.networkSubstitutionRatePercent ?? 0}% network
              </p>
              <p className="text-[11px] text-muted-foreground">
                {report?.summary.totalSubstitutedDealerItems ?? 0} of{' '}
                {report?.summary.totalAssignedDealerItems ?? 0} re-routed
              </p>
            </div>
          </div>

          {/* Search bar & Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="h-8">
                <TabsTrigger
                  value="top"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <Flame className="h-3 w-3 text-amber-500" />
                  <span>Top Products ({report?.topProducts.length ?? 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="slow"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <TrendingDown className="h-3 w-3 text-muted-foreground" />
                  <span>Slow Movers ({report?.slowMovers.length ?? 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="unavailable"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span>
                    Stockout Bottlenecks ({report?.mostUnavailable.length ?? 0})
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="substitution"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3 text-blue-500" />
                  <span>
                    Dealer Substitution (
                    {report?.dealerSubstitutionRates.length ?? 0})
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by product or merchant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* TAB 1: TOP PRODUCTS */}
          {activeTab === 'top' && (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Catalog</TableHead>
                    <TableHead className="text-right text-xs">Units</TableHead>
                    <TableHead className="text-right text-xs">Orders</TableHead>
                    <TableHead className="text-right text-xs">
                      Gross Revenue
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Dealer Cost
                    </TableHead>
                    <TableHead className="text-right text-xs">Profit</TableHead>
                    <TableHead className="text-right text-xs">Margin</TableHead>
                    <TableHead className="text-right text-xs">
                      Avg Retail
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {isFetching
                          ? 'Loading intelligence...'
                          : 'No matching products found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTopProducts.map((p, idx) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-foreground">
                          {p.name}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {p.catalogType}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {p.unitsSold}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {p.ordersCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {formatNPR(p.grossRevenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatNPR(p.totalDealerCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600">
                          {formatNPR(p.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              p.marginPercent >= 20
                                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10 text-[10px]'
                                : 'border-amber-500 text-amber-500 bg-amber-500/10 text-[10px]'
                            }
                          >
                            {p.marginPercent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatNPR(p.avgSellingPrice)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* TAB 2: SLOW MOVERS */}
          {activeTab === 'slow' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Status Filter:
                </span>
                <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSlowMoverSubFilter('all')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                      slowMoverSubFilter === 'all'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Slow Movers ({report?.slowMovers.length ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlowMoverSubFilter('zero')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                      slowMoverSubFilter === 'zero'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Dead Stock Risk (0 Sales) (
                    {report?.summary.zeroSalesCount ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlowMoverSubFilter('slow')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                      slowMoverSubFilter === 'slow'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Low Movement (&le;2 Units) (
                    {report?.summary.slowMoversCount ?? 0})
                  </button>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">
                        Catalog &amp; Category
                      </TableHead>
                      <TableHead className="text-xs">Velocity Status</TableHead>
                      <TableHead className="text-right text-xs">
                        Units Sold
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Last Sold
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Carrying Dealers
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Base Retail
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSlowMovers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No slow movers found matching criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSlowMovers.map((s) => (
                        <TableRow key={s.productId}>
                          <TableCell className="font-medium text-xs text-foreground">
                            {s.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="capitalize">{s.catalogType}</span>{' '}
                            &middot; {s.categoryName}
                          </TableCell>
                          <TableCell>
                            {s.status === 'zero_sales' ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/40 text-destructive bg-destructive/10 text-[10px]"
                              >
                                Dead Stock Risk
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px]"
                              >
                                Low Movement
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {s.unitsSold}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {s.daysSinceLastOrder != null ? (
                              <span className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {s.daysSinceLastOrder}d ago
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">
                                Never sold
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            <span className="inline-flex items-center gap-1">
                              <Store className="h-3 w-3 text-muted-foreground" />
                              {s.dealerCarryingCount} shops
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {formatNPR(s.basePrice)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 3: MOST-UNAVAILABLE ITEMS */}
          {activeTab === 'unavailable' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Items where assigned merchants failed to supply or marked
                out-of-stock at pickup, requiring dispatch substitution.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product Name</TableHead>
                      <TableHead className="text-xs">Catalog Type</TableHead>
                      <TableHead className="text-right text-xs">
                        Times Requested
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Stockouts (Unavailable)
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Fulfilled
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Unavailability Rate
                      </TableHead>
                      <TableHead className="text-xs">
                        Affected Dealer Merchants
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMostUnavailable.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                          Zero stockout bottlenecks recorded. All assigned items
                          were fulfilled seamlessly!
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMostUnavailable.map((u) => (
                        <TableRow key={u.productId}>
                          <TableCell className="font-medium text-xs text-foreground">
                            {u.name}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {u.catalogType}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {u.totalRequested}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-destructive">
                            {u.unavailableCount}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600">
                            {u.fulfilledCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                u.unavailabilityRatePercent >= 30
                                  ? 'border-destructive text-destructive bg-destructive/10 text-[10px]'
                                  : 'border-amber-500 text-amber-500 bg-amber-500/10 text-[10px]'
                              }
                            >
                              {u.unavailabilityRatePercent}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.affectedDealerNames.length > 0
                              ? u.affectedDealerNames.join(', ')
                              : 'None recorded'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 4: DEALER SUBSTITUTION RATE */}
          {activeTab === 'substitution' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Merchant-level substitution frequency. Higher rates indicate
                frequent stock discrepancies requiring rider re-routing or
                customer cancellation.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Merchant Name</TableHead>
                      <TableHead className="text-xs">Contact</TableHead>
                      <TableHead className="text-xs">Hub / City</TableHead>
                      <TableHead className="text-right text-xs">
                        Lines Assigned
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Fulfilled
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Substituted / Rejected
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Substitution Rate
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Sourcing SLA
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDealerRates.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No dealer records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDealerRates.map((d) => (
                        <TableRow key={d.dealerId}>
                          <TableCell className="font-medium text-xs text-foreground">
                            {d.dealerName}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {d.contact}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.city}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {d.totalAssigned}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600">
                            {d.fulfilled}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-destructive">
                            {d.substituted}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                d.severity === 'high'
                                  ? 'border-destructive text-destructive bg-destructive/10 text-[10px]'
                                  : d.severity === 'moderate'
                                    ? 'border-amber-500 text-amber-500 bg-amber-500/10 text-[10px]'
                                    : 'border-emerald-500 text-emerald-500 bg-emerald-500/10 text-[10px]'
                              }
                            >
                              {d.substitutionRatePercent}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            <span
                              className={
                                d.fulfilmentRatePercent >= 90
                                  ? 'text-emerald-600'
                                  : 'text-amber-500'
                              }
                            >
                              {d.fulfilmentRatePercent}% SLA
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
