import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  updateOrderFn,
  createOrderFn,
} from '#/server/operations/operations.functions'
import type { Order, OrderStatus, PaymentMethod } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import { StatusBadge } from '#/components/admin/status-badge'
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
  ClipboardList,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  CheckCircle2,
  Bike,
  Printer,
  X,
  CreditCard,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Receipt,
  FileText,
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
            variantName: v.sizeVolume,
          })
        }
      }
    }
    for (const g of grocery) {
      list.push({
        id: g.id,
        type: 'grocery',
        name: g.name,
        sku: g.sku,
        price: g.price,
        variantId: g.id,
        variantName: g.weightVolume || 'Standard',
      })
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
    <div className={pageClass}>
      <PageHeader
        kicker="Commerce"
        title="Order Management"
        description="Monitor lifecycle transitions, assign Kathmandu Valley fleet couriers, and generate government-compliant VAT invoices."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCSV} className={btnSecondary}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" onClick={() => setIsCreateOpen(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Create Order
            </button>
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
          tone={pendingCount > 0 ? 'warning' : 'default'}
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
      <div className={`${cardClass} p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3`}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order #, customer, phone, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            {ORDER_STATUSES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className={tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className={thClass}>Order # & Date</th>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Items</th>
                <th className={thClass}>Total (NPR)</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Payment</th>
                <th className={thClass}>Assigned Rider</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const assignedRider = ops.riders.find((r) => r.id === order.riderId)
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <span className="font-mono font-bold text-slate-900 block">
                          {order.number}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <div className="font-semibold text-slate-900">{order.customerName}</div>
                        <div className="text-xs text-slate-400 font-mono">{order.customerPhone}</div>
                      </td>

                      <td className={tdClass}>
                        <span className="font-medium text-slate-700">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </span>
                        <div className="text-xs text-slate-400 truncate max-w-[160px]">
                          {order.items.map((i) => i.name).join(', ')}
                        </div>
                      </td>

                      <td className={tdClass}>
                        <span className="font-bold text-slate-900 font-mono">
                          {formatNPR(order.total)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <StatusBadge status={order.status} />
                      </td>

                      <td className={tdClass}>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {order.paymentMethod}
                        </span>
                      </td>

                      <td className={tdClass}>
                        {assignedRider ? (
                          <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                            <Bike className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span>{assignedRider.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className={`${tdClass} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order)
                              setIsInvoiceOpen(true)
                            }}
                            className={btnGhost}
                            title="Print Tax Invoice"
                          >
                            <Receipt className="h-4 w-4 text-slate-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className={btnSecondary}
                            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Drawer/Modal */}
      {selectedOrder && !isInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Order {selectedOrder.number}
                </h3>
                <p className="text-xs text-slate-500">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-sm">
              {/* Status and Action Buttons */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Status:</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value as OrderStatus)}
                    disabled={isUpdating}
                    className="text-xs py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  >
                    {ORDER_STATUSES.filter((s) => s.value !== 'all').map((s) => (
                      <option key={s.value} value={s.value}>
                        Set {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Courier assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Customer Details
                  </span>
                  <div className="font-semibold text-slate-900">{selectedOrder.customerName}</div>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {selectedOrder.customerPhone}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-400" />
                    {selectedOrder.customerEmail}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {selectedOrder.address}, {selectedOrder.city}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Fleet Dispatch
                  </span>
                  <div>
                    <label className={labelClass}>Assigned Courier</label>
                    <select
                      value={selectedOrder.riderId || ''}
                      onChange={(e) => handleAssignRider(selectedOrder.id, e.target.value)}
                      disabled={isUpdating}
                      className={selectClass}
                    >
                      <option value="">No Rider Assigned</option>
                      {ops.riders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.zone} &bull; {r.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-slate-500">
                    Payment Mode: <strong className="uppercase text-slate-800">{selectedOrder.paymentMethod}</strong>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          <span className="block text-[10px] text-slate-400">{item.variantName}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">{item.sku}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-700">{item.qty}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNPR(item.unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatNPR(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Price Calculation Summary */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1.5 text-xs text-right max-w-xs ml-auto">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatNPR(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatNPR(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charge:</span>
                  <span className="font-mono">{formatNPR(selectedOrder.deliveryCharge)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VAT ({ops.settings.taxRate}%):</span>
                  <span className="font-mono">{formatNPR(selectedOrder.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-600">{formatNPR(selectedOrder.total)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsInvoiceOpen(true)}
                className={btnSecondary}
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className={btnPrimary}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Nepal VAT Tax Invoice Modal */}
      {isInvoiceOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="font-bold text-sm text-slate-800">
                Tax Invoice Preview &bull; {selectedOrder.number}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={btnPrimary}
                >
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsInvoiceOpen(false)}
                  className={btnSecondary}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-800 font-sans">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4 border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 uppercase">
                    {ops.settings.legalName || 'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                  </h2>
                  <p className="text-slate-500">{ops.settings.address || 'Kathmandu, Nepal'}</p>
                  <p className="text-slate-500 font-mono">
                    PAN / VAT Reg: <strong>{ops.settings.pan || '609823415'}</strong>
                  </p>
                  <p className="text-slate-500">Contact: {ops.settings.phone || '+977-1-4229988'}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-600 block">TAX INVOICE</span>
                  <div className="font-mono font-bold text-slate-900 mt-1">
                    {ops.settings.invoicePrefix || 'MEZ-INV-'}
                    {selectedOrder.number.replace(/[^0-9]/g, '')}
                  </div>
                  <div className="text-slate-500">
                    Date: {new Date(selectedOrder.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-slate-500 uppercase font-semibold">
                    Payment: {selectedOrder.paymentMethod}
                  </div>
                </div>
              </div>

              {/* Billed to */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Billed To Customer:
                  </span>
                  <div className="font-bold text-slate-900">{selectedOrder.customerName}</div>
                  <div className="text-slate-600">{selectedOrder.customerPhone}</div>
                  <div className="text-slate-600">{selectedOrder.customerEmail}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Delivery Destination:
                  </span>
                  <div className="font-medium text-slate-800">{selectedOrder.address}</div>
                  <div className="text-slate-600">{selectedOrder.city}</div>
                </div>
              </div>

              {/* Items */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Amount (NPR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((i, idx) => (
                      <tr key={i.id}>
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{i.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{i.sku}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNPR(i.unitPrice)}</td>
                        <td className="py-2 px-3 text-center font-bold">{i.qty}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">{formatNPR(i.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-between items-start pt-2">
                <div className="max-w-xs space-y-1 text-[11px] text-slate-500">
                  <p>Covered under manufacturer genuine warranty.</p>
                  <p>Subject to Kathmandu jurisdiction.</p>
                </div>

                <div className="w-56 space-y-1.5 text-xs text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatNPR(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatNPR(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping:</span>
                    <span className="font-mono">{formatNPR(selectedOrder.deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({ops.settings.taxRate}%):</span>
                    <span className="font-mono">{formatNPR(selectedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                    <span>Grand Total:</span>
                    <span className="font-mono text-blue-600">{formatNPR(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create New Customer Order</h3>
                <p className="text-xs text-slate-500">Manual booking with live inventory items</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.customerName}
                    onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                    placeholder="e.g. Aayush Shrestha"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone Contact *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.customerPhone}
                    onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })}
                    placeholder="+977 98..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Delivery Address *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.address}
                    onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                    placeholder="e.g. Jhamsikhel, Ward 3"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>City Hub</label>
                  <input
                    type="text"
                    value={orderForm.city}
                    onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Payment Method</label>
                  <select
                    value={orderForm.paymentMethod}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, paymentMethod: e.target.value as PaymentMethod })
                    }
                    className={selectClass}
                  >
                    <option value="cod">Cash on Delivery (COD)</option>
                    <option value="esewa">eSewa Mobile Wallet</option>
                    <option value="khalti">Khalti Digital Payment</option>
                    <option value="fonepay">Fonepay Direct QR</option>
                    <option value="connectips">ConnectIPS NCHL</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Customer Email</label>
                  <input
                    type="email"
                    value={orderForm.customerEmail}
                    onChange={(e) => setOrderForm({ ...orderForm, customerEmail: e.target.value })}
                    placeholder="customer@domain.np"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Add Items to Order */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className={labelClass}>Add Catalog Items</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCatalogItem}
                    onChange={(e) => setSelectedCatalogItem(e.target.value)}
                    className={selectClass}
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
                  </select>
                  <button
                    type="button"
                    onClick={handleAddItemToForm}
                    className={btnSecondary}
                    style={{ height: '40px' }}
                  >
                    Add
                  </button>
                </div>

                {orderForm.items.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Price</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orderForm.items.map((it) => (
                          <tr key={`${it.productId}-${it.variantId}`}>
                            <td className="py-1.5 px-3 font-medium text-slate-800">
                              {it.name} ({it.variantName})
                            </td>
                            <td className="py-1.5 px-3 text-center">{it.qty}</td>
                            <td className="py-1.5 px-3 text-right font-mono font-semibold">
                              {formatNPR(it.unitPrice * it.qty)}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setOrderForm((prev) => ({
                                    ...prev,
                                    items: prev.items.filter(
                                      (x) =>
                                        !(x.productId === it.productId && x.variantId === it.variantId)
                                    ),
                                  }))
                                }
                                className="text-rose-500 hover:text-rose-700 font-semibold"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Order Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Gate instructions, landmark, preferred delivery window..."
                  className={inputClass}
                  style={{ height: 'auto', padding: '8px' }}
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isUpdating} className={btnPrimary}>
                  {isUpdating ? 'Creating...' : 'Book Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
