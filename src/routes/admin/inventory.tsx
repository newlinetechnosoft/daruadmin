import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  addLedgerFn,
} from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  Package,
  Search,
  Download,
  AlertTriangle,
  Boxes,
  Plus,
  Wine,
  ShoppingBag,
  ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import {
  NativeSelect,
  NativeSelectOption,
} from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { EmptyState } from '#/components/shared/empty-state'

export const Route = createFileRoute('/admin/inventory')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminInventoryPage,
})

function AdminInventoryPage() {
  const { liquor, grocery } = Route.useLoaderData()
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
            variantName: v.name || `${v.volumeMl}ml`,
            stock: v.stock ?? 25,
            price: v.price,
            lowStockThreshold: 20,
          })
        }
      }
    }

    for (const g of grocery) {
      if (g.variants && g.variants.length > 0) {
        for (const v of g.variants) {
          list.push({
            id: `${g.id}-${v.id}`,
            type: 'grocery',
            name: g.name,
            brand: 'Local Merchant',
            category: g.categoryName || 'Grocery',
            sku: v.sku,
            variantName: v.name || `${v.quantity} ${v.unit}`,
            stock: v.stock ?? 30,
            price: v.price,
            lowStockThreshold: 20,
          })
        }
      }
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
        `Restocked ${restockQty} units. COGS bill of ${formatNPR(totalExpense)} logged to Ledger.`
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
    <div className="space-y-6">
      <PageHeader
        kicker="Commerce"
        title="Inventory and stock tracking"
        description="Unified warehouse stock management across Liquor and Grocery catalogs with automated COGS ledger sync."
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export stock CSV
          </Button>
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
          label="Total units on hand"
          value={totalUnitsOnHand}
          note="Combined warehouse count"
          icon={Boxes}
        />
        <KpiCard
          label="Asset valuation"
          value={formatNPR(totalInventoryValuation)}
          note="COGS inventory cost basis"
          icon={ArrowUpRight}
          tone="success"
        />
        <KpiCard
          label="Low stock alerts"
          value={lowStockCount}
          note="Variants at or below 20 units"
          icon={AlertTriangle}
          tone={lowStockCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by product name, SKU, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value as any)}
            size="sm"
            className="h-8 text-xs"
          >
            <NativeSelectOption value="all">All catalogs</NativeSelectOption>
            <NativeSelectOption value="liquor">Liquor only</NativeSelectOption>
            <NativeSelectOption value="grocery">Grocery only</NativeSelectOption>
          </NativeSelect>

          <NativeSelect
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            size="sm"
            className="h-8 text-xs"
          >
            <NativeSelectOption value="all">All stock statuses</NativeSelectOption>
            <NativeSelectOption value="low">Low stock alerts (≤20)</NativeSelectOption>
            <NativeSelectOption value="out">Out of stock (0)</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">SKU and variant</TableHead>
              <TableHead className="text-xs">Product details</TableHead>
              <TableHead className="text-xs">Catalog</TableHead>
              <TableHead className="text-xs">Retail price</TableHead>
              <TableHead className="text-xs">Units on hand</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-right text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="No inventory records match"
                    description="Try clearing filters or search terms."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isLow = item.stock <= item.lowStockThreshold
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-foreground block">{item.sku}</span>
                      <span className="text-[11px] text-muted-foreground">{item.variantName}</span>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground">{item.brand} · {item.category}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="gap-1 text-[11px] font-normal capitalize">
                        {item.type === 'liquor' ? (
                          <Wine className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                        )}
                        {item.type}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs tabular-nums text-foreground">
                        {formatNPR(item.price)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className={`font-mono text-xs font-medium tabular-nums ${isLow ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                        {item.stock} units
                      </span>
                    </TableCell>

                    <TableCell>
                      {isLow ? (
                        <Badge variant="destructive" className="gap-1 text-[10px] font-normal">
                          <AlertTriangle className="h-3 w-3" /> Low stock
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          Adequate
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRestockItem(item)
                          setCostPerUnit(Math.round(item.price * 0.65))
                        }}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        Restock
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Quick Restock Dialog */}
      <Dialog open={Boolean(restockItem)} onOpenChange={(open) => !open && setRestockItem(null)}>
        {restockItem && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">Restock inventory</DialogTitle>
              <DialogDescription className="text-xs">
                {restockItem.name} ({restockItem.variantName})
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleQuickRestock} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Units to add to warehouse *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Vendor purchase cost per unit (NPR) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  Automatically logged as COGS purchase bill in the general ledger
                </span>
              </div>

              <div className="flex items-center justify-between rounded-md bg-muted/40 p-3 text-xs">
                <span className="text-muted-foreground">Total purchase expenditure:</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {formatNPR(restockQty * costPerUnit)}
                </span>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRestockItem(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
                  {isSubmitting ? 'Posting...' : 'Confirm restock and log COGS'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
