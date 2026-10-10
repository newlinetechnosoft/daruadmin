import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getOpsBundleFn } from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  Download,
  Printer,
  DollarSign,
  Truck,
  Building,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
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

export const Route = createFileRoute('/admin/reports')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminReportsPage,
})

function AdminReportsPage() {
  const { ops, liquor, grocery } = Route.useLoaderData()

  const [isIrdModalOpen, setIsIrdModalOpen] = useState(false)

  // Aggregate Metrics
  const grossSalesTotal = ops.orders.reduce((sum, o) => sum + o.total, 0)
  const totalDeliveriesCount = ops.riders.reduce((sum, r) => sum + r.deliveries, 0)
  const estimatedVatCollected = Math.round(ops.orders.reduce((sum, o) => sum + o.tax, 0))

  const handleExportSalesCSV = () => {
    const headers =
      'OrderNumber,CustomerName,Phone,City,ItemsCount,SubtotalNPR,DeliveryCharge,Discount,TaxVAT,TotalNPR,Status,PaymentMethod,CreatedAt\n'
    const rows = ops.orders
      .map(
        (o) =>
          `"${o.number}","${o.customerName}","${o.customerPhone}","${o.city}",${o.items.length},${o.subtotal},${o.deliveryCharge},${o.discount},${o.tax},${o.total},"${o.status}","${o.paymentMethod}","${o.createdAt}"`
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
          `"${r.id}","${r.name}","${r.phone}","${r.zone}","${r.vehicle}",${r.verified},${r.available},${r.deliveries},${r.rating},${r.cashOnHand},${r.earnings}`
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

  const handleExportInventoryCSV = () => {
    const headers = 'CatalogType,SKU,ProductName,Brand,Category,Variant,StockOnHand,RetailPriceNPR\n'
    const liquorRows = liquor.flatMap((l) =>
      (l.variants || []).map(
        (v) =>
          `"Liquor","${v.sku}","${l.name}","${l.brandName || ''}","${l.categoryName || ''}","${v.name || `${v.volumeMl}ml`}",${v.stock ?? 25},${v.price}`,
      ),
    )
    const groceryRows = grocery.flatMap((g) =>
      (g.variants || []).map(
        (v) =>
          `"Grocery","${v.sku}","${g.name}","","${g.categoryName || ''}","${v.name || `${v.quantity} ${v.unit}`}",${v.stock ?? 30},${v.price}`,
      ),
    )
    const blob = new Blob([headers + [...liquorRows, ...groceryRows].join('\n')], {
      type: 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-valuation-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Inventory valuation CSV downloaded')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Growth"
        title="Business reports and audits"
        description="Downloadable fiscal audits, IRD VAT compliance returns, courier fulfillment metrics, and warehouse valuation."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Cumulative sales audit"
          value={formatNPR(grossSalesTotal)}
          note="Gross order checkout revenue"
          icon={DollarSign}
        />
        <KpiCard
          label="Fleet logistics deliveries"
          value={totalDeliveriesCount}
          note="Parcels completed in Kathmandu"
          icon={Truck}
          tone="success"
        />
        <KpiCard
          label="Nepal IRD VAT remittance"
          value={formatNPR(estimatedVatCollected)}
          note="13% VAT accrued for IRD"
          icon={Building}
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
            <CardTitle className="text-sm font-semibold">Fiscal sales and revenue audit</CardTitle>
            <CardDescription className="text-xs">
              Detailed breakdown of order transaction numbers, customer contact profiles, delivery surcharges, applied discounts, and net realized turnover.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatNPR(grossSalesTotal)}
            </span>
            <Button size="sm" onClick={handleExportSalesCSV} className="h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </CardFooter>
        </Card>

        {/* Report 2: Fleet Performance */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground mb-2">
              <Truck className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">Fleet delivery logistics performance</CardTitle>
            <CardDescription className="text-xs">
              Courier-wise completion metrics, active COD floats in transit, star ratings, and commission disbursements for Kathmandu Valley corridors.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {totalDeliveriesCount} parcels
            </span>
            <Button size="sm" onClick={handleExportFleetCSV} className="h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </CardFooter>
        </Card>

        {/* Report 3: IRD VAT Annex 13 */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground mb-2">
              <Building className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">Nepal IRD VAT Annex 13 (बिक्री खाता)</CardTitle>
            <CardDescription className="text-xs">
              Official Government of Nepal Inland Revenue Department monthly sales ledger format ready for tax audit submission.
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
                className="h-8 gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button size="sm" onClick={handleExportIrdVatCSV} className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Report 4: Inventory Valuation */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground mb-2">
              <Package className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">Stock valuation and asset audit</CardTitle>
            <CardDescription className="text-xs">
              Combined catalog inventory units on hand across Liquor and Grocery lines with cost evaluation basis and retail turnover potential.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <span className="font-mono text-xs text-muted-foreground">
              {liquor.length + grocery.length} catalog items
            </span>
            <Button size="sm" onClick={handleExportInventoryCSV} className="h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* IRD VAT Annex 13 Preview Dialog */}
      <Dialog open={isIrdModalOpen} onOpenChange={setIsIrdModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
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

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            <div className="text-center border-b border-border/50 pb-3">
              <h3 className="font-semibold text-xs text-foreground">
                Government of Nepal · Ministry of Finance
              </h3>
              <p className="text-muted-foreground">Inland Revenue Department (आन्तरिक राजस्व विभाग)</p>
              <p className="text-[11px] text-muted-foreground/70">Monthly Sales Ledger (अनुसूची १३ - बिक्री खाता)</p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-md border border-border text-xs">
              <div>
                <span className="text-muted-foreground">Taxpayer: </span>
                <span className="font-medium text-foreground">{ops.settings.legalName || 'MEZMANI PVT. LTD.'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">PAN: </span>
                <span className="font-mono font-medium text-foreground">{ops.settings.pan || '609823415'}</span>
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
                    <TableHead className="text-right text-xs">Taxable</TableHead>
                    <TableHead className="text-right text-xs">VAT (13%)</TableHead>
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
                        <TableCell className="text-muted-foreground text-xs">{o.createdAt.slice(0, 10)}</TableCell>
                        <TableCell className="text-xs">{o.customerName}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNPR(taxable)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNPR(o.tax)}</TableCell>
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
              <span className="font-medium text-foreground">Total VAT collected to remit to IRD:</span>
              <span className="font-mono font-bold text-foreground">
                {formatNPR(estimatedVatCollected)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
