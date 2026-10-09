import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getOpsBundleFn } from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import {
  pageClass,
  cardClass,
  tableWrap,
  thClass,
  tdClass,
  btnPrimary,
  btnSecondary,
} from '#/components/admin/styles'
import {
  BarChart3,
  Download,
  Printer,
  DollarSign,
  Truck,
  Building,
  Package,
  Calendar,
  X,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'

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
    toast.success('Sales & Revenue CSV downloaded')
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
    toast.success('Fleet Logistics CSV downloaded')
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
          `"Liquor","${v.sku}","${l.name}","${l.brandName || ''}","${l.categoryName || ''}","${v.sizeVolume}",${v.stock ?? 25},${v.price}`
      )
    )
    const groceryRows = grocery.map(
      (g) =>
        `"Grocery","${g.sku}","${g.name}","${g.brand || ''}","${g.categoryName || ''}","${g.weightVolume || 'Standard'}",${g.stock ?? 30},${g.price}`
    )
    const blob = new Blob([headers + [...liquorRows, ...groceryRows].join('\n')], {
      type: 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-valuation-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Inventory Valuation CSV downloaded')
  }

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="Growth"
        title="Business Reports & Audits"
        description="Downloadable fiscal audits, IRD VAT compliance returns, courier fulfillment metrics, and warehouse valuation."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Cumulative Sales Audit"
          value={formatNPR(grossSalesTotal)}
          note="Gross order checkout revenue"
          icon={DollarSign}
        />
        <KpiCard
          label="Fleet Logistics Deliveries"
          value={totalDeliveriesCount}
          note="Parcels completed in Kathmandu"
          icon={Truck}
          tone="success"
        />
        <KpiCard
          label="Nepal IRD VAT Remittance"
          value={formatNPR(estimatedVatCollected)}
          note={`13% VAT accrued for IRD`}
          icon={Building}
        />
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report 1: Sales Audit */}
        <div className={`${cardClass} p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <DollarSign className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Fiscal Sales & Revenue Audit</h3>
            <p className="text-xs text-slate-500">
              Detailed breakdown of order transaction numbers, customer contact profiles, delivery surcharges, applied discounts, and net realized turnover.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="font-mono font-bold text-sm text-blue-700">
              {formatNPR(grossSalesTotal)}
            </span>
            <button type="button" onClick={handleExportSalesCSV} className={btnPrimary}>
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>
        </div>

        {/* Report 2: Fleet Performance */}
        <div className={`${cardClass} p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Truck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Fleet Delivery Logistics Performance</h3>
            <p className="text-xs text-slate-500">
              Courier-wise completion metrics, active COD floats in transit, star ratings, and commission disbursements for Kathmandu Valley corridors.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="font-bold text-sm text-emerald-700">
              {totalDeliveriesCount} Completed Parcels
            </span>
            <button type="button" onClick={handleExportFleetCSV} className={btnPrimary}>
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>
        </div>

        {/* Report 3: IRD VAT Annex 13 */}
        <div className={`${cardClass} p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <Building className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Nepal IRD VAT Annex 13 (बिक्री खाता)</h3>
            <p className="text-xs text-slate-500">
              Official Government of Nepal Inland Revenue Department monthly sales ledger format ready for tax audit submission.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="font-mono font-bold text-xs text-slate-800">
              PAN: {ops.settings.pan || '609823415'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsIrdModalOpen(true)}
                className={btnSecondary}
              >
                <Printer className="h-4 w-4" />
                Preview
              </button>
              <button type="button" onClick={handleExportIrdVatCSV} className={btnPrimary}>
                <Download className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          </div>
        </div>

        {/* Report 4: Inventory Valuation */}
        <div className={`${cardClass} p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition`}>
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Stock Valuation & Asset Audit</h3>
            <p className="text-xs text-slate-500">
              Combined catalog inventory units on hand across Liquor and Grocery lines with cost evaluation basis and retail turnover potential.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-800">
              {liquor.length + grocery.length} Catalog Items
            </span>
            <button type="button" onClick={handleExportInventoryCSV} className={btnPrimary}>
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* IRD VAT Annex 13 Preview Modal */}
      {isIrdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="font-bold text-sm text-slate-800">
                Government of Nepal &bull; IRD Sales Ledger (अनुसूची १३)
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => window.print()} className={btnPrimary}>
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsIrdModalOpen(false)}
                  className={btnSecondary}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-5 text-xs text-slate-800 font-sans">
              <div className="text-center border-b pb-3 border-slate-200">
                <h3 className="font-bold text-sm text-slate-900 uppercase">
                  Government of Nepal &bull; Ministry of Finance
                </h3>
                <p className="text-slate-600 font-medium">Inland Revenue Department (आन्तरिक राजस्व विभाग)</p>
                <p className="text-slate-400 text-[10px]">Monthly Sales Ledger (अनुसूची १३ - बिक्री खाता)</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Taxpayer Trade Name: </span>
                  <strong className="text-slate-900">{ops.settings.legalName || 'MEZMANI PVT. LTD.'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Permanent Account No (PAN): </span>
                  <strong className="text-slate-900 font-mono">{ops.settings.pan || '609823415'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Tax Period: </span>
                  <strong className="text-slate-900">Fiscal Year 2082/83 (Ashwin / Kartik)</strong>
                </div>
                <div>
                  <span className="text-slate-500">Standard VAT Rate: </span>
                  <strong className="text-slate-900">{ops.settings.taxRate}%</strong>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Buyer Name</th>
                      <th className="py-2.5 px-3 text-right">Taxable Sales</th>
                      <th className="py-2.5 px-3 text-right">VAT (13%)</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ops.orders.map((o) => {
                      const taxable = Math.round(o.subtotal - o.discount)
                      return (
                        <tr key={o.id}>
                          <td className="py-2 px-3 font-mono font-semibold">
                            {ops.settings.invoicePrefix || 'MEZ-INV-'}
                            {o.number.replace(/[^0-9]/g, '')}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{o.createdAt.slice(0, 10)}</td>
                          <td className="py-2 px-3">{o.customerName}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatNPR(taxable)}</td>
                          <td className="py-2 px-3 text-right font-mono text-purple-700 font-bold">
                            {formatNPR(o.tax)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatNPR(o.total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex justify-between items-center text-xs">
                <span className="font-bold text-purple-900">Total VAT Collected to Remit to IRD:</span>
                <span className="text-base font-extrabold text-purple-800 font-mono">
                  {formatNPR(estimatedVatCollected)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
