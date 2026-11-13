import { useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import {
  DateRangeFilter,
  useDateFilter,
} from '#/components/shared/date-range-filter'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import { StatusBadge } from '#/components/shared/status-badge'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import { useVoucherDialog } from '../use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  Download,
  ExternalLink,
  Receipt,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { Order } from '#/server/operations/types'
import type { DetailedJournalEntry } from '#/server/finance/finance.queries'

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Payment Methods' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'online', label: 'Online / Wallet' },
]

const ORDER_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rider_assigned', label: 'Rider Assigned' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
]

export function SalesAccountTab() {
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const orders = ledgerData.ops.orders
  const journalEntries = ledgerData.ops.journalEntries

  const salesVoucherByOrderId = useMemo(() => {
    const map = new Map<string, DetailedJournalEntry>()
    for (const entry of journalEntries) {
      if (entry.refType === 'order' && entry.refId) {
        map.set(entry.refId, entry)
      }
    }
    return map
  }, [journalEntries])

  const filteredOrders = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return orders.filter((order) => {
      if (query) {
        const matches =
          order.number.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.customerPhone.toLowerCase().includes(query) ||
          order.city.toLowerCase().includes(query)
        if (!matches) return false
      }
      if (paymentFilter !== 'all') {
        const isCod = order.paymentMethod === 'cod'
        if (paymentFilter === 'cod' && !isCod) return false
        if (paymentFilter === 'online' && isCod) return false
      }
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      const date = new Date(order.createdAt)
      if (bounds.start && date < bounds.start) return false
      if (bounds.end && date > bounds.end) return false
      return true
    })
  }, [
    orders,
    debouncedSearch,
    paymentFilter,
    statusFilter,
    bounds.start,
    bounds.end,
  ])

  const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0)
  const totalCOD = filteredOrders.reduce(
    (sum, order) => (order.paymentMethod === 'cod' ? sum + order.total : sum),
    0,
  )
  const totalOnline = totalSales - totalCOD
  const totalDelivery = filteredOrders.reduce(
    (sum, order) => sum + order.deliveryCharge,
    0,
  )
  const totalDiscount = filteredOrders.reduce(
    (sum, order) => sum + order.discount,
    0,
  )

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Order No',
        cell: ({ row }) => (
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary hover:underline"
            title="Open the orders workspace"
          >
            {row.original.number}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            {csvDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="leading-tight">
            <span className="block text-xs font-medium">
              {row.original.customerName}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {row.original.customerPhone || 'No phone'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'city',
        header: 'City',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.city || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Payment',
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.paymentMethod === 'cod' ? 'warning' : 'secondary'
            }
            className="text-[10px] font-semibold uppercase"
          >
            {row.original.paymentMethod === 'cod'
              ? 'COD'
              : row.original.paymentMethod}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge value={row.original.status} />,
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.total}
            className="text-xs font-bold text-foreground"
          />
        ),
      },
      {
        accessorKey: 'deliveryCharge',
        header: 'Delivery',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.deliveryCharge}
            className="text-xs text-muted-foreground"
          />
        ),
      },
      {
        accessorKey: 'discount',
        header: 'Discount',
        cell: ({ row }) =>
          row.original.discount > 0 ? (
            <MoneyText
              paisa={row.original.discount}
              className="text-xs text-amber-600 dark:text-amber-400"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'voucher',
        header: 'Sales Voucher',
        enableSorting: false,
        cell: ({ row }) => {
          const entry = salesVoucherByOrderId.get(row.original.id)
          if (!entry) {
            return <span className="text-xs text-muted-foreground">—</span>
          }
          return (
            <button
              type="button"
              onClick={() => openVoucher(entry.id)}
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary hover:underline"
            >
              <Receipt className="h-3 w-3" />
              {entry.voucherNo}
            </button>
          )
        },
      },
    ],
    [openVoucher, salesVoucherByOrderId],
  )

  const handleExport = () => {
    exportCsv(
      `sales-account-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Order No', value: (order) => order.number },
        { header: 'Date', value: (order) => csvDate(order.createdAt) },
        { header: 'Customer', value: (order) => order.customerName },
        { header: 'Phone', value: (order) => order.customerPhone },
        { header: 'City', value: (order) => order.city },
        { header: 'Payment Method', value: (order) => order.paymentMethod },
        { header: 'Status', value: (order) => order.status },
        {
          header: 'Subtotal (NPR)',
          value: (order) => csvRupees(order.subtotal),
        },
        {
          header: 'Delivery (NPR)',
          value: (order) => csvRupees(order.deliveryCharge),
        },
        {
          header: 'Discount (NPR)',
          value: (order) => csvRupees(order.discount),
        },
        { header: 'VAT (NPR)', value: (order) => csvRupees(order.tax) },
        { header: 'Total (NPR)', value: (order) => csvRupees(order.total) },
        {
          header: 'Sales Voucher',
          value: (order) =>
            salesVoucherByOrderId.get(order.id)?.voucherNo ?? '',
        },
      ],
      filteredOrders,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Sales</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <MoneyText
            paisa={totalSales}
            className="mt-1 block text-lg font-bold text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              COD Collections
            </span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <MoneyText
            paisa={totalCOD}
            className="mt-1 block text-lg font-bold text-amber-600 dark:text-amber-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Online Payments
            </span>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </div>
          <MoneyText
            paisa={totalOnline}
            className="mt-1 block text-lg font-bold text-blue-600 dark:text-blue-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Delivery / Discount
            </span>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <MoneyText paisa={totalDelivery} className="text-lg font-bold" />
            <MoneyText
              paisa={totalDiscount}
              className="text-xs text-amber-600 dark:text-amber-400"
            />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredOrders}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search order number, customer, phone or city…"
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              size="sm"
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              className="h-8 text-xs"
            >
              {PAYMENT_METHODS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              size="sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 text-xs"
            >
              {ORDER_STATUSES.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              size="sm"
              showSteppers
              showDualDate={false}
            />
          </div>
        }
        actionSlot={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('')
                setPaymentFilter('all')
                setStatusFilter('all')
                setDateFilter({ preset: 'today' })
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredOrders.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </>
        }
        emptyMessage="No sales orders found for the selected filters."
        dense
        onRowClick={(order) => {
          const entry = salesVoucherByOrderId.get(order.id)
          if (entry) openVoucher(entry.id)
        }}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        footerSlot={
          filteredOrders.length > 0 ? (
            <TableRow className="border-border hover:bg-transparent">
              <TableCell colSpan={6} className="px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {filteredOrders.length} order
                  {filteredOrders.length === 1 ? '' : 's'}
                </span>
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalSales}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                />
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalDelivery}
                  className="text-xs font-bold text-muted-foreground"
                />
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalDiscount}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400"
                />
              </TableCell>
              <TableCell />
            </TableRow>
          ) : null
        }
      />

      {salesVoucherByOrderId.size === 0 && (
        <p className="text-xs text-muted-foreground">
          Sales vouchers (SV) appear here once an order is marked delivered and
          the posting engine creates the accounting entry.
        </p>
      )}

      {voucherDialog}
    </div>
  )
}
