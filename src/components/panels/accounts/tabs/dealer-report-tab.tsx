import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import {
  DateRangeFilter,
  useDateFilter,
} from '#/components/shared/date-range-filter'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import {
  DEALER_COST_PRICE_LABEL,
  computeDealerMarginPaisa,
} from '#/lib/dealer-pricing'
import { StatusBadge } from '#/components/shared/status-badge'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import { accountsRouteApi } from '../accounts-route'
import { useVoucherDialog } from '../use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  Store,
  Truck,
} from 'lucide-react'
import type {
  DealerPayableSummary,
  PartyStatementRow,
} from '#/server/finance/finance.queries'

export interface DealerReportTabProps {
  onSettleDealer?: (dealerId: string) => void
  onPayoutDealer?: (dealerId: string) => void
}

export function DealerReportTab({
  onSettleDealer,
  onPayoutDealer,
}: DealerReportTabProps) {
  const routeApi = accountsRouteApi
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const [dealerSearch, setDealerSearch] = useState('')
  const debouncedDealerSearch = useDebouncedValue(dealerSearch, 200)
  const [statusFilter, setStatusFilter] = useState('all')
  const [statementSearch, setStatementSearch] = useState('')

  const {
    data: dealerPayables = [],
    isFetching,
    refetch,
  } = useQuery(adminQueries.dealerPayablesSummary())

  const selectedDealer = useMemo(() => {
    if (search.partyType !== 'dealer' || !search.partyId) return null
    return (
      dealerPayables.find((dealer) => dealer.dealerId === search.partyId) ??
      null
    )
  }, [dealerPayables, search.partyType, search.partyId])

  const openDealer = useCallback(
    (dealerId: string) => {
      navigate({
        to: '/admin/accounts',
        search: (prev) => ({
          ...prev,
          tab: 'dealer-ledger',
          partyType: 'dealer',
          partyId: dealerId,
        }),
      })
    },
    [navigate],
  )

  const closeDealer = () => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({
        ...prev,
        tab: 'dealer-ledger',
        partyType: undefined,
        partyId: undefined,
      }),
    })
  }

  const filteredDealers = useMemo(() => {
    const query = debouncedDealerSearch.trim().toLowerCase()
    return dealerPayables.filter((dealer) => {
      if (query) {
        const matches =
          dealer.dealerName.toLowerCase().includes(query) ||
          (dealer.phone ?? '').toLowerCase().includes(query) ||
          (dealer.city ?? '').toLowerCase().includes(query) ||
          (dealer.pan ?? '').toLowerCase().includes(query)
        if (!matches) return false
      }
      if (statusFilter === 'outstanding' && dealer.outstandingPayable <= 0) {
        return false
      }
      if (statusFilter === 'settled' && dealer.outstandingPayable > 0) {
        return false
      }
      if (statusFilter === 'inactive' && dealer.isActive) return false
      return true
    })
  }, [dealerPayables, debouncedDealerSearch, statusFilter])

  const {
    data: statementRows = [],
    isFetching: isFetchingStatement,
    refetch: refetchStatement,
  } = useQuery({
    ...adminQueries.partyStatement({
      partyType: 'dealer',
      partyId: selectedDealer?.dealerId ?? '__none__',
      fromDate: bounds.start?.toISOString(),
      toDate: bounds.end?.toISOString(),
      limit: 1000,
    }),
    enabled: !!selectedDealer,
    placeholderData: (previous) => previous,
  })

  const { data: dealerDetail } = useQuery({
    ...adminQueries.dealer(selectedDealer?.dealerId ?? '__none__'),
    enabled: !!selectedDealer,
  })

  const totalProcured = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.totalProcured,
    0,
  )
  const totalPaid = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.totalPaid,
    0,
  )
  const totalOutstanding = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.outstandingPayable,
    0,
  )
  const totalCurrent = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.current,
    0,
  )
  const total31To60 = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.days31To60,
    0,
  )
  const total61To90 = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.days61To90,
    0,
  )
  const total90Plus = filteredDealers.reduce(
    (sum, dealer) => sum + dealer.days90Plus,
    0,
  )

  const summaryColumns = useMemo<ColumnDef<DealerPayableSummary>[]>(
    () => [
      {
        accessorKey: 'dealerName',
        header: 'Dealer',
        cell: ({ row }) => (
          <div className="leading-tight">
            <button
              type="button"
              onClick={() => openDealer(row.original.dealerId)}
              className="group inline-flex items-center gap-1 text-left text-xs font-semibold text-primary hover:underline"
            >
              {row.original.dealerName}
              <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <span className="block text-[10px] font-mono text-muted-foreground">
              {row.original.pan ? `PAN ${row.original.pan}` : 'No PAN'}
            </span>
          </div>
        ),
      },
      {
        id: 'location',
        header: 'Location / Contact',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="leading-tight">
            <span className="block text-xs">{row.original.city || '—'}</span>
            <span className="block text-[10px] text-muted-foreground">
              {row.original.phone || 'No phone'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'paymentTermsDays',
        header: 'Terms',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.paymentTermsDays}d
          </span>
        ),
      },
      {
        accessorKey: 'totalProcured',
        header: 'Procured',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.totalProcured}
            className="text-xs font-semibold"
          />
        ),
      },
      {
        accessorKey: 'totalPaid',
        header: 'Paid',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.totalPaid}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          />
        ),
      },
      {
        accessorKey: 'outstandingPayable',
        header: 'Outstanding',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.outstandingPayable}
            className={`text-xs font-bold ${
              row.original.outstandingPayable > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            }`}
          />
        ),
      },
      {
        accessorKey: 'current',
        header: '0–30',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.current}
            className="text-xs text-muted-foreground"
          />
        ),
      },
      {
        accessorKey: 'days31To60',
        header: '31–60',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.days31To60}
            className="text-xs text-amber-600 dark:text-amber-400"
          />
        ),
      },
      {
        accessorKey: 'days61To90',
        header: '61–90',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.days61To90}
            className="text-xs text-orange-600 dark:text-orange-400"
          />
        ),
      },
      {
        accessorKey: 'days90Plus',
        header: '90+',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.days90Plus}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400"
          />
        ),
      },
      {
        accessorKey: 'lastActivityDate',
        header: 'Last Activity',
        cell: ({ row }) =>
          row.original.lastActivityDate ? (
            <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              {csvDate(row.original.lastActivityDate)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openDealer(row.original.dealerId)}
              className="h-7 gap-1 px-2 text-xs"
            >
              <FileText className="h-3 w-3" />
              Statement
            </Button>
            {row.original.outstandingPayable > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPayoutDealer?.(row.original.dealerId)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Banknote className="h-3 w-3" />
                  Pay
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSettleDealer?.(row.original.dealerId)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Truck className="h-3 w-3" />
                  Settle
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    // openDealer and props intentionally included
    [onPayoutDealer, onSettleDealer, openDealer],
  )

  const statementColumns = useMemo<ColumnDef<PartyStatementRow>[]>(
    () => [
      {
        accessorKey: 'voucherNo',
        header: 'Voucher',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openVoucher(row.original.entryId)}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.voucherNo || '—'}
          </button>
        ),
      },
      {
        accessorKey: 'postingDate',
        header: 'Date',
        cell: ({ row }) => (
          <div className="leading-tight whitespace-nowrap">
            <span className="block text-xs">{row.original.bsDate}</span>
            <span className="block text-[10px] font-mono text-muted-foreground">
              {csvDate(row.original.postingDate)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'accountCode',
        header: 'Account',
        cell: ({ row }) => (
          <div className="leading-tight">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: '/admin/accounts',
                  search: (previous) => ({
                    ...previous,
                    tab: 'ledger',
                    account: row.original.accountId,
                    partyType: undefined,
                    partyId: undefined,
                  }),
                })
              }
              className="block font-mono text-xs font-semibold text-primary hover:underline"
            >
              {row.original.accountCode}
            </button>
            <span className="block text-[10px] text-muted-foreground">
              {row.original.accountName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'narration',
        header: 'Narration / Reference',
        cell: ({ row }) => (
          <div className="max-w-[260px] leading-tight">
            <span className="block truncate text-xs">
              {row.original.narration ||
                (row.original.refType
                  ? `${row.original.refType}${
                      row.original.refId
                        ? ` · ${row.original.refId.slice(0, 14)}`
                        : ''
                    }`
                  : '—')}
            </span>
            <Badge variant="outline" className="mt-0.5 font-mono text-[9px]">
              {row.original.voucherType}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'debit',
        header: 'Debit',
        cell: ({ row }) =>
          row.original.debit > 0 ? (
            <MoneyText
              paisa={row.original.debit}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'credit',
        header: 'Credit',
        cell: ({ row }) =>
          row.original.credit > 0 ? (
            <MoneyText
              paisa={row.original.credit}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'runningBalance',
        header: 'Balance',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.runningBalance}
            className={`text-xs font-bold ${
              row.original.runningBalance > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-foreground'
            }`}
          />
        ),
      },
    ],
    [navigate, openVoucher],
  )

  const handleExportDealers = () => {
    exportCsv(
      `dealer-payables-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Dealer', value: (dealer) => dealer.dealerName },
        { header: 'PAN', value: (dealer) => dealer.pan ?? '' },
        { header: 'City', value: (dealer) => dealer.city ?? '' },
        { header: 'Phone', value: (dealer) => dealer.phone ?? '' },
        { header: 'Terms (days)', value: (dealer) => dealer.paymentTermsDays },
        {
          header: 'Credit Limit (NPR)',
          value: (dealer) => csvRupees(dealer.creditLimit),
        },
        {
          header: 'Procured (NPR)',
          value: (dealer) => csvRupees(dealer.totalProcured),
        },
        {
          header: 'Paid (NPR)',
          value: (dealer) => csvRupees(dealer.totalPaid),
        },
        {
          header: 'Outstanding (NPR)',
          value: (dealer) => csvRupees(dealer.outstandingPayable),
        },
        { header: '0-30 (NPR)', value: (dealer) => csvRupees(dealer.current) },
        {
          header: '31-60 (NPR)',
          value: (dealer) => csvRupees(dealer.days31To60),
        },
        {
          header: '61-90 (NPR)',
          value: (dealer) => csvRupees(dealer.days61To90),
        },
        {
          header: '90+ (NPR)',
          value: (dealer) => csvRupees(dealer.days90Plus),
        },
        {
          header: 'Oldest Open',
          value: (dealer) => csvDate(dealer.oldestOpenDate),
        },
        {
          header: 'Last Activity',
          value: (dealer) => csvDate(dealer.lastActivityDate),
        },
      ],
      filteredDealers,
    )
  }

  const handleExportStatement = () => {
    if (!selectedDealer) return
    exportCsv(
      `dealer-statement-${selectedDealer.dealerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Voucher No', value: (row) => row.voucherNo ?? '' },
        { header: 'Type', value: (row) => row.voucherType },
        { header: 'Date (BS)', value: (row) => row.bsDate },
        { header: 'Date (AD)', value: (row) => csvDate(row.postingDate) },
        { header: 'Account', value: (row) => row.accountCode },
        { header: 'Account Name', value: (row) => row.accountName },
        { header: 'Debit (NPR)', value: (row) => csvRupees(row.debit) },
        { header: 'Credit (NPR)', value: (row) => csvRupees(row.credit) },
        {
          header: 'Balance (NPR)',
          value: (row) => csvRupees(row.runningBalance),
        },
        { header: 'Narration', value: (row) => row.narration ?? '' },
      ],
      filteredStatementRows,
    )
  }

  const filteredStatementRows = useMemo(() => {
    const query = statementSearch.trim().toLowerCase()
    if (!query) return statementRows
    return statementRows.filter((row) => {
      return (
        (row.voucherNo ?? '').toLowerCase().includes(query) ||
        row.voucherType.toLowerCase().includes(query) ||
        row.accountCode.toLowerCase().includes(query) ||
        row.accountName.toLowerCase().includes(query) ||
        (row.narration ?? '').toLowerCase().includes(query) ||
        (row.refType ?? '').toLowerCase().includes(query) ||
        (row.refId ?? '').toLowerCase().includes(query)
      )
    })
  }, [statementRows, statementSearch])

  const statementDebit = filteredStatementRows.reduce(
    (sum, row) => sum + row.debit,
    0,
  )
  const statementCredit = filteredStatementRows.reduce(
    (sum, row) => sum + row.credit,
    0,
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Dealers</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {filteredDealers.length}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Total Procured</span>
          <MoneyText
            paisa={totalProcured}
            className="mt-1 block text-lg font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Total Paid</span>
          <MoneyText
            paisa={totalPaid}
            className="mt-1 block text-lg font-bold text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">
            Outstanding Payable
          </span>
          <MoneyText
            paisa={totalOutstanding}
            className={`mt-1 block text-lg font-bold ${
              totalOutstanding > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          />
        </div>
      </div>

      {selectedDealer ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={closeDealer}
                className="h-8 gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to dealers
              </Button>
              <span className="text-muted-foreground">·</span>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {selectedDealer.dealerName}
                </span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {selectedDealer.pan ? `PAN ${selectedDealer.pan}` : 'No PAN'}
                </span>
                <span className="ml-2">
                  <StatusBadge
                    value={selectedDealer.isActive ? 'active' : 'inactive'}
                  />
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
                size="sm"
                showSteppers
                showDualDate={false}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchStatement()}
                disabled={isFetchingStatement}
                className="h-8 gap-1 text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isFetchingStatement ? 'animate-spin' : ''
                  }`}
                />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportStatement}
                disabled={filteredStatementRows.length === 0}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              {selectedDealer.outstandingPayable > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPayoutDealer?.(selectedDealer.dealerId)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Direct payout
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSettleDealer?.(selectedDealer.dealerId)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Settle items
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Procured
              </span>
              <MoneyText
                paisa={selectedDealer.totalProcured}
                className="block text-sm font-bold"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Paid
              </span>
              <MoneyText
                paisa={selectedDealer.totalPaid}
                className="block text-sm font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Outstanding
              </span>
              <MoneyText
                paisa={selectedDealer.outstandingPayable}
                className="block text-sm font-bold text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                0–30 days
              </span>
              <MoneyText
                paisa={selectedDealer.current}
                className="block text-sm font-bold"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                31–60 days
              </span>
              <MoneyText
                paisa={selectedDealer.days31To60}
                className="block text-sm font-bold text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                61–90 days
              </span>
              <MoneyText
                paisa={selectedDealer.days61To90}
                className="block text-sm font-bold text-orange-600 dark:text-orange-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                90+ days
              </span>
              <MoneyText
                paisa={selectedDealer.days90Plus}
                className="block text-sm font-bold text-rose-600 dark:text-rose-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Credit limit
              </span>
              <MoneyText
                paisa={selectedDealer.creditLimit}
                className="block text-sm font-bold text-muted-foreground"
              />
            </div>
          </div>

          {dealerDetail && dealerDetail.assignedItems.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    Catalog Sourcing — Cost &amp; MRP
                  </span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {dealerDetail.assignedItems.length} item
                    {dealerDetail.assignedItems.length === 1 ? '' : 's'} ·
                    negotiated dealer cost vs. catalog MRP
                  </span>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto click-scroll">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Catalog Item
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        {DEALER_COST_PRICE_LABEL}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        MRP
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dealerDetail.assignedItems.map((item) => {
                      const cost = item.costPrice ?? 0
                      const mrp = item.mrp ?? null
                      const margin = computeDealerMarginPaisa(mrp, cost)
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-1.5">
                            <span className="block font-medium text-foreground">
                              {item.productName}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {item.catalogType.toUpperCase()} ·{' '}
                              {item.categoryName || 'General'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {cost > 0 ? (
                              <MoneyText
                                paisa={cost}
                                className="text-xs font-semibold"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {mrp != null && mrp > 0 ? (
                              <MoneyText
                                paisa={mrp}
                                className="text-xs text-muted-foreground"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {margin != null ? (
                              <MoneyText
                                paisa={margin}
                                className={`text-xs font-semibold ${
                                  margin >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DataTable
            columns={statementColumns}
            data={filteredStatementRows}
            searchValue={statementSearch}
            onSearchChange={setStatementSearch}
            searchPlaceholder="Search voucher, account, narration or reference…"
            isLoading={isFetchingStatement && statementRows.length === 0}
            emptyMessage="No dealer ledger entries match the current filters."
            dense
            onRowClick={(row) => openVoucher(row.entryId)}
            initialSorting={[{ id: 'postingDate', desc: true }]}
            footerSlot={
              filteredStatementRows.length > 0 ? (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={4} className="px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      {filteredStatementRows.length} line
                      {filteredStatementRows.length === 1 ? '' : 's'} ·
                      per-account running balance
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={statementDebit}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={statementCredit}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={
                        filteredStatementRows[filteredStatementRows.length - 1]
                          ?.runningBalance ?? 0
                      }
                      className="text-xs font-bold text-amber-600 dark:text-amber-400"
                    />
                  </TableCell>
                </TableRow>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={summaryColumns}
            data={filteredDealers}
            searchValue={dealerSearch}
            onSearchChange={setDealerSearch}
            searchPlaceholder="Search dealer name, PAN, phone or city…"
            filterSlot={
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect
                  size="sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="all">
                    All Dealers
                  </NativeSelectOption>
                  <NativeSelectOption value="outstanding">
                    Outstanding only
                  </NativeSelectOption>
                  <NativeSelectOption value="settled">
                    Fully settled
                  </NativeSelectOption>
                  <NativeSelectOption value="inactive">
                    Inactive
                  </NativeSelectOption>
                </NativeSelect>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                >
                  <Link to="/admin/dealers">
                    <Store className="h-3.5 w-3.5" />
                    Dealers directory
                  </Link>
                </Button>
              </div>
            }
            actionSlot={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDealers}
                  disabled={filteredDealers.length === 0}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      isFetching ? 'animate-spin' : ''
                    }`}
                  />
                  Refresh
                </Button>
              </>
            }
            isLoading={isFetching && dealerPayables.length === 0}
            emptyMessage="No dealers match the selected filters."
            dense
            onRowClick={(dealer) => openDealer(dealer.dealerId)}
            initialSorting={[
              { id: 'outstandingPayable', desc: true },
              { id: 'dealerName', desc: false },
            ]}
            footerSlot={
              filteredDealers.length > 0 ? (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={3} className="px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      {filteredDealers.length} dealer
                      {filteredDealers.length === 1 ? '' : 's'}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={totalProcured}
                      className="text-xs font-bold"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={totalPaid}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={totalOutstanding}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText paisa={totalCurrent} className="text-xs" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={total31To60}
                      className="text-xs text-amber-600 dark:text-amber-400"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={total61To90}
                      className="text-xs text-orange-600 dark:text-orange-400"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <MoneyText
                      paisa={total90Plus}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400"
                    />
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              ) : null
            }
          />

          {filteredDealers.length === 0 && (
            <div className="text-center text-xs text-muted-foreground">
              Use the filters above to widen the dealer list.
            </div>
          )}
        </>
      )}

      {voucherDialog}
    </div>
  )
}
