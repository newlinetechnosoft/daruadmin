import { useState, useMemo } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import {
  updateOrderFn,
  createOrderFn,
  assignOrderItemDealerFn,
  autoAssignNearestDealersForOrderFn,
  removeOrderItemFn,
} from '#/server/operations/operations.functions'
import type {
  Order,
  OrderStatus,
  PaymentMethod,
} from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { getGoogleMapsUrl } from '#/lib/map-config'
import {
  calculateHaversineDistanceKm,
  formatDistanceKm,
  getDealerWhatsAppConfirmationUrl,
} from '#/lib/geo'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { StatusBadge } from '#/components/shared/status-badge'
import { StatusIndicator } from '#/components/shared/status-indicator'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
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
  Store,
  MessageCircle,
  Sparkles,
  Check,
  CheckCheck,
  X,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

const routeApi = getRouteApi('/admin/orders')

const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'dealer_assigned', label: 'Dealer Assigned' },
  { value: 'rider_assigned', label: 'Rider Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delivery_failed', label: 'Delivery Failed' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function OrdersPanel() {
  const { ops, liquor, grocery, dealers } = routeApi.useLoaderData()
  const dealersList = dealers
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [invoiceMode, setInvoiceMode] = useState<'a4' | 'thermal'>('a4')
  const [isUpdating, setIsUpdating] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [removeItemTarget, setRemoveItemTarget] = useState<{
    orderId: string
    orderItemId: string
    itemName: string
  } | null>(null)
  const [removeItemReason, setRemoveItemReason] = useState('')

  // Create order form state
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    city: 'Butwal',
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
      dealerId?: string
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
      if (p.variants.length > 0) {
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
      if (g.variants.length > 0) {
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

  // Status counts for interactive filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ops.orders.length }
    for (const o of ops.orders) {
      counts[o.status] = (counts[o.status] || 0) + 1
    }
    return counts
  }, [ops.orders])

  // KPIs
  const totalOrdersCount = ops.orders.length
  const pendingCount = ops.orders.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed',
  ).length
  const outForDeliveryCount = ops.orders.filter(
    (o) =>
      o.status === 'out_for_delivery' ||
      o.status === 'rider_assigned' ||
      o.status === 'picked_up',
  ).length
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
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update order status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAssignRider = async (orderId: string, riderId: string) => {
    try {
      setIsUpdating(true)
      const targetStatus = riderId
        ? ['pending', 'confirmed', 'dealer_assigned'].includes(
            selectedOrder?.status || '',
          )
          ? 'rider_assigned'
          : undefined
        : selectedOrder?.status === 'rider_assigned'
          ? 'confirmed'
          : undefined

      await updateOrderFn({
        data: {
          id: orderId,
          riderId: riderId || null,
          ...(targetStatus ? { status: targetStatus } : {}),
        },
      })
      const riderName = ops.riders.find((r) => r.id === riderId)?.name || 'None'
      toast.success(
        riderId ? `Assigned to rider: ${riderName}` : 'Courier unassigned',
      )
      await router.invalidate()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          riderId: riderId || null,
          ...(targetStatus ? { status: targetStatus as OrderStatus } : {}),
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign rider')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAssignItemDealer = async (
    orderId: string,
    orderItemId: string,
    dealerId: string,
  ) => {
    try {
      setIsUpdating(true)
      await assignOrderItemDealerFn({
        data: {
          orderId,
          orderItemId,
          dealerId: dealerId || null,
        },
      })
      const foundDealer = dealersList.find((d: any) => d.id === dealerId)
      toast.success(
        dealerId
          ? `Assigned item to ${foundDealer?.name || 'dealer'}`
          : 'Dealer unassigned from item',
      )
      await router.invalidate()
      if (selectedOrder && selectedOrder.id === orderId) {
        const updatedItems = selectedOrder.items.map((it) =>
          it.id === orderItemId
            ? {
                ...it,
                dealerId: dealerId || null,
                dealer: foundDealer
                  ? {
                      id: foundDealer.id,
                      name: foundDealer.name,
                      contact: foundDealer.contact,
                      whatsappNumber: foundDealer.whatsappNumber,
                      address: foundDealer.address,
                      city: foundDealer.city,
                      lat: foundDealer.lat ? Number(foundDealer.lat) : null,
                      lng: foundDealer.lng ? Number(foundDealer.lng) : null,
                    }
                  : null,
              }
            : it,
        )

        let targetStatus: OrderStatus = selectedOrder.status
        const allItemsSourced = updatedItems.every((it) => Boolean(it.dealerId))
        if (allItemsSourced && selectedOrder.status === 'confirmed') {
          try {
            await updateOrderFn({
              data: { id: orderId, status: 'dealer_assigned' },
            })
            targetStatus = 'dealer_assigned'
            toast.success(
              'All items sourced: Order advanced to Dealer Assigned',
            )
          } catch {
            // Ignore if already transitioned
          }
        }

        setSelectedOrder({
          ...selectedOrder,
          status: targetStatus,
          items: updatedItems,
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update item dealer')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAutoAssignNearestDealers = async (orderId: string) => {
    try {
      setIsUpdating(true)
      const res = await autoAssignNearestDealersForOrderFn({
        data: { orderId },
      })
      toast.success(
        `Auto-assigned closest available dealers to ${res.updatedCount} items`,
      )
      await router.invalidate()

      if (
        selectedOrder &&
        selectedOrder.id === orderId &&
        selectedOrder.status === 'confirmed'
      ) {
        try {
          await updateOrderFn({
            data: { id: orderId, status: 'dealer_assigned' },
          })
          setSelectedOrder({
            ...selectedOrder,
            status: 'dealer_assigned',
          })
          toast.success(
            'Nearest dealers assigned: Order advanced to Dealer Assigned',
          )
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to auto-assign dealers')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkDelivered = async (orderId: string) => {
    try {
      setIsUpdating(true)
      await updateOrderFn({
        data: {
          id: orderId,
          status: 'delivered',
          ageVerifiedAtDelivery: true,
        },
      })
      toast.success('Order marked as delivered and settled')
      await router.invalidate()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: 'delivered',
          paymentStatus:
            selectedOrder.paymentMethod === 'cod'
              ? 'paid'
              : selectedOrder.paymentStatus,
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark order delivered')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleConfirmCancelOrder = async () => {
    if (!selectedOrder) return
    if (!cancelReason.trim()) {
      toast.error('Please specify a cancellation reason')
      return
    }
    try {
      setIsUpdating(true)
      await updateOrderFn({
        data: {
          id: selectedOrder.id,
          status: 'cancelled',
          cancellationReason: cancelReason.trim(),
        },
      })
      toast.success('Order cancelled')
      setCancelDialogOpen(false)
      setCancelReason('')
      await router.invalidate()
      setSelectedOrder({
        ...selectedOrder,
        status: 'cancelled',
        cancellationReason: cancelReason.trim(),
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel order')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleConfirmRemoveItem = async () => {
    if (!removeItemTarget || !removeItemReason.trim()) return

    try {
      setIsUpdating(true)
      await removeOrderItemFn({
        data: {
          orderId: removeItemTarget.orderId,
          orderItemId: removeItemTarget.orderItemId,
          reason: removeItemReason.trim(),
        },
      })
      toast.success(
        `Removed "${removeItemTarget.itemName}" and recalculated order totals`,
      )
      setRemoveItemTarget(null)
      setRemoveItemReason('')
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove item')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddItemToForm = () => {
    if (!selectedCatalogItem) return
    const [type, prodId, varId] = selectedCatalogItem.split('::')
    const item = allCatalogProducts.find(
      (p) => p.type === type && p.id === prodId && p.variantId === varId,
    )
    if (!item) return

    setOrderForm((prev) => {
      const exists = prev.items.find(
        (i) => i.productId === prodId && i.variantId === varId,
      )
      if (exists) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === prodId && i.variantId === varId
              ? { ...i, qty: i.qty + 1 }
              : i,
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
    if (
      !orderForm.customerName ||
      !orderForm.address ||
      orderForm.items.length === 0
    ) {
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
            name: i.name,
            variantName: i.variantName,
            sku: i.sku,
            qty: i.qty,
            unitPrice: i.unitPrice,
            dealerId: i.dealerId || null,
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
        city: 'Butwal',
        paymentMethod: 'cod',
        notes: '',
        items: [],
      })
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create order')
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
          `"${o.number}","${o.customerName}","${o.customerPhone}","${o.city}","${o.status}","${o.paymentMethod}",${o.subtotal},${o.deliveryCharge},${o.tax},${o.total},"${o.createdAt}"`,
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
        description="Monitor lifecycle transitions, assign Butwal & Tilottama fleet couriers, and generate government-compliant VAT invoices or thermal dispatch slips."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="gap-2"
            >
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

      {/* Quick Status Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ORDER_STATUSES.map((st) => {
          const count = statusCounts[st.value] || 0
          const isActive = statusFilter === st.value
          return (
            <button
              key={st.value}
              type="button"
              onClick={() => setStatusFilter(st.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
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
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-muted-foreground text-sm"
                  >
                    No orders match your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const assignedRider = ops.riders.find(
                    (r) => r.id === order.riderId,
                  )
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
                        <div className="font-medium text-foreground">
                          {order.customerName}
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-xs">
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-mono"
                            title={`Call ${order.customerPhone}`}
                          >
                            <Phone className="h-3 w-3" />
                            <span>{order.customerPhone}</span>
                          </a>
                          {order.customerPhone && (
                            <a
                              href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Namaste ${order.customerName}, this is regarding your order ${order.number} from Mezmani.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                              title="WhatsApp Customer"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          )}
                          <a
                            href={getGoogleMapsUrl(order)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                            title={`${order.address}, ${order.city}`}
                          >
                            <MapPin className="h-3 w-3 text-amber-500" />
                          </a>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-foreground">
                          {order.items.length}{' '}
                          {order.items.length === 1 ? 'item' : 'items'}
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
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] uppercase"
                        >
                          {order.paymentMethod}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {assignedRider ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span>{assignedRider.name}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                              <span>
                                Float: {formatNPR(assignedRider.cashOnHand)}
                              </span>
                              {assignedRider.cashOnHand >= 2000000 && (
                                <span
                                  className="text-destructive font-semibold"
                                  title="COD cash limit exceeded (Rs. 20,000)"
                                >
                                  ⚠️ Limit
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic block">
                            No Courier
                          </span>
                        )}
                        {(() => {
                          const assignedCount = order.items.filter(
                            (it) => it.dealerId,
                          ).length
                          const totalCount = order.items.length
                          if (totalCount === 0) return null
                          if (assignedCount === totalCount) {
                            return (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                                <Store className="h-3 w-3 shrink-0" />
                                <span>
                                  {assignedCount === 1
                                    ? 'Dealer Assigned'
                                    : `${assignedCount} Dealers`}
                                </span>
                              </div>
                            )
                          }
                          return (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                              <Store className="h-3 w-3 shrink-0" />
                              <span>
                                {assignedCount}/{totalCount} Dealers
                              </span>
                            </div>
                          )
                        })()}
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
          <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle>Order {selectedOrder.number}</DialogTitle>
              <DialogDescription>
                Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 text-xs click-scroll">
              {/* Automated Lifecycle Status & Primary Operational Actions */}
              <div className="p-4 rounded-lg border border-border bg-card shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground font-medium text-xs">
                      Lifecycle Stage:
                    </span>
                    <StatusIndicator status={selectedOrder.status} asBadge />
                  </div>

                  {/* Contextual Automated Action based on stage */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedOrder.status === 'pending' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          handleUpdateStatus(selectedOrder.id, 'confirmed')
                        }
                        disabled={isUpdating}
                        className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        <Check className="size-3.5" />
                        Confirm Order
                      </Button>
                    )}

                    {[
                      'picked_up',
                      'out_for_delivery',
                      'rider_assigned',
                    ].includes(selectedOrder.status) && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleMarkDelivered(selectedOrder.id)}
                        disabled={isUpdating}
                        className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        <CheckCheck className="size-3.5" />
                        Mark as Delivered
                      </Button>
                    )}

                    {!['delivered', 'cancelled', 'returned'].includes(
                      selectedOrder.status,
                    ) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelDialogOpen(true)}
                        disabled={isUpdating}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      >
                        <X className="size-3.5 mr-1" />
                        Cancel Order
                      </Button>
                    )}
                  </div>
                </div>

                {/* Visual Progress Stepper */}
                {selectedOrder.status === 'cancelled' ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-destructive text-[11px] flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      <strong>Order Cancelled:</strong>{' '}
                      {selectedOrder.cancellationReason ||
                        'Customer or manager cancelled this order.'}
                    </span>
                  </div>
                ) : selectedOrder.status === 'delivery_failed' ? (
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-400 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      <strong>Delivery Attempt Failed:</strong>{' '}
                      {selectedOrder.deliveryFailureReason ||
                        'Customer unreachable / rescheduled.'}
                    </span>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-border/60">
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      {[
                        { key: 'placed', label: '1. Placed', done: true },
                        {
                          key: 'confirmed',
                          label: '2. Confirmed',
                          done: [
                            'confirmed',
                            'dealer_assigned',
                            'rider_assigned',
                            'picked_up',
                            'out_for_delivery',
                            'delivered',
                          ].includes(selectedOrder.status),
                        },
                        {
                          key: 'dispatched',
                          label: '3. Dispatched',
                          done: [
                            'dealer_assigned',
                            'rider_assigned',
                            'picked_up',
                            'out_for_delivery',
                            'delivered',
                          ].includes(selectedOrder.status),
                        },
                        {
                          key: 'delivered',
                          label: '4. Delivered',
                          done: selectedOrder.status === 'delivered',
                        },
                      ].map((step) => (
                        <div
                          key={step.key}
                          className={cn(
                            'rounded-md py-1.5 px-2 border text-[11px] font-medium transition-colors',
                            step.done
                              ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                              : 'border-border bg-muted/20 text-muted-foreground',
                          )}
                        >
                          {step.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Customer & Courier dispatch details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-3.5 space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Customer Details
                    </span>
                    <div className="font-semibold text-foreground">
                      {selectedOrder.customerName}
                    </div>
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
                      <a
                        href={getGoogleMapsUrl(selectedOrder)}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline hover:text-foreground transition-colors"
                      >
                        {selectedOrder.address}, {selectedOrder.city}
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Fleet Dispatch
                      </span>
                      {(() => {
                        const oLat = selectedOrder.lat
                          ? Number(selectedOrder.lat)
                          : 27.7006
                        const oLng = selectedOrder.lng
                          ? Number(selectedOrder.lng)
                          : 83.4484
                        const isCod =
                          selectedOrder.paymentMethod === 'cod' &&
                          selectedOrder.paymentStatus !== 'paid'

                        const ranked = [...ops.riders]
                          .map((r) => {
                            const dist =
                              r.lat != null && r.lng != null
                                ? calculateHaversineDistanceKm(
                                    oLat,
                                    oLng,
                                    Number(r.lat),
                                    Number(r.lng),
                                  )
                                : null
                            const isOver = isCod && r.cashOnHand >= 2000000
                            let score = 100
                            if (r.status === 'available') score += 100
                            else if (r.status === 'busy') score -= 50
                            else score -= 100
                            if (dist != null) score -= Math.round(dist * 5)
                            if (isOver) score -= 1000
                            return { ...r, distanceKm: dist, isOver, score }
                          })
                          .sort((a, b) => b.score - a.score)

                        const best = ranked.find(
                          (r) => !r.isOver && r.status === 'available',
                        )
                        if (best && selectedOrder.riderId !== best.id) {
                          return (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-primary border-primary/30 hover:bg-primary/5"
                              onClick={() =>
                                handleAssignRider(selectedOrder.id, best.id)
                              }
                              disabled={isUpdating}
                            >
                              ⭐ Auto-Assign: {best.name.split(' ')[0]} (
                              {formatDistanceKm(best.distanceKm)})
                            </Button>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="courier-select" className="text-xs">
                        Assigned Courier
                      </Label>
                      {(() => {
                        const oLat = selectedOrder.lat
                          ? Number(selectedOrder.lat)
                          : 27.7006
                        const oLng = selectedOrder.lng
                          ? Number(selectedOrder.lng)
                          : 83.4484
                        const isCod =
                          selectedOrder.paymentMethod === 'cod' &&
                          selectedOrder.paymentStatus !== 'paid'

                        const ranked = [...ops.riders]
                          .map((r) => {
                            const dist =
                              r.lat != null && r.lng != null
                                ? calculateHaversineDistanceKm(
                                    oLat,
                                    oLng,
                                    Number(r.lat),
                                    Number(r.lng),
                                  )
                                : null
                            const isOver = isCod && r.cashOnHand >= 2000000
                            let score = 100
                            if (r.status === 'available') score += 100
                            else if (r.status === 'busy') score -= 50
                            else score -= 100
                            if (dist != null) score -= Math.round(dist * 5)
                            if (isOver) score -= 1000
                            return { ...r, distanceKm: dist, isOver, score }
                          })
                          .sort((a, b) => b.score - a.score)

                        const recommended = ranked.filter(
                          (r) => !r.isOver && r.status === 'available',
                        )
                        const others = ranked.filter(
                          (r) => r.isOver || r.status !== 'available',
                        )

                        return (
                          <NativeSelect
                            id="courier-select"
                            value={selectedOrder.riderId || ''}
                            onChange={(e) =>
                              handleAssignRider(
                                selectedOrder.id,
                                e.target.value,
                              )
                            }
                            disabled={isUpdating}
                            className="text-xs"
                          >
                            <option value="">No Rider Assigned</option>
                            {recommended.length > 0 && (
                              <optgroup label="⭐ Recommended & Available (Proximity Sorted)">
                                {recommended.map((r, idx) => (
                                  <option key={r.id} value={r.id}>
                                    {idx === 0 ? '⭐ [BEST] ' : ''}
                                    {r.name} ({r.zone} •{' '}
                                    {formatDistanceKm(r.distanceKm)}) — Float:{' '}
                                    {formatNPR(r.cashOnHand)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {others.length > 0 && (
                              <optgroup label="Other Couriers (Busy / Offline / High Float)">
                                {others.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.zone} • {r.status} •{' '}
                                    {formatDistanceKm(r.distanceKm)}) — Float:{' '}
                                    {formatNPR(r.cashOnHand)}{' '}
                                    {r.isOver ? '⚠️ COD LIMIT' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </NativeSelect>
                        )
                      })()}
                      {(() => {
                        const r = ops.riders.find(
                          (x) => x.id === selectedOrder.riderId,
                        )
                        if (!r) return null
                        if (r.cashOnHand >= 2000000) {
                          return (
                            <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium flex items-center gap-1.5 mt-1.5">
                              <span>⚠️</span>
                              <span>
                                Courier holds{' '}
                                <strong>{formatNPR(r.cashOnHand)}</strong>{' '}
                                unremitted COD float (exceeds Rs. 20,000
                                threshold).
                              </span>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <div className="text-muted-foreground pt-1">
                      Payment Mode:{' '}
                      <strong className="uppercase text-foreground font-mono">
                        {selectedOrder.paymentMethod}
                      </strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Items List with per-item Dealer Assignment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Ordered Items & Sourcing Stations
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      Assign nearest verified dealers to each order line
                    </p>
                  </div>
                  {selectedOrder.items.some(
                    (it) => !it.dealerId || it.sourcingStatus === 'unavailable',
                  ) &&
                    ['pending', 'confirmed'].includes(selectedOrder.status) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() =>
                          handleAutoAssignNearestDealers(selectedOrder.id)
                        }
                        disabled={isUpdating}
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Auto-Assign Nearest Dealers</span>
                      </Button>
                    )}
                </div>

                <div className="rounded-lg border border-border overflow-hidden shadow-xs">
                  <div className="w-full overflow-x-auto click-scroll">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">
                            Unit Price
                          </TableHead>
                          <TableHead className="w-[280px]">
                            Assigned Dealer (Pickup)
                          </TableHead>
                          <TableHead className="text-right">
                            Cost / Margin
                          </TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          {['pending', 'confirmed', 'dealer_assigned'].includes(
                            selectedOrder.status,
                          ) &&
                            selectedOrder.items.length > 1 && (
                              <TableHead className="w-[40px]"></TableHead>
                            )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items.map((item) => {
                          const totalCost =
                            (item.dealerCostPrice || 0) * item.qty
                          const profit = item.lineTotal - totalCost
                          const marginPct =
                            item.lineTotal > 0
                              ? ((profit / item.lineTotal) * 100).toFixed(1)
                              : '0.0'

                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-foreground">
                                    {item.name}
                                  </span>
                                  {item.sourcingStatus && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1 py-0 uppercase font-mono ${
                                        item.sourcingStatus === 'picked_up'
                                          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                                          : item.sourcingStatus ===
                                              'unavailable'
                                            ? 'border-destructive/30 text-destructive bg-destructive/10'
                                            : item.sourcingStatus === 'assigned'
                                              ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                                              : 'border-muted-foreground/30 text-muted-foreground'
                                      }`}
                                    >
                                      {item.sourcingStatus.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>
                                <span className="block text-[11px] text-muted-foreground">
                                  {item.variantName}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-muted-foreground">
                                {item.sku}
                              </TableCell>
                              <TableCell className="text-center font-semibold text-foreground">
                                {item.qty}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatNPR(item.unitPrice)}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <NativeSelect
                                    value={item.dealerId || ''}
                                    onChange={(e) =>
                                      handleAssignItemDealer(
                                        selectedOrder.id,
                                        item.id,
                                        e.target.value,
                                      )
                                    }
                                    disabled={isUpdating}
                                    className="text-xs h-8"
                                  >
                                    <option value="">
                                      -- No Dealer Assigned --
                                    </option>
                                    {item.availableDealers &&
                                      item.availableDealers.length > 0 && (
                                        <optgroup label="⭐ Registered Suppliers (Nearest First)">
                                          {item.availableDealers.map((d) => (
                                            <option key={d.id} value={d.id}>
                                              ⭐ {d.name} (
                                              {d.distanceKm != null
                                                ? `${d.distanceKm} km`
                                                : d.city}
                                              ) · Cost:{' '}
                                              {formatNPR(d.costPrice || 0)}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    <optgroup label="Other Active Dealers">
                                      {dealersList
                                        .filter(
                                          (d: any) =>
                                            d.isActive &&
                                            !item.availableDealers?.some(
                                              (ad) => ad.id === d.id,
                                            ),
                                        )
                                        .map((d: any) => (
                                          <option key={d.id} value={d.id}>
                                            {d.name} ({d.city})
                                          </option>
                                        ))}
                                    </optgroup>
                                  </NativeSelect>

                                  {item.dealer ? (
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                                      <a
                                        href={`tel:${item.dealer.contact}`}
                                        className="flex items-center gap-0.5 text-primary hover:underline font-mono"
                                        title="Call dealer"
                                      >
                                        <Phone className="h-3 w-3" />
                                        <span>{item.dealer.contact}</span>
                                      </a>
                                      {(item.dealer.whatsappNumber ||
                                        item.dealer.contact) && (
                                        <a
                                          href={getDealerWhatsAppConfirmationUrl(
                                            {
                                              dealerName: item.dealer.name,
                                              dealerPhone:
                                                item.dealer.whatsappNumber ||
                                                item.dealer.contact,
                                              orderNumber: selectedOrder.number,
                                              items: [
                                                {
                                                  name: item.name,
                                                  qty: item.qty,
                                                  variantName: item.variantName,
                                                },
                                              ],
                                              pickupAddress:
                                                item.dealer.address,
                                            },
                                          )}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 hover:underline"
                                          title="Send WhatsApp confirmation to dealer"
                                        >
                                          <MessageCircle className="h-3 w-3" />
                                          <span>WhatsApp</span>
                                        </a>
                                      )}
                                      <a
                                        href={
                                          item.dealer.lat && item.dealer.lng
                                            ? `https://www.google.com/maps/search/?api=1&query=${item.dealer.lat},${item.dealer.lng}`
                                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.dealer.name}, ${item.dealer.address}, ${item.dealer.city}`)}`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 hover:underline"
                                        title="Dealer Map Location"
                                      >
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate max-w-[90px]">
                                          {item.dealer.address}
                                        </span>
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block">
                                      ⚠️ Needs dealer for rider pickup
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {item.dealerCostPrice ? (
                                  <div className="space-y-0.5">
                                    <div className="text-muted-foreground text-[11px]">
                                      {formatNPR(totalCost)}
                                    </div>
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      +{formatNPR(profit)} ({marginPct}%)
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">
                                    Pending
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-foreground">
                                {formatNPR(item.lineTotal)}
                              </TableCell>
                              {[
                                'pending',
                                'confirmed',
                                'dealer_assigned',
                              ].includes(selectedOrder.status) &&
                                selectedOrder.items.length > 1 && (
                                  <TableCell className="text-center p-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                                      title={`Remove "${item.name}" from order`}
                                      onClick={() => {
                                        setRemoveItemTarget({
                                          orderId: selectedOrder.id,
                                          orderItemId: item.id,
                                          itemName: item.name,
                                        })
                                        setRemoveItemReason('')
                                      }}
                                      disabled={isUpdating}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Dealer Fulfillment & Pickup Stations Summary */}
              <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Store className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Dealer Pickup Stations (Rider Route)
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        Rider collects items from these stations before
                        delivering to customer
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      selectedOrder.items.every((it) => it.dealerId)
                        ? 'secondary'
                        : 'outline'
                    }
                    className="text-[10px]"
                  >
                    {selectedOrder.items.filter((it) => it.dealerId).length} /{' '}
                    {selectedOrder.items.length} Items Assigned
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Group items by dealer */}
                  {Array.from(
                    selectedOrder.items
                      .reduce((map, item) => {
                        if (item.dealer) {
                          const existing = map.get(item.dealer.id) || {
                            dealer: item.dealer,
                            items: [],
                          }
                          existing.items.push(item)
                          map.set(item.dealer.id, existing)
                        }
                        return map
                      }, new Map<string, { dealer: any; items: typeof selectedOrder.items }>())
                      .values(),
                  ).map(({ dealer, items }) => (
                    <div
                      key={dealer.id}
                      className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground flex items-center gap-1">
                            <Store className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="truncate">{dealer.name}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {dealer.address}, {dealer.city}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-6 px-1.5 text-[10px]"
                          >
                            <a href={`tel:${dealer.contact}`}>
                              <Phone className="h-2.5 w-2.5 mr-0.5 text-primary" />
                              Call
                            </a>
                          </Button>
                          {(dealer.whatsappNumber || dealer.contact) && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-6 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              <a
                                href={`https://wa.me/${(dealer.whatsappNumber || dealer.contact).replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="h-2.5 w-2.5 mr-0.5" />
                                WA
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-6 px-1.5 text-[10px] text-amber-600 dark:text-amber-400"
                          >
                            <a
                              href={
                                dealer.lat && dealer.lng
                                  ? `https://www.google.com/maps/search/?api=1&query=${dealer.lat},${dealer.lng}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dealer.name}, ${dealer.address}, ${dealer.city}`)}`
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MapPin className="h-2.5 w-2.5 mr-0.5" />
                              Map
                            </a>
                          </Button>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        <strong>Items:</strong>{' '}
                        {items.map((it) => `${it.qty}x ${it.name}`).join(', ')}
                      </div>
                    </div>
                  ))}

                  {selectedOrder.items.some((it) => !it.dealerId) && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1 text-xs">
                      <div className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                        <span>⚠️ Unassigned Items</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedOrder.items
                          .filter((it) => !it.dealerId)
                          .map((it) => `${it.qty}x ${it.name}`)
                          .join(', ')}
                      </div>
                      <p className="text-[10px] text-amber-700 dark:text-amber-300">
                        Assign dealers in the items table so rider has complete
                        pickup instructions.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Lifecycle History & Audit Trail */}
              <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold text-foreground">
                      Order Lifecycle History & Audit Trail
                    </h4>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {selectedOrder.events?.length ?? 0} events recorded
                  </span>
                </div>

                <div className="space-y-2 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                  {selectedOrder.events && selectedOrder.events.length > 0 ? (
                    selectedOrder.events.map((evt) => (
                      <div
                        key={evt.id}
                        className="relative pl-6 text-xs space-y-0.5"
                      >
                        <div className="absolute left-2 top-1.5 h-2 w-2 rounded-full border border-background bg-primary -translate-x-1/2" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground font-mono uppercase text-[11px]">
                            {evt.toStatus || evt.status}
                          </span>
                          {evt.fromStatus && (
                            <span className="text-[10px] text-muted-foreground">
                              (from {evt.fromStatus})
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            &bull; {new Date(evt.at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {evt.note}
                        </p>
                        <div className="text-[10px] text-muted-foreground/80">
                          By:{' '}
                          <span className="font-medium text-foreground">
                            {evt.actor}
                          </span>{' '}
                          {evt.actorRole && (
                            <span className="capitalize">
                              ({evt.actorRole})
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-xs pl-6">
                      No state transition history logged.
                    </p>
                  )}
                </div>
              </div>

              {/* Price Calculation & Margin Analysis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl ml-auto">
                {(() => {
                  let totalDealerCost = 0
                  for (const it of selectedOrder.items) {
                    if (it.dealerCostPrice) {
                      totalDealerCost += it.dealerCostPrice * it.qty
                    }
                  }
                  const netRevenue = Math.max(
                    0,
                    selectedOrder.subtotal - selectedOrder.discount,
                  )
                  const grossProfit = netRevenue - totalDealerCost
                  const marginPct =
                    netRevenue > 0
                      ? ((grossProfit / netRevenue) * 100).toFixed(1)
                      : '0.0'

                  return (
                    <div className="rounded-lg border border-border bg-emerald-500/5 p-3 space-y-1.5 text-xs text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-left flex items-center justify-between pb-1 border-b border-border/50">
                        <span>Sourcing Margin</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {marginPct}% Margin
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Dealer Cost (COGS):</span>
                        <span className="font-mono">
                          {formatNPR(totalDealerCost)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Gross Profit:</span>
                        <span className="font-mono">
                          {formatNPR(grossProfit)}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-xs text-right">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-mono">
                      {formatNPR(selectedOrder.subtotal)}
                    </span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount:</span>
                      <span className="font-mono">
                        -{formatNPR(selectedOrder.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Charge:</span>
                    <span className="font-mono">
                      {formatNPR(selectedOrder.deliveryCharge)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>VAT ({ops.settings.taxRate}%):</span>
                    <span className="font-mono">
                      {formatNPR(selectedOrder.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1.5">
                    <span>Grand Total:</span>
                    <span className="font-mono">
                      {formatNPR(selectedOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInvoiceOpen(true)}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </Button>
              <Button size="sm" onClick={() => setSelectedOrder(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
            <DialogTitle className="text-sm font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-4 shrink-0" />
              Cancel Order #{selectedOrder?.number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please specify a reason for cancellation. This will be permanently
              recorded in the order history.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 sm:p-6 space-y-3">
            <Label htmlFor="cancel-reason" className="text-xs font-medium">
              Cancellation Reason *
            </Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="e.g. Customer cancelled, out of stock, incorrect address..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCancelDialogOpen(false)
                setCancelReason('')
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancelOrder}
              disabled={isUpdating || !cancelReason.trim()}
            >
              {isUpdating ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Order Line Item Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(removeItemTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveItemTarget(null)
            setRemoveItemReason('')
          }
        }}
        title={`Remove "${removeItemTarget?.itemName}" from Order?`}
        description="Please provide a reason for removing this line item. Line item removal recalculates the subtotal, taxes, and dealer payouts."
        confirmLabel="Remove Item"
        tone="destructive"
        disabled={!removeItemReason.trim()}
        isLoading={isUpdating}
        icon={<Trash2 className="size-4 text-destructive" />}
        onConfirm={handleConfirmRemoveItem}
      >
        <div className="space-y-1.5 pt-2">
          <Label htmlFor="remove-item-reason" className="text-xs font-medium">
            Reason for removal *
          </Label>
          <Input
            id="remove-item-reason"
            placeholder="e.g. Out of stock at dealer, customer requested modification"
            value={removeItemReason}
            onChange={(e) => setRemoveItemReason(e.target.value)}
            className="text-xs"
          />
        </div>
      </ConfirmDialog>

      {/* Printable Nepal VAT Tax Invoice Dialog */}
      <Dialog
        open={Boolean(isInvoiceOpen && selectedOrder)}
        onOpenChange={(open) => !open && setIsInvoiceOpen(false)}
      >
        {selectedOrder && (
          <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
            <DialogHeader className="no-print border-b border-border p-4 sm:p-6 pb-3 shrink-0 bg-muted/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <DialogTitle>
                    {invoiceMode === 'a4'
                      ? 'Tax Invoice Preview'
                      : '80mm POS Thermal Slip'}
                  </DialogTitle>
                  <DialogDescription className="font-mono">
                    Order {selectedOrder.number} &bull;{' '}
                    {selectedOrder.customerName}
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setInvoiceMode('a4')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        invoiceMode === 'a4'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      A4 VAT Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceMode('thermal')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        invoiceMode === 'thermal'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      80mm Thermal Slip
                    </button>
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
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 click-scroll">
              {invoiceMode === 'thermal' ? (
                <div className="p-4 flex justify-center bg-muted/20">
                  <div className="w-[80mm] max-w-full bg-card text-foreground border border-dashed border-border p-4 rounded shadow-sm text-xs font-mono space-y-3 leading-relaxed">
                    {/* Store Header */}
                    <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-border">
                      <div className="font-bold text-sm tracking-tight">
                        {ops.settings.legalName || 'MEZMANI LIQUOR & GROCERY'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ops.settings.address || 'Traffic Chowk, Butwal, Nepal'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        PAN / VAT:{' '}
                        <strong>{ops.settings.pan || '609823415'}</strong>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Tel: {ops.settings.phone || '+977-71-540000'}
                      </div>
                    </div>

                    {/* Slip Meta */}
                    <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Slip Type:
                        </span>
                        <strong className="uppercase">
                          Rider Dispatch Slip
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order #:</span>
                        <strong className="font-bold">
                          {selectedOrder.number}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span>
                          {new Date(selectedOrder.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment:</span>
                        <strong className="uppercase">
                          {selectedOrder.paymentMethod}
                        </strong>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-border">
                      <div className="font-bold uppercase text-[10px] text-muted-foreground">
                        Deliver To Customer:
                      </div>
                      <div className="font-bold text-sm text-foreground">
                        {selectedOrder.customerName}
                      </div>
                      <div className="font-bold">
                        Phone: {selectedOrder.customerPhone}
                      </div>
                      <div>
                        Address: {selectedOrder.address}, {selectedOrder.city}
                      </div>
                      {selectedOrder.notes && (
                        <div className="text-[10px] italic text-muted-foreground pt-0.5">
                          Note: &ldquo;{selectedOrder.notes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Dealer Pickup Checklist */}
                    <div className="space-y-2 pb-2 border-b border-dashed border-border">
                      <div className="font-bold uppercase text-[10px] text-muted-foreground">
                        Dealer Pickups (Rider Route):
                      </div>
                      {(() => {
                        const dealerGroups = new Map<
                          string,
                          {
                            name: string
                            phone?: string
                            address?: string
                            items: typeof selectedOrder.items
                          }
                        >()
                        for (const it of selectedOrder.items) {
                          const dKey = it.dealerId || 'unassigned'
                          const dName =
                            it.dealer?.name ||
                            (it.dealerId
                              ? 'Assigned Dealer'
                              : '⚠️ Sourcing Required')
                          const existing = dealerGroups.get(dKey) || {
                            name: dName,
                            phone: it.dealer?.contact,
                            address: it.dealer?.address,
                            items: [],
                          }
                          existing.items.push(it)
                          dealerGroups.set(dKey, existing)
                        }
                        return Array.from(dealerGroups.entries()).map(
                          ([key, group], idx) => (
                            <div
                              key={key}
                              className="bg-muted/40 p-2 rounded border border-border/50 text-[11px] space-y-1"
                            >
                              <div className="font-bold flex items-center justify-between">
                                <span>
                                  #{idx + 1} {group.name}
                                </span>
                                {group.phone && (
                                  <span className="text-[10px] font-normal">
                                    {group.phone}
                                  </span>
                                )}
                              </div>
                              {group.address && (
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {group.address}
                                </div>
                              )}
                              <div className="pl-1 pt-0.5 space-y-0.5">
                                {group.items.map((it) => (
                                  <div
                                    key={it.id}
                                    className="flex justify-between items-center text-[11px]"
                                  >
                                    <span>
                                      [ ] {it.qty}x {it.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {it.variantName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ),
                        )
                      })()}
                    </div>

                    {/* Items List */}
                    <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-border">
                      <div className="font-bold uppercase text-[10px] text-muted-foreground">
                        Ordered Items:
                      </div>
                      {selectedOrder.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex justify-between items-start"
                        >
                          <div className="pr-2">
                            <div>
                              {it.qty}x {it.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {it.variantName}
                            </div>
                          </div>
                          <div className="font-mono text-right whitespace-nowrap">
                            {formatNPR(it.lineTotal)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Financial Breakdown */}
                    <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.subtotal)}
                        </span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount:</span>
                          <span className="font-mono">
                            -{formatNPR(selectedOrder.discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery:</span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.deliveryCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          VAT ({ops.settings.taxRate}%):
                        </span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.tax)}
                        </span>
                      </div>
                    </div>

                    {/* Big Callout: Cash to Collect / Paid Online */}
                    {selectedOrder.paymentMethod === 'cod' ? (
                      <div className="border-2 border-foreground p-2 rounded text-center my-2 space-y-0.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          CASH TO COLLECT (COD)
                        </div>
                        <div className="text-lg font-bold font-mono">
                          {formatNPR(selectedOrder.total)}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-2 rounded text-center my-2 space-y-0.5 font-bold">
                        <div className="text-[10px] uppercase tracking-wider">
                          PREPAID ORDER (
                          {selectedOrder.paymentMethod.toUpperCase()})
                        </div>
                        <div className="text-xs">
                          DO NOT COLLECT CASH FROM CUSTOMER
                        </div>
                      </div>
                    )}

                    {/* Rider Assignment & Footer */}
                    <div className="text-center pt-1 text-[10px] text-muted-foreground space-y-1">
                      <div>
                        Assigned Rider:{' '}
                        <strong className="text-foreground">
                          {ops.riders.find(
                            (r) => r.id === selectedOrder.riderId,
                          )?.name || 'Unassigned'}
                        </strong>
                      </div>
                      <div>Quality & Genuine Warranty Guaranteed</div>
                      <div>Thank you for choosing Mezmani!</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-6 text-xs text-foreground font-sans">
                  {/* Header */}
                  <div className="flex items-start justify-between border-b pb-4 border-border">
                    <div>
                      <h2 className="text-base font-bold text-foreground uppercase tracking-tight">
                        {ops.settings.legalName ||
                          'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                      </h2>
                      <p className="text-muted-foreground">
                        {ops.settings.address || 'Traffic Chowk, Butwal, Nepal'}
                      </p>
                      <p className="text-muted-foreground font-mono">
                        PAN / VAT Reg:{' '}
                        <strong>{ops.settings.pan || '609823415'}</strong>
                      </p>
                      <p className="text-muted-foreground">
                        Contact: {ops.settings.phone || '+977-71-540000'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-primary block">
                        TAX INVOICE
                      </span>
                      <div className="font-mono font-bold text-foreground mt-1">
                        {ops.settings.invoicePrefix || 'MEZ-INV-'}
                        {selectedOrder.number.replace(/[^0-9]/g, '')}
                      </div>
                      <div className="text-muted-foreground font-mono">
                        Date:{' '}
                        {new Date(selectedOrder.createdAt).toLocaleDateString()}
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
                      <div className="font-semibold text-foreground">
                        {selectedOrder.customerName}
                      </div>
                      <div className="text-muted-foreground font-mono">
                        {selectedOrder.customerPhone}
                      </div>
                      <div className="text-muted-foreground">
                        {selectedOrder.customerEmail}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Delivery Destination:
                      </span>
                      <div className="font-medium text-foreground">
                        {selectedOrder.address}
                      </div>
                      <div className="text-muted-foreground">
                        {selectedOrder.city}
                      </div>
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
                          <TableHead className="text-right">
                            Amount (NPR)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items.map((i, idx) => (
                          <TableRow key={i.id}>
                            <TableCell className="text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {i.name}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {i.sku}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatNPR(i.unitPrice)}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {i.qty}
                            </TableCell>
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
                      <p>Subject to Butwal jurisdiction.</p>
                    </div>

                    <div className="w-56 space-y-1.5 text-xs text-right">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal:</span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.subtotal)}
                        </span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-success">
                          <span>Discount:</span>
                          <span className="font-mono">
                            -{formatNPR(selectedOrder.discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-muted-foreground">
                        <span>Shipping:</span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.deliveryCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>VAT ({ops.settings.taxRate}%):</span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.tax)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1.5">
                        <span>Grand Total:</span>
                        <span className="font-mono">
                          {formatNPR(selectedOrder.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
            <DialogTitle>Create New Customer Order</DialogTitle>
            <DialogDescription>
              Manual booking with live inventory items
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateOrder}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 text-xs click-scroll">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-name">Customer Name *</Label>
                  <Input
                    id="cust-name"
                    required
                    value={orderForm.customerName}
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        customerName: e.target.value,
                      })
                    }
                    placeholder="e.g. Aayush Shrestha"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-phone">Phone Contact *</Label>
                  <Input
                    id="cust-phone"
                    required
                    value={orderForm.customerPhone}
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        customerPhone: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, address: e.target.value })
                    }
                    placeholder="e.g. Jhamsikhel, Ward 3"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-city">City Hub</Label>
                  <Input
                    id="cust-city"
                    value={orderForm.city}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, city: e.target.value })
                    }
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
                      setOrderForm({
                        ...orderForm,
                        paymentMethod: e.target.value as PaymentMethod,
                      })
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
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        customerEmail: e.target.value,
                      })
                    }
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
                    <option value="">
                      Select Liquor or Grocery Product...
                    </option>
                    {allCatalogProducts.map((p) => (
                      <option
                        key={`${p.type}::${p.id}::${p.variantId}`}
                        value={`${p.type}::${p.id}::${p.variantId}`}
                      >
                        [{p.type.toUpperCase()}] {p.name} ({p.variantName})
                        &bull; {formatNPR(p.price)}
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
                    <div className="w-full overflow-x-auto click-scroll">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-[180px]">Dealer</TableHead>
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
                              <TableCell>
                                <NativeSelect
                                  value={it.dealerId || ''}
                                  onChange={(e) =>
                                    setOrderForm((prev) => ({
                                      ...prev,
                                      items: prev.items.map((x) =>
                                        x.productId === it.productId &&
                                        x.variantId === it.variantId
                                          ? { ...x, dealerId: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                  className="text-xs h-7"
                                >
                                  <option value="">No Dealer</option>
                                  {dealersList
                                    .filter((d: any) => d.isActive)
                                    .map((d: any) => (
                                      <option key={d.id} value={d.id}>
                                        {d.name} ({d.city})
                                      </option>
                                    ))}
                                </NativeSelect>
                              </TableCell>
                              <TableCell className="text-center font-semibold">
                                {it.qty}
                              </TableCell>
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
                                          !(
                                            x.productId === it.productId &&
                                            x.variantId === it.variantId
                                          ),
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
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="order-notes">Order Notes / Instructions</Label>
                <Textarea
                  id="order-notes"
                  rows={2}
                  value={orderForm.notes}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, notes: e.target.value })
                  }
                  placeholder="Gate instructions, landmark, preferred delivery window..."
                />
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
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
