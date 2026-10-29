import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { calculateOrderMargins } from '#/server/orders/order.queries'
import {
  Download,
  Printer,
  DollarSign,
  Truck,
  Building,
  TrendingUp,
  Store,
  Eye,
  Flame,
} from 'lucide-react'
import {
  ProductVelocityDialog,
  exportProductVelocityCSV,
} from './product-velocity-dialog'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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

const routeApi = getRouteApi('/admin/reports')

export function ReportsPanel() {
  const { ops } = routeApi.useLoaderData()

  const [isIrdModalOpen, setIsIrdModalOpen] = useState(false)
  const [isMarginModalOpen, setIsMarginModalOpen] = useState(false)
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false)
  const [isVelocityModalOpen, setIsVelocityModalOpen] = useState(false)
  const [marginTab, setMarginTab] = useState<'product' | 'dealer'>('product')

  // Aggregate Metrics
  const grossSalesTotal = ops.orders.reduce((sum, o) => sum + o.total, 0)
  const totalDeliveriesCount = ops.riders.reduce(
    (sum, r) => sum + r.deliveries,
    0,
  )
  const estimatedVatCollected = Math.round(
    ops.orders.reduce((sum, o) => sum + o.tax, 0),
  )

  // Order Margin & Profitability Aggregations
  const marginSummaries = ops.orders.map(calculateOrderMargins)
  const totalMerchandiseRevenue = marginSummaries.reduce(
    (sum, m) => sum + m.netMerchandiseRevenue,
    0,
  )
  const totalDealerCost = marginSummaries.reduce(
    (sum, m) => sum + m.totalDealerCost,
    0,
  )
  const totalGrossProfit = totalMerchandiseRevenue - totalDealerCost
  const overallMarginPercent =
    totalMerchandiseRevenue > 0
      ? Number(((totalGrossProfit / totalMerchandiseRevenue) * 100).toFixed(1))
      : 0

  // Aggregate by Product
  const productMarginsMap = new Map<
    string,
    {
      name: string
      catalogType: string
      totalQty: number
      totalRevenue: number
      totalDealerCost: number
      grossProfit: number
    }
  >()

  // Aggregate by Dealer
  const dealerMarginsMap = new Map<
    string,
    {
      dealerId: string
      linesCount: number
      totalQty: number
      totalRevenue: number
      totalDealerCost: number
      grossProfit: number
    }
  >()

  ops.orders.forEach((order) => {
    order.items.forEach((item) => {
      const unitCost = item.dealerCostPrice ?? 0
      const itemCost = unitCost * item.qty
      const itemRev = item.lineTotal
      const itemProfit = itemRev - itemCost

      // Product grouping
      const prodKey = item.name
      const existingProd = productMarginsMap.get(prodKey) || {
        name: item.name,
        catalogType: item.catalogType,
        totalQty: 0,
        totalRevenue: 0,
        totalDealerCost: 0,
        grossProfit: 0,
      }
      existingProd.totalQty += item.qty
      existingProd.totalRevenue += itemRev
      existingProd.totalDealerCost += itemCost
      existingProd.grossProfit += itemProfit
      productMarginsMap.set(prodKey, existingProd)

      // Dealer grouping
      const dealerKey = item.dealerId || 'Unassigned'
      const existingDealer = dealerMarginsMap.get(dealerKey) || {
        dealerId: dealerKey,
        linesCount: 0,
        totalQty: 0,
        totalRevenue: 0,
        totalDealerCost: 0,
        grossProfit: 0,
      }
      existingDealer.linesCount += 1
      existingDealer.totalQty += item.qty
      existingDealer.totalRevenue += itemRev
      existingDealer.totalDealerCost += itemCost
      existingDealer.grossProfit += itemProfit
      dealerMarginsMap.set(dealerKey, existingDealer)
    })
  })

  const productMarginsList = Array.from(productMarginsMap.values())
    .map((p) => ({
      ...p,
      marginPercent:
        p.totalRevenue > 0
          ? Number(((p.grossProfit / p.totalRevenue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit)

  const dealerMarginsList = Array.from(dealerMarginsMap.values())
    .map((d) => ({
      ...d,
      marginPercent:
        d.totalRevenue > 0
          ? Number(((d.grossProfit / d.totalRevenue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.totalDealerCost - a.totalDealerCost)

  const handleExportSalesCSV = () => {
    const headers =
      'OrderNumber,CustomerName,Phone,City,ItemsCount,SubtotalNPR,DeliveryCharge,Discount,TaxVAT,TotalNPR,Status,PaymentMethod,CreatedAt\n'
    const rows = ops.orders
      .map(
        (o) =>
          `"${o.number}","${o.customerName}","${o.customerPhone}","${o.city}",${o.items.length},${o.subtotal},${o.deliveryCharge},${o.discount},${o.tax},${o.total},"${o.status}","${o.paymentMethod}","${o.createdAt}"`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-revenue-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Sales & revenue CSV downloaded')
  }

  const handleExportFleetCSV = () => {
    const headers =
      'RiderID,Name,Phone,Zone,Vehicle,Verified,Available,Deliveries,Rating,CashOnHandNPR,EarningsNPR\n'
    const rows = ops.riders
      .map(
        (r) =>
          `"${r.id}","${r.name}","${r.phone}","${r.zone}","${r.vehicle}",${r.verified},${r.available},${r.deliveries},${r.rating},${r.cashOnHand},${r.earnings}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fleet-logistics-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Fleet logistics CSV downloaded')
  }

  const handleExportIrdVatCSV = () => {
    const prefix = ops.settings.invoicePrefix || 'MEZ-INV-'
    const headers =
      'InvoiceNo,Date,CustomerName,CustomerPAN,TaxableSalesNPR,NonTaxableSales,VATRate,VATAmountNPR,TotalNPR\n'
    const rows = ops.orders
      .map((o) => {
        const taxable = Math.round(o.subtotal - o.discount)
        return `"${prefix}${o.number.replace(/[^0-9]/g, '')}","${o.createdAt.slice(0, 10)}","${o.customerName}","N/A",${taxable},0,"${ops.settings.taxRate}%",${o.tax},${o.total}`
      })
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nepal-ird-vat-annex13-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Nepal IRD VAT Annex 13 CSV downloaded')
  }

  const handleExportProfitMarginCSV = () => {
    const headers =
      'ProductName,CatalogType,UnitsSold,GrossRevenueNPR,DealerCostNPR,GrossProfitNPR,GrossMarginPercent\n'
    const rows = productMarginsList
      .map(
        (p) =>
          `"${p.name}","${p.catalogType}",${p.totalQty},${p.totalRevenue},${p.totalDealerCost},${p.grossProfit},"${p.marginPercent}%"`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profit-margin-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Profit & Margin audit CSV downloaded')
  }

  const handleExportProductVelocityCSV = () => {
    if (ops.sourcingIntelligence) {
      exportProductVelocityCSV(ops.sourcingIntelligence, null)
    } else {
      toast.error('Sourcing intelligence data not loaded yet')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Growth"
        title="Business reports and audits"
        description="Downloadable fiscal audits, IRD VAT compliance returns, courier fulfillment metrics, and warehouse valuation."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Cumulative sales audit"
          value={formatNPR(grossSalesTotal)}
          note="Gross order checkout revenue"
          icon={DollarSign}
        />
        <KpiCard
          label="Realized gross profit"
          value={`${formatNPR(totalGrossProfit)} (${overallMarginPercent}%)`}
          note="Revenue minus dealer snapshot cost"
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Dealer sourcing cost (COGS)"
          value={formatNPR(totalDealerCost)}
          note="Payable to partner merchant shops"
          icon={Store}
        />
        <KpiCard
          label="Fleet logistics deliveries"
          value={totalDeliveriesCount}
          note="Parcels completed in Butwal hub"
          icon={Truck}
        />
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Report 1: Sales Audit */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground mb-2">
              <DollarSign className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">
              Fiscal sales and revenue audit
            </CardTitle>
            <CardDescription className="text-xs">
              Detailed breakdown of order transaction numbers, customer contact
              profiles, delivery surcharges, applied discounts, and net realized
              turnover.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatNPR(grossSalesTotal)}
            </span>
            <Button
              size="sm"
              onClick={handleExportSalesCSV}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </CardFooter>
        </Card>

        {/* Report 2: Profit & Margin Sourcing Intelligence */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 mb-2">
              <TrendingUp className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">
              Profit & margin sourcing intelligence
            </CardTitle>
            <CardDescription className="text-xs">
              Item-level margins, dealer snapshot costs, net retail realization,
              and gross profit percentage across liquor &amp; grocery catalog
              lines.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs font-semibold text-emerald-600 tabular-nums">
              {formatNPR(totalGrossProfit)} ({overallMarginPercent}%)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMarginModalOpen(true)}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview &amp; Breakdown
              </Button>
              <Button
                size="sm"
                onClick={handleExportProfitMarginCSV}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Report 3: Fleet Performance */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground mb-2">
              <Truck className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">
              Fleet delivery logistics performance
            </CardTitle>
            <CardDescription className="text-xs">
              Courier-wise completion metrics, active COD floats in transit,
              star ratings, and commission disbursements for Butwal, Tilottama
              &amp; Siddharthanagar corridors.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {totalDeliveriesCount} parcels
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFleetModalOpen(true)}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview Fleet SLA
              </Button>
              <Button
                size="sm"
                onClick={handleExportFleetCSV}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Report 4: IRD VAT Annex 13 */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground mb-2">
              <Building className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">
              Nepal IRD VAT Annex 13 (बिक्री खाता)
            </CardTitle>
            <CardDescription className="text-xs">
              Official Government of Nepal Inland Revenue Department monthly
              sales ledger format ready for tax audit submission.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs text-muted-foreground">
              PAN: {ops.settings.pan || '609823415'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsIrdModalOpen(true)}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                size="sm"
                onClick={handleExportIrdVatCSV}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Report 5: Product Velocity & Sourcing Intelligence */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 mb-2">
              <Flame className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">
              Product velocity &amp; sourcing intelligence
            </CardTitle>
            <CardDescription className="text-xs">
              Top products, slow movers &amp; dead stock risks, most-unavailable
              catalog items, and merchant substitution rates across Butwal
              operations.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {ops.sourcingIntelligence?.summary
                .networkSubstitutionRatePercent ?? 0}
              % substitution &middot;{' '}
              {ops.sourcingIntelligence?.topProducts.length ?? 0} active lines
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVelocityModalOpen(true)}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview Intelligence
              </Button>
              <Button
                size="sm"
                onClick={handleExportProductVelocityCSV}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Profit & Margin Analytics Preview Dialog */}
      <Dialog open={isMarginModalOpen} onOpenChange={setIsMarginModalOpen}>
        <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/10 shrink-0">
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Profit &amp; Margin Breakdown (Dealer Sourcing)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Item-level retail revenue vs dealer snapshot costs across Butwal
                operations.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleExportProfitMarginCSV}
              className="h-7 gap-1 text-xs cursor-pointer"
            >
              <Download className="h-3 w-3" />
              Download CSV
            </Button>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 text-xs click-scroll">
            {/* Summary Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg border border-border">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Net Merchandise Turnover:
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatNPR(totalMerchandiseRevenue)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Dealer Sourcing Cost (COGS):
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatNPR(totalDealerCost)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Realized Gross Margin:
                </span>
                <span className="text-sm font-bold font-mono text-emerald-600">
                  {formatNPR(totalGrossProfit)} ({overallMarginPercent}%)
                </span>
              </div>
            </div>

            {/* Tabs: By Product vs By Dealer */}
            <Tabs
              value={marginTab}
              onValueChange={(v) => setMarginTab(v as 'product' | 'dealer')}
              className="w-full"
            >
              <TabsList className="h-8 mb-3">
                <TabsTrigger
                  value="product"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <span>Product Margins ({productMarginsList.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="dealer"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <span>Dealer Performance ({dealerMarginsList.length})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="product" className="space-y-3 m-0">
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product Name</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-right text-xs">
                          Units
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Gross Revenue
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Dealer Cost
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Gross Profit
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Margin %
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productMarginsList.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-6 text-muted-foreground"
                          >
                            No product sales recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        productMarginsList.map((p) => (
                          <TableRow key={p.name}>
                            <TableCell className="font-medium text-xs text-foreground">
                              {p.name}
                            </TableCell>
                            <TableCell className="text-xs capitalize text-muted-foreground">
                              {p.catalogType}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {p.totalQty}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatNPR(p.totalRevenue)}
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
                                    ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10 text-xs'
                                    : 'border-amber-500 text-amber-500 bg-amber-500/10 text-xs'
                                }
                              >
                                {p.marginPercent}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="dealer" className="space-y-3 m-0">
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">
                          Dealer Identification
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Lines Sourced
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Total Units
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Retail Turnover
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Dealer Payable (Cost)
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Gross Margin
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealerMarginsList.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-6 text-muted-foreground"
                          >
                            No dealer sourcing lines recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dealerMarginsList.map((d) => (
                          <TableRow key={d.dealerId}>
                            <TableCell className="font-mono text-xs text-foreground">
                              {d.dealerId}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {d.linesCount}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {d.totalQty}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatNPR(d.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                              {formatNPR(d.totalDealerCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600">
                              {formatNPR(d.grossProfit)} ({d.marginPercent}%)
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fleet Delivery Logistics & COD Floats Modal */}
      <Dialog open={isFleetModalOpen} onOpenChange={setIsFleetModalOpen}>
        <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/10 shrink-0">
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Fleet Logistics, COD Floats &amp; Corridor SLA
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rider completion volume, live COD cash holdings, and corridor
                coverage.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleExportFleetCSV}
              className="h-7 gap-1 text-xs cursor-pointer"
            >
              <Download className="h-3 w-3" />
              Download CSV
            </Button>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 text-xs click-scroll">
            {/* Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg border border-border">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Active Couriers:
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {ops.riders.length} registered (
                  {ops.riders.filter((r) => r.available).length} online)
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Total Completed Parcels:
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {totalDeliveriesCount} drop-offs
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Total Outstanding COD Float:
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatNPR(
                    ops.riders.reduce((sum, r) => sum + r.cashOnHand, 0),
                  )}
                </span>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Courier Name</TableHead>
                    <TableHead className="text-xs">Contact</TableHead>
                    <TableHead className="text-xs">Corridor / Zone</TableHead>
                    <TableHead className="text-xs">Vehicle</TableHead>
                    <TableHead className="text-right text-xs">
                      Deliveries
                    </TableHead>
                    <TableHead className="text-right text-xs">Rating</TableHead>
                    <TableHead className="text-right text-xs">
                      COD Float Held
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Earnings
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ops.riders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-6 text-muted-foreground"
                      >
                        No registered riders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ops.riders.map((r) => {
                      const limit = ops.settings.riderCodLimit || 2000000
                      const isHighFloat = r.cashOnHand >= limit * 0.8
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {r.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.phone}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {r.zone || 'Butwal Hub'}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {r.vehicle}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {r.deliveries}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-warning">
                            ★ {r.rating.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            <span
                              className={
                                isHighFloat
                                  ? 'text-destructive font-bold'
                                  : 'text-foreground'
                              }
                            >
                              {formatNPR(r.cashOnHand)}
                            </span>
                            {isHighFloat && (
                              <Badge
                                variant="outline"
                                className="ml-1.5 text-xs border-destructive text-destructive"
                              >
                                Near Limit
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600">
                            {formatNPR(r.earnings)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* IRD VAT Annex 13 Preview Dialog */}
      <Dialog open={isIrdModalOpen} onOpenChange={setIsIrdModalOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/10 shrink-0">
            <DialogTitle className="text-sm font-medium">
              Government of Nepal · IRD Sales Ledger (अनुसूची १३)
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="h-7 gap-1 text-xs"
            >
              <Printer className="h-3 w-3" />
              Print / Save PDF
            </Button>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 text-xs click-scroll">
            <div className="text-center border-b border-border/50 pb-3">
              <h3 className="font-semibold text-xs text-foreground">
                Government of Nepal · Ministry of Finance
              </h3>
              <p className="text-muted-foreground">
                Inland Revenue Department (आन्तरिक राजस्व विभाग)
              </p>
              <p className="text-xs text-muted-foreground/70">
                Monthly Sales Ledger (अनुसूची १३ - बिक्री खाता)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-md border border-border text-xs">
              <div>
                <span className="text-muted-foreground">Taxpayer: </span>
                <span className="font-medium text-foreground">
                  {ops.settings.legalName || 'MEZMANI PVT. LTD.'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">PAN: </span>
                <span className="font-mono font-medium text-foreground">
                  {ops.settings.pan || '609823415'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Period: </span>
                <span className="text-foreground">Fiscal Year 2082/83</span>
              </div>
              <div>
                <span className="text-muted-foreground">VAT Rate: </span>
                <span className="text-foreground">{ops.settings.taxRate}%</span>
              </div>
            </div>

            <div className="border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Buyer</TableHead>
                    <TableHead className="text-right text-xs">
                      Taxable
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      VAT (13%)
                    </TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ops.orders.map((o) => {
                    const taxable = Math.round(o.subtotal - o.discount)
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">
                          {ops.settings.invoicePrefix || 'MEZ-INV-'}
                          {o.number.replace(/[^0-9]/g, '')}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {o.createdAt.slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.customerName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNPR(taxable)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNPR(o.tax)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium text-foreground">
                          {formatNPR(o.total)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="p-3 bg-muted/30 rounded-md border border-border flex justify-between items-center text-xs">
              <span className="font-medium text-foreground">
                Total VAT collected to remit to IRD:
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatNPR(estimatedVatCollected)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Velocity & Sourcing Intelligence Preview Dialog */}
      <ProductVelocityDialog
        open={isVelocityModalOpen}
        onOpenChange={setIsVelocityModalOpen}
        initialData={ops.sourcingIntelligence}
      />
    </div>
  )
}
