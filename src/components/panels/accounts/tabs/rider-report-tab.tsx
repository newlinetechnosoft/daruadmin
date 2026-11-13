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
  ChevronRight,
  Coins,
  Download,
  FileText,
  RefreshCw,
  Truck,
  Wallet,
} from 'lucide-react'
import type {
  PartyStatementRow,
  RiderAccountSummary,
} from '#/server/finance/finance.queries'

export interface RiderReportTabProps {
  onRecordCashHandover?: (
    riderId: string,
    riderName: string,
    cashOnHand: number,
  ) => void
}

export function RiderReportTab({ onRecordCashHandover }: RiderReportTabProps) {
  const routeApi = accountsRouteApi
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const [riderSearch, setRiderSearch] = useState('')
  const debouncedRiderSearch = useDebouncedValue(riderSearch, 200)
  const [statusFilter, setStatusFilter] = useState('all')
  const [statementSearch, setStatementSearch] = useState('')

  const {
    data: riderAccounts = [],
    isFetching,
    refetch,
  } = useQuery(adminQueries.riderAccountsSummary())

  const selectedRider = useMemo(() => {
    if (search.partyType !== 'rider' || !search.partyId) return null
    return (
      riderAccounts.find((rider) => rider.riderId === search.partyId) ?? null
    )
  }, [riderAccounts, search.partyType, search.partyId])

  const openRider = useCallback(
    (riderId: string) => {
      navigate({
        to: '/admin/accounts',
        search: (prev) => ({
          ...prev,
          tab: 'rider-ledger',
          partyType: 'rider',
          partyId: riderId,
        }),
      })
    },
    [navigate],
  )

  const closeRider = () => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({
        ...prev,
        tab: 'rider-ledger',
        partyType: undefined,
        partyId: undefined,
      }),
    })
  }

  const filteredRiders = useMemo(() => {
    const query = debouncedRiderSearch.trim().toLowerCase()
    return riderAccounts.filter((rider) => {
      if (query) {
        const matches =
          rider.riderName.toLowerCase().includes(query) ||
          (rider.phone ?? '').toLowerCase().includes(query) ||
          rider.zone.toLowerCase().includes(query)
        if (!matches) return false
      }
      if (statusFilter === 'outstanding' && rider.commissionPayable <= 0) {
        return false
      }
      if (statusFilter === 'settled' && rider.commissionPayable > 0) {
        return false
      }
      if (statusFilter === 'has-cod' && rider.undepositedCodCash <= 0) {
        return false
      }
      if (statusFilter === 'advances' && rider.outstandingAdvances <= 0) {
        return false
      }
      return true
    })
  }, [riderAccounts, debouncedRiderSearch, statusFilter])

  const {
    data: statementRows = [],
    isFetching: isFetchingStatement,
    refetch: refetchStatement,
  } = useQuery({
    ...adminQueries.partyStatement({
      partyType: 'rider',
      partyId: selectedRider?.riderId ?? '__none__',
      fromDate: bounds.start?.toISOString(),
      toDate: bounds.end?.toISOString(),
      limit: 1000,
    }),
    enabled: !!selectedRider,
    placeholderData: (previous) => previous,
  })

  const totalCashOnHand = filteredRiders.reduce(
    (sum, rider) => sum + rider.cashOnHand,
    0,
  )
  const totalUndeposited = filteredRiders.reduce(
    (sum, rider) => sum + rider.undepositedCodCash,
    0,
  )
  const totalCommissionPayable = filteredRiders.reduce(
    (sum, rider) => sum + rider.commissionPayable,
    0,
  )
  const totalAdvances = filteredRiders.reduce(
    (sum, rider) => sum + rider.outstandingAdvances,
    0,
  )

  const summaryColumns = useMemo<ColumnDef<RiderAccountSummary>[]>(
    () => [
      {
        accessorKey: 'riderName',
        header: 'Rider',
        cell: ({ row }) => (
          <div className="leading-tight">
            <button
              type="button"
              onClick={() => openRider(row.original.riderId)}
              className="group inline-flex items-center gap-1 text-left text-xs font-semibold text-primary hover:underline"
            >
              {row.original.riderName}
              <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <span className="block text-[10px] text-muted-foreground">
              {row.original.phone || 'No phone'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'zone',
        header: 'Zone',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.zone}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge value={row.original.status} />,
      },
      {
        accessorKey: 'cashOnHand',
        header: 'Cash in Hand',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.cashOnHand}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400"
          />
        ),
      },
      {
        accessorKey: 'undepositedCodCash',
        header: 'Undeposited COD',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            {row.original.undepositedCodCash > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            <MoneyText
              paisa={row.original.undepositedCodCash}
              className={`text-xs font-semibold ${
                row.original.undepositedCodCash > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
              }`}
            />
          </div>
        ),
      },
      {
        accessorKey: 'commissionPayable',
        header: 'Commission Payable',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.commissionPayable}
            className={`text-xs font-semibold ${
              row.original.commissionPayable > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            }`}
          />
        ),
      },
      {
        accessorKey: 'outstandingAdvances',
        header: 'Advances',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.outstandingAdvances}
            className={`text-xs font-semibold ${
              row.original.outstandingAdvances > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground'
            }`}
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
              onClick={() => openRider(row.original.riderId)}
              className="h-7 gap-1 px-2 text-xs"
            >
              <FileText className="h-3 w-3" />
              Statement
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onRecordCashHandover?.(
                  row.original.riderId,
                  row.original.riderName,
                  row.original.cashOnHand,
                )
              }
              className="h-7 gap-1 px-2 text-xs"
            >
              <Wallet className="h-3 w-3" />
              Receive
            </Button>
          </div>
        ),
      },
    ],
    [onRecordCashHandover, openRider],
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
        cell: ({ row }) => {
          const isCod =
            row.original.accountCode === '1031' ||
            row.original.accountName.toLowerCase().includes('cod')
          return (
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
                className={`block font-mono text-xs font-semibold hover:underline ${
                  isCod ? 'text-amber-600 dark:text-amber-400' : 'text-primary'
                }`}
              >
                {row.original.accountCode}
              </button>
              <span className="block text-[10px] text-muted-foreground">
                {row.original.accountName}
              </span>
            </div>
          )
        },
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
              row.original.runningBalance < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-foreground'
            }`}
          />
        ),
      },
    ],
    [navigate, openVoucher],
  )

  const handleExportRiders = () => {
    exportCsv(
      `rider-accounts-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Rider', value: (rider) => rider.riderName },
        { header: 'Phone', value: (rider) => rider.phone ?? '' },
        { header: 'Zone', value: (rider) => rider.zone },
        { header: 'Status', value: (rider) => rider.status },
        {
          header: 'Cash in Hand (NPR)',
          value: (rider) => csvRupees(rider.cashOnHand),
        },
        {
          header: 'Undeposited COD (NPR)',
          value: (rider) => csvRupees(rider.undepositedCodCash),
        },
        {
          header: 'Commission Payable (NPR)',
          value: (rider) => csvRupees(rider.commissionPayable),
        },
        {
          header: 'Outstanding Advances (NPR)',
          value: (rider) => csvRupees(rider.outstandingAdvances),
        },
        {
          header: 'Last Activity',
          value: (rider) => csvDate(rider.lastActivityDate),
        },
      ],
      filteredRiders,
    )
  }

  const handleExportStatement = () => {
    if (!selectedRider) return
    exportCsv(
      `rider-statement-${selectedRider.riderName
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Riders</span>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {filteredRiders.length}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cash in Hand</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <MoneyText
            paisa={totalCashOnHand}
            className="mt-1 block text-lg font-bold text-amber-600 dark:text-amber-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Undeposited COD
            </span>
            <Coins className="h-4 w-4 text-amber-500" />
          </div>
          <MoneyText
            paisa={totalUndeposited}
            className="mt-1 block text-lg font-bold text-amber-600 dark:text-amber-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Commission Payable
            </span>
            <Coins className="h-4 w-4 text-emerald-500" />
          </div>
          <MoneyText
            paisa={totalCommissionPayable}
            className={`mt-1 block text-lg font-bold ${
              totalCommissionPayable > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            }`}
          />
        </div>
      </div>

      {selectedRider ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={closeRider}
                className="h-8 gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to riders
              </Button>
              <span className="text-muted-foreground">·</span>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {selectedRider.riderName}
                </span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {selectedRider.phone || 'No phone'}
                </span>
                <span className="ml-2">
                  <StatusBadge value={selectedRider.status} />
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
              <Button
                size="sm"
                onClick={() =>
                  onRecordCashHandover?.(
                    selectedRider.riderId,
                    selectedRider.riderName,
                    selectedRider.cashOnHand,
                  )
                }
                className="h-8 gap-1.5 text-xs"
              >
                <Wallet className="h-3.5 w-3.5" />
                Receive cash
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Cash in hand (rider record)
              </span>
              <MoneyText
                paisa={selectedRider.cashOnHand}
                className="block text-sm font-bold text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Undeposited COD (1031)
              </span>
              <MoneyText
                paisa={selectedRider.undepositedCodCash}
                className="block text-sm font-bold text-amber-600 dark:text-amber-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Commission payable (2031)
              </span>
              <MoneyText
                paisa={selectedRider.commissionPayable}
                className="block text-sm font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Outstanding advances (1042)
              </span>
              <MoneyText
                paisa={selectedRider.outstandingAdvances}
                className="block text-sm font-bold text-rose-600 dark:text-rose-400"
              />
            </div>
          </div>

          <DataTable
            columns={statementColumns}
            data={filteredStatementRows}
            searchValue={statementSearch}
            onSearchChange={setStatementSearch}
            searchPlaceholder="Search voucher, account, narration or reference…"
            isLoading={isFetchingStatement && statementRows.length === 0}
            emptyMessage="No rider ledger entries match the current filters."
            dense
            onRowClick={(row) => openVoucher(row.entryId)}
            initialSorting={[{ id: 'postingDate', desc: true }]}
            footerSlot={
              filteredStatementRows.length > 0 ? (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={4} className="px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      {filteredStatementRows.length} line
                      {filteredStatementRows.length === 1 ? '' : 's'} · balances
                      are tracked per account
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
                      className="text-xs font-bold"
                    />
                  </TableCell>
                </TableRow>
              ) : null
            }
          />
        </div>
      ) : (
        <DataTable
          columns={summaryColumns}
          data={filteredRiders}
          searchValue={riderSearch}
          onSearchChange={setRiderSearch}
          searchPlaceholder="Search rider name, phone or zone…"
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                size="sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">All Riders</NativeSelectOption>
                <NativeSelectOption value="outstanding">
                  Commission outstanding
                </NativeSelectOption>
                <NativeSelectOption value="has-cod">
                  Has COD balance
                </NativeSelectOption>
                <NativeSelectOption value="advances">
                  Has advances
                </NativeSelectOption>
                <NativeSelectOption value="settled">
                  No commission due
                </NativeSelectOption>
              </NativeSelect>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Link to="/admin/riders">
                  <Truck className="h-3.5 w-3.5" />
                  Riders directory
                </Link>
              </Button>
            </div>
          }
          actionSlot={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportRiders}
                disabled={filteredRiders.length === 0}
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
                  className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </>
          }
          isLoading={isFetching && riderAccounts.length === 0}
          emptyMessage="No riders match the selected filters."
          dense
          onRowClick={(rider) => openRider(rider.riderId)}
          initialSorting={[
            { id: 'undepositedCodCash', desc: true },
            { id: 'riderName', desc: false },
          ]}
          footerSlot={
            filteredRiders.length > 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={3} className="px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {filteredRiders.length} rider
                    {filteredRiders.length === 1 ? '' : 's'}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalCashOnHand}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalUndeposited}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalCommissionPayable}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalAdvances}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400"
                  />
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            ) : null
          }
        />
      )}

      {voucherDialog}
    </div>
  )
}
