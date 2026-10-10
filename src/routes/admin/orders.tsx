import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  updateOrderFn,
  createOrderFn,
} from '#/server/operations/operations.functions'
import type { Order, OrderStatus, PaymentMethod } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { StatusBadge } from '#/components/shared/status-badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { NativeSelect } from '#/components/ui/native-select'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
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
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  Bike,
  Printer,
  CreditCard,
  MapPin,
  Clock,
  Phone,
  Mail,
  Receipt,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/orders')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminOrdersPage,
})

const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packing', label: 'Packing' },
  { value: 'assigned', label: 'Rider Assigned' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
]

function AdminOrdersPage() {
  const { ops, liquor, grocery } = Route.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Create order form state
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    city: 'Kathmandu',
    paymentMethod: 'cod' as PaymentMethod,
    notes: '',
    items: [] as {
      catalogType: 'liquor' | 'grocery'
      productId: string
      variantId: string
      name: string
      variantName: string
      sku: string
      qty: number
      unitPrice: number
    }[],
  })

  const [selectedCatalogItem, setSelectedCatalogItem] = useState('')

  const allCatalogProducts = useMemo(() => {
    const list: {
      id: string
      type: 'liquor' | 'grocery'
      name: string
      sku: string
      price: number
      variantId: string
      variantName: string
    }[] = []

    for (const p of liquor) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          list.push({
            id: p.id,
            type: 'liquor',
            name: p.name,
            sku: v.sku,
            price: v.price,
            variantId: v.id,
            variantName: v.name || `${v.volumeMl}ml`,
          })
        }
      }
    }
    for (const g of grocery) {
      if (g.variants && g.variants.length > 0) {
        for (const v of g.variants) {
          list.push({
            id: g.id,
            type: 'grocery',
            name: g.name,
            sku: v.sku,
            price: v.price,
            variantId: v.id,
            variantName: v.name || `${v.quantity} ${v.unit}`,
          })
        }
      }
    }
    return list
  }, [liquor, grocery])

  const filteredOrders = useMemo(() => {
    return ops.orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          o.number.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          o.city.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [ops.orders, statusFilter, searchQuery])

  // KPIs
  const totalOrdersCount = ops.orders.length
  const pendingCount = ops.orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length
  const outForDeliveryCount = ops.orders.filter((o) => o.status === 'out_for_delivery' || o.status === 'assigned').length
  const deliveredRevenue = ops.orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0)

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      setIsUpdating(true)
      await updateOrderFn({ data: { id: orderId, status } })
      toast.success(`Order status updated to ${status.replaceAll('_', ' ')}`)
      await router.invalidate()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status })
      }
    } catch {
      toast.error('Failed to update order status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAssignRider = async (orderId: string, riderId: string) => {
    try {
      setIsUpdating(true)
      await updateOrderFn({ data: { id: orderId, riderId: riderId || null } })
      const riderName = ops.riders.find((r) => r.id === riderId)?.name || 'None'
      toast.success(`Assigned to rider: ${riderName}`)
      await router.invalidate()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, riderId: riderId || null })
      }
    } catch {
      toast.error('Failed to assign rider')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddItemToForm = () => {
    if (!selectedCatalogItem) return
    const [type, prodId, varId] = selectedCatalogItem.split('::')
    const item = allCatalogProducts.find(
      (p) => p.type === type && p.id === prodId && p.variantId === varId
    )
    if (!item) return

    setOrderForm((prev) => {
      const exists = prev.items.find((i) => i.productId === prodId && i.variantId === varId)
      if (exists) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === prodId && i.variantId === varId
              ? { ...i, qty: i.qty + 1 }
              : i
          ),
        }
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            catalogType: item.type,
            productId: item.id,
            variantId: item.variantId,
            name: item.name,
            variantName: item.variantName,
            sku: item.sku,
            qty: 1,
            unitPrice: item.price,
          },
        ],
      }
    })
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderForm.customerName || !orderForm.address || orderForm.items.length === 0) {
      toast.error('Please fill in customer details and add at least one item')
      return
    }

    try {
      setIsUpdating(true)
      await createOrderFn({
        data: {
          customerName: orderForm.customerName,
          customerEmail: orderForm.customerEmail || 'customer@nexusstore.np',
          customerPhone: orderForm.customerPhone || '+977 9800000000',
          address: orderForm.address,
          city: orderForm.city,
          paymentMethod: orderForm.paymentMethod,
          notes: orderForm.notes,
          items: orderForm.items.map((i) => ({
            catalogType: i.catalogType,
            productId: i.productId,
            variantId: i.variantId,
            qty: i.qty,
          })),
        },
      })
      toast.success('Order created successfully in Neon DB!')
      setIsCreateOpen(false)
      setOrderForm({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        address: '',
        city: 'Kathmandu',
        paymentMethod: 'cod',
        notes: '',
        items: [],
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to create order')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportCSV = () => {
    const headers =
      'OrderNumber,Customer,Phone,City,Status,PaymentMethod,Subtotal,DeliveryCharge,Tax,Total,CreatedAt\n'
    const rows = filteredOrders
      .map(
        (o) =>
          `"${o.number}","${o.customerName}","${o.customerPhone}","${o.city}","${o.status}","${o.paymentMethod}",${o.subtotal},${o.deliveryCharge},${o.tax},${o.total},"${o.createdAt}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Orders exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Commerce"
        title="Order Management"
        description="Monitor lifecycle transitions, assign Kathmandu Valley fleet couriers, and generate government-compliant VAT invoices."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Orders"
          value={totalOrdersCount}
          note="All recorded customer purchases"
          icon={ClipboardList}
        />
        <KpiCard
          label="Pending Dispatch"
          value={pendingCount}
          note="Needs warehouse confirmation"
          icon={Clock}
          tone={pendingCount > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Out For Delivery"
          value={outForDeliveryCount}
          note="Assigned to active couriers"
          icon={Bike}
        />
        <KpiCard
          label="Delivered Revenue"
          value={formatNPR(deliveredRevenue)}
          note="Realized turnover in NPR"
          icon={CreditCard}
          tone="success"
        />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by order #, customer, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <NativeSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs"
            >
              {ORDER_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order # & Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total (NPR)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Assigned Rider</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    No orders match your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const assignedRider = ops.riders.find((r) => r.id === order.riderId)
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="font-mono font-medium text-foreground block">
                          {order.number}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-foreground">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{order.customerPhone}</div>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-foreground">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </span>
                        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {order.items.map((i) => i.name).join(', ')}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-semibold text-foreground font-mono">
                          {formatNPR(order.total)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <StatusBadge value={order.status} />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[11px] uppercase">
                          {order.paymentMethod}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {assignedRider ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{assignedRider.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedOrder(order)
                              setIsInvoiceOpen(true)
                            }}
                            title="Print Tax Invoice"
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog
        open={Boolean(selectedOrder && !isInvoiceOpen)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        {selectedOrder && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order {selectedOrder.number}</DialogTitle>
              <DialogDescription>
                Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Status and Action Selector */}
              <div className="p-3.5 rounded-lg border border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <StatusBadge value={selectedOrder.status} />
                </div>

                <div className="flex items-center gap-2">
                  <NativeSelect
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value as OrderStatus)}
                    disabled={isUpdating}
                    className="text-xs font-medium"
                  >
                    {ORDER_STATUSES.filter((s) => s.value !== 'all').map((s) => (
                      <option key={s.value} value={s.value}>
                        Set {s.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Customer & Courier dispatch details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-3.5 space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Customer Details
                    </span>
                    <div className="font-semibold text-foreground">{selectedOrder.customerName}</div>
                    <div className="text-muted-foreground flex items-center gap-1.5 font-mono">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {selectedOrder.customerPhone}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {selectedOrder.customerEmail}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {selectedOrder.address}, {selectedOrder.city}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3.5 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Fleet Dispatch
                    </span>
                    <div className="space-y-1">
                      <Label htmlFor="courier-select" className="text-xs">Assigned Courier</Label>
                      <NativeSelect
                        id="courier-select"
                        value={selectedOrder.riderId || ''}
                        onChange={(e) => handleAssignRider(selectedOrder.id, e.target.value)}
                        disabled={isUpdating}
                        className="text-xs"
                      >
                        <option value="">No Rider Assigned</option>
                        {ops.riders.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.zone} &bull; {r.status})
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="text-muted-foreground pt-1">
                      Payment Mode: <strong className="uppercase text-foreground font-mono">{selectedOrder.paymentMethod}</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Items List */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{item.variantName}</span>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{item.sku}</TableCell>
                        <TableCell className="text-center font-semibold text-foreground">{item.qty}</TableCell>
                        <TableCell className="text-right font-mono">{formatNPR(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-foreground">
                          {formatNPR(item.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Price Calculation Summary */}
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1.5 text-xs text-right max-w-xs ml-auto">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatNPR(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatNPR(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Charge:</span>
                  <span className="font-mono">{formatNPR(selectedOrder.deliveryCharge)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT ({ops.settings.taxRate}%):</span>
                  <span className="font-mono">{formatNPR(selectedOrder.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1.5">
                  <span>Grand Total:</span>
                  <span className="font-mono">{formatNPR(selectedOrder.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInvoiceOpen(true)}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedOrder(null)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Printable Nepal VAT Tax Invoice Dialog */}
      <Dialog
        open={Boolean(isInvoiceOpen && selectedOrder)}
        onOpenChange={(open) => !open && setIsInvoiceOpen(false)}
      >
        {selectedOrder && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="no-print border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Tax Invoice Preview</DialogTitle>
                  <DialogDescription className="font-mono">{selectedOrder.number}</DialogDescription>
                </div>
                <Button
                  onClick={() => window.print()}
                  className="gap-1.5"
                  size="sm"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </Button>
              </div>
            </DialogHeader>

            <div className="p-4 space-y-6 text-xs text-foreground font-sans">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4 border-border">
                <div>
                  <h2 className="text-base font-bold text-foreground uppercase tracking-tight">
                    {ops.settings.legalName || 'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                  </h2>
                  <p className="text-muted-foreground">{ops.settings.address || 'Kathmandu, Nepal'}</p>
                  <p className="text-muted-foreground font-mono">
                    PAN / VAT Reg: <strong>{ops.settings.pan || '609823415'}</strong>
                  </p>
                  <p className="text-muted-foreground">Contact: {ops.settings.phone || '+977-1-4229988'}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-primary block">TAX INVOICE</span>
                  <div className="font-mono font-bold text-foreground mt-1">
                    {ops.settings.invoicePrefix || 'MEZ-INV-'}
                    {selectedOrder.number.replace(/[^0-9]/g, '')}
                  </div>
                  <div className="text-muted-foreground font-mono">
                    Date: {new Date(selectedOrder.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-muted-foreground uppercase font-semibold">
                    Payment: {selectedOrder.paymentMethod}
                  </div>
                </div>
              </div>

              {/* Billed to */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Billed To Customer:
                  </span>
                  <div className="font-semibold text-foreground">{selectedOrder.customerName}</div>
                  <div className="text-muted-foreground font-mono">{selectedOrder.customerPhone}</div>
                  <div className="text-muted-foreground">{selectedOrder.customerEmail}</div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Delivery Destination:
                  </span>
                  <div className="font-medium text-foreground">{selectedOrder.address}</div>
                  <div className="text-muted-foreground">{selectedOrder.city}</div>
                </div>
              </div>

              {/* Items */}
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Amount (NPR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((i, idx) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-muted-foreground font-mono">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-foreground">{i.name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{i.sku}</TableCell>
                        <TableCell className="text-right font-mono">{formatNPR(i.unitPrice)}</TableCell>
                        <TableCell className="text-center font-semibold">{i.qty}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-foreground">
                          {formatNPR(i.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-between items-start pt-2">
                <div className="max-w-xs space-y-1 text-[11px] text-muted-foreground">
                  <p>Covered under manufacturer genuine warranty.</p>
                  <p>Subject to Kathmandu jurisdiction.</p>
                </div>

                <div className="w-56 space-y-1.5 text-xs text-right">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatNPR(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatNPR(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping:</span>
                    <span className="font-mono">{formatNPR(selectedOrder.deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>VAT ({ops.settings.taxRate}%):</span>
                    <span className="font-mono">{formatNPR(selectedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1.5">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatNPR(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Customer Order</DialogTitle>
            <DialogDescription>Manual booking with live inventory items</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-name">Customer Name *</Label>
                <Input
                  id="cust-name"
                  required
                  value={orderForm.customerName}
                  onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                  placeholder="e.g. Aayush Shrestha"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone Contact *</Label>
                <Input
                  id="cust-phone"
                  required
                  value={orderForm.customerPhone}
                  onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })}
                  placeholder="+977 98..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-addr">Delivery Address *</Label>
                <Input
                  id="cust-addr"
                  required
                  value={orderForm.address}
                  onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                  placeholder="e.g. Jhamsikhel, Ward 3"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-city">City Hub</Label>
                <Input
                  id="cust-city"
                  value={orderForm.city}
                  onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-method">Payment Method</Label>
                <NativeSelect
                  id="pay-method"
                  value={orderForm.paymentMethod}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, paymentMethod: e.target.value as PaymentMethod })
                  }
                >
                  <option value="cod">Cash on Delivery (COD)</option>
                  <option value="esewa">eSewa Mobile Wallet</option>
                  <option value="khalti">Khalti Digital Payment</option>
                  <option value="fonepay">Fonepay Direct QR</option>
                  <option value="connectips">ConnectIPS NCHL</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-email">Customer Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={orderForm.customerEmail}
                  onChange={(e) => setOrderForm({ ...orderForm, customerEmail: e.target.value })}
                  placeholder="customer@domain.np"
                />
              </div>
            </div>

            {/* Add Items to Order */}
            <div className="pt-2 border-t border-border space-y-2">
              <Label htmlFor="cat-item-select">Add Catalog Items</Label>
              <div className="flex items-center gap-2">
                <NativeSelect
                  id="cat-item-select"
                  value={selectedCatalogItem}
                  onChange={(e) => setSelectedCatalogItem(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Select Liquor or Grocery Product...</option>
                  {allCatalogProducts.map((p) => (
                    <option
                      key={`${p.type}::${p.id}::${p.variantId}`}
                      value={`${p.type}::${p.id}::${p.variantId}`}
                    >
                      [{p.type.toUpperCase()}] {p.name} ({p.variantName}) &bull; {formatNPR(p.price)}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddItemToForm}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>

              {orderForm.items.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderForm.items.map((it) => (
                        <TableRow key={`${it.productId}-${it.variantId}`}>
                          <TableCell className="font-medium text-foreground">
                            {it.name} ({it.variantName})
                          </TableCell>
                          <TableCell className="text-center font-semibold">{it.qty}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatNPR(it.unitPrice * it.qty)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setOrderForm((prev) => ({
                                  ...prev,
                                  items: prev.items.filter(
                                    (x) =>
                                      !(x.productId === it.productId && x.variantId === it.variantId)
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order-notes">Order Notes / Instructions</Label>
              <Textarea
                id="order-notes"
                rows={2}
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                placeholder="Gate instructions, landmark, preferred delivery window..."
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Creating...' : 'Book Order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
