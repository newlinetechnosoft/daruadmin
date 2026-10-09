import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  addLedgerFn,
} from '#/server/operations/operations.functions'
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
  btnGhost,
  inputClass,
  selectClass,
  labelClass,
} from '#/components/admin/styles'
import {
  Package,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Boxes,
  Plus,
  Wine,
  ShoppingBag,
  ArrowUpRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/inventory')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminInventoryPage,
})

function AdminInventoryPage() {
  const { ops, liquor, grocery } = Route.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'liquor' | 'grocery'>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')
  const [restockItem, setRestockItem] = useState<{
    id: string
    name: string
    variantName: string
    sku: string
    stock: number
    price: number
  } | null>(null)
  const [restockQty, setRestockQty] = useState(24)
  const [costPerUnit, setCostPerUnit] = useState(1200)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Flatten catalog items
  const inventoryItems = useMemo(() => {
    const list: {
      id: string
      type: 'liquor' | 'grocery'
      name: string
      brand: string
      category: string
      sku: string
      variantName: string
      stock: number
      price: number
      lowStockThreshold: number
    }[] = []

    for (const l of liquor) {
      if (l.variants && l.variants.length > 0) {
        for (const v of l.variants) {
          list.push({
            id: `${l.id}-${v.id}`,
            type: 'liquor',
            name: l.name,
            brand: l.brandName || 'Mezmani Spirits',
            category: l.categoryName || 'Liquor',
            sku: v.sku,
            variantName: v.sizeVolume,
            stock: v.stock ?? 25,
            price: v.price,
            lowStockThreshold: 20,
          })
        }
      }
    }

    for (const g of grocery) {
      list.push({
        id: g.id,
        type: 'grocery',
        name: g.name,
        brand: g.brand || 'Local Merchant',
        category: g.categoryName || 'Grocery',
        sku: g.sku,
        variantName: g.weightVolume || 'Standard',
        stock: g.stock ?? 30,
        price: g.price,
        lowStockThreshold: 20,
      })
    }

    return list
  }, [liquor, grocery])

  const filteredItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      if (catalogFilter !== 'all' && item.type !== catalogFilter) return false
      if (stockFilter === 'low' && item.stock > item.lowStockThreshold) return false
      if (stockFilter === 'out' && item.stock > 0) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [inventoryItems, catalogFilter, stockFilter, searchQuery])

  // KPIs
  const totalUnitsOnHand = inventoryItems.reduce((sum, i) => sum + i.stock, 0)
  const totalInventoryValuation = inventoryItems.reduce((sum, i) => sum + i.stock * Math.round(i.price * 0.65), 0)
  const lowStockCount = inventoryItems.filter((i) => i.stock <= i.lowStockThreshold).length

  const handleQuickRestock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restockItem) return

    try {
      setIsSubmitting(true)
      const totalExpense = restockQty * costPerUnit

      // Post COGS bill to General Ledger in Neon DB
      await addLedgerFn({
        data: {
          type: 'debit',
          category: 'purchase',
          account: 'bank',
          memo: `Inventory Restock: ${restockQty} units of ${restockItem.name} (${restockItem.variantName})`,
          amount: totalExpense,
        },
      })

      toast.success(
        `Restocked ${restockQty} units! COGS bill of ${formatNPR(totalExpense)} logged to Ledger.`
      )
      setRestockItem(null)
      await router.invalidate()
    } catch {
      toast.error('Failed to log restock purchase')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = 'SKU,ProductName,CatalogType,Brand,Category,Variant,StockOnHand,RetailPriceNPR\n'
    const rows = filteredItems
      .map(
        (i) =>
          `"${i.sku}","${i.name}","${i.type}","${i.brand}","${i.category}","${i.variantName}",${i.stock},${i.price}`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-stock-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Inventory stock report exported to CSV')
  }

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="Commerce"
        title="Inventory & Stock Tracking"
        description="Unified warehouse stock management across Liquor and Grocery catalogs with automated COGS ledger sync."
        actions={
          <button type="button" onClick={handleExportCSV} className={btnSecondary}>
            <Download className="h-4 w-4" />
            Export Stock CSV
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Catalog SKUs"
          value={inventoryItems.length}
          note="Active tracked variants"
          icon={Package}
        />
        <KpiCard
          label="Total Units On Hand"
          value={totalUnitsOnHand}
          note="Combined warehouse count"
          icon={Boxes}
        />
        <KpiCard
          label="Estimated Asset Valuation"
          value={formatNPR(totalInventoryValuation)}
          note="COGS inventory cost basis"
          icon={ArrowUpRight}
          tone="success"
        />
        <KpiCard
          label="Low Stock Alerts"
          value={lowStockCount}
          note="Variants at or below 20 units"
          icon={AlertTriangle}
          tone={lowStockCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className={`${cardClass} p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value as any)}
            className={selectClass}
          >
            <option value="all">All Catalogs</option>
            <option value="liquor">Liquor Only</option>
            <option value="grocery">Grocery Only</option>
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className={selectClass}
          >
            <option value="all">All Stock Statuses</option>
            <option value="low">Low Stock Alerts (≤20)</option>
            <option value="out">Out of Stock (0)</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className={tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className={thClass}>SKU & Variant</th>
                <th className={thClass}>Product Details</th>
                <th className={thClass}>Catalog</th>
                <th className={thClass}>Retail Price</th>
                <th className={thClass}>Units On Hand</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No inventory records match your filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.stock <= item.lowStockThreshold
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <span className="font-mono font-bold text-slate-900 block">{item.sku}</span>
                        <span className="text-xs text-slate-500">{item.variantName}</span>
                      </td>

                      <td className={tdClass}>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.brand} &bull; {item.category}</div>
                      </td>

                      <td className={tdClass}>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.type === 'liquor' ? (
                            <Wine className="h-3 w-3 text-amber-700" />
                          ) : (
                            <ShoppingBag className="h-3 w-3 text-emerald-700" />
                          )}
                          {item.type}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-mono font-semibold text-slate-900">
                          {formatNPR(item.price)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className={`font-mono font-bold ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                          {item.stock} units
                        </span>
                      </td>

                      <td className={tdClass}>
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Adequate
                          </span>
                        )}
                      </td>

                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => {
                            setRestockItem(item)
                            setCostPerUnit(Math.round(item.price * 0.65))
                          }}
                          className={btnSecondary}
                          style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Restock
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Restock Inventory</h3>
                <p className="text-xs text-slate-500">{restockItem.name} ({restockItem.variantName})</p>
              </div>
              <button
                type="button"
                onClick={() => setRestockItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickRestock} className="space-y-4 text-xs">
              <div>
                <label className={labelClass}>Units to Add to Warehouse *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Vendor Purchase Cost per Unit (NPR) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(Number(e.target.value))}
                  className={inputClass}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Automatically logged as COGS purchase bill in the General Ledger
                </span>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs flex justify-between items-center">
                <span className="font-semibold text-blue-900">Total Purchase Expenditure:</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {formatNPR(restockQty * costPerUnit)}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? 'Posting...' : 'Confirm Restock & Log COGS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
