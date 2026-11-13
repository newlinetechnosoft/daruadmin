import { useMemo, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
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
import {
  accountsRouteApi,
  partyReportTab,
  PARTY_TYPE_OPTIONS,
  ROOT_TYPE_OPTIONS,
  VOUCHER_TYPE_OPTIONS,
} from '../accounts-route'
import type { AccountsTab } from '../accounts-route'
import { useVoucherDialog } from '../use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  Download,
  RefreshCw,
  RotateCcw,
  Wallet,
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  ListFilter,
} from 'lucide-react'
import type { GLEntryRow } from '#/server/finance/finance.queries'

function isDebitNormal(rootType: string) {
  return rootType === 'asset' || rootType === 'expense'
}

export function GeneralLedgerTab() {
  const routeApi = accountsRouteApi
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const { data: costCenters = [] } = useQuery(adminQueries.costCenters())

  const accountFilter = search.account ?? 'all'
  const voucherTypeFilter = search.voucherType ?? 'all'
  const partyTypeFilter = search.partyType ?? 'all'
  const partyIdFilter = search.partyId ?? 'all'

  const [rootFilter, setRootFilter] = useState('all')
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [costCenterFilter, setCostCenterFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const accountTypes = useMemo(
    () =>
      [
        ...new Set(
          chartOfAccounts
            .map((account) => account.accountType)
            .filter((value): value is string => !!value),
        ),
      ].sort(),
    [chartOfAccounts],
  )

  const updateSearch = (
    patch: Partial<{
      tab: AccountsTab
      account: string | undefined
      voucherType: string | undefined
      partyType: string | undefined
      partyId: string | undefined
    }>,
  ) => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    })
  }

  const resetFilters = () => {
    setRootFilter('all')
    setAccountTypeFilter('all')
    setCostCenterFilter('all')
    setSearchInput('')
    updateSearch({
      account: undefined,
      voucherType: undefined,
      partyType: undefined,
      partyId: undefined,
    })
  }

  const {
    data: rows = [],
    isFetching,
    refetch,
  } = useQuery({
    ...adminQueries.generalLedger({
      accountId: accountFilter !== 'all' ? accountFilter : undefined,
      accountRootType: rootFilter !== 'all' ? rootFilter : undefined,
      accountType: accountTypeFilter !== 'all' ? accountTypeFilter : undefined,
      partyType: partyTypeFilter !== 'all' ? partyTypeFilter : undefined,
      partyId: partyIdFilter !== 'all' ? partyIdFilter : undefined,
      voucherType: voucherTypeFilter !== 'all' ? voucherTypeFilter : undefined,
      costCenterId: costCenterFilter !== 'all' ? costCenterFilter : undefined,
      fromDate: bounds.start?.toISOString(),
      toDate: bounds.end?.toISOString(),
      search: debouncedSearch.trim() || undefined,
      limit: 1000,
      offset: 0,
    }),
    placeholderData: (previous) => previous,
  })

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0)
  const netMovement = rows.reduce(
    (sum, row) =>
      sum +
      (isDebitNormal(row.accountRootType)
        ? row.debit - row.credit
        : row.credit - row.debit),
    0,
  )

  const handlePartyClick = (row: GLEntryRow) => {
    if (!row.partyId) return
    updateSearch({
      tab: partyReportTab(row.partyType),
      partyType: row.partyType ?? undefined,
      partyId: row.partyId,
      account: undefined,
    })
  }

  const columns = useMemo<ColumnDef<GLEntryRow>[]>(
    () => [
      {
        accessorKey: 'voucherNo',
        header: 'Voucher',
        cell: ({ row }) => (
          <div className="leading-tight">
            <button
              type="button"
              onClick={() => openVoucher(row.original.entryId)}
              className="font-mono text-xs font-semibold text-primary hover:underline"
            >
              {row.original.voucherNo || '—'}
            </button>
            <span className="block text-[10px] font-mono uppercase text-muted-foreground">
              {row.original.voucherType}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'postingDate',
        header: 'Date',
        cell: ({ row }) => (
          <div className="leading-tight whitespace-nowrap">
            <span className="block text-xs text-foreground">
              {row.original.bsDate}
            </span>
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
                updateSearch({
                  account: row.original.accountId,
                })
              }
              className="block text-left font-mono text-xs font-semibold text-foreground hover:text-primary hover:underline"
            >
              {row.original.accountCode}
            </button>
            <span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">
              {row.original.accountName}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">
              {row.original.accountType || row.original.accountRootType}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'partyName',
        header: 'Party',
        cell: ({ row }) => {
          if (!row.original.partyId) {
            return <span className="text-xs text-muted-foreground">—</span>
          }
          return (
            <button
              type="button"
              onClick={() => handlePartyClick(row.original)}
              className="text-left text-xs text-primary hover:underline"
            >
              {row.original.partyName || row.original.partyId}
              <span className="block text-[10px] uppercase text-muted-foreground">
                {row.original.partyType}
              </span>
            </button>
          )
        },
      },
      {
        accessorKey: 'costCenterName',
        header: 'Cost Center',
        cell: ({ row }) =>
          row.original.costCenterName ? (
            <span className="text-xs text-muted-foreground">
              {row.original.costCenterName}
              <span className="block text-[10px] font-mono">
                {row.original.costCenterCode}
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
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
      {
        accessorKey: 'postingStatus',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <StatusBadge value={row.original.postingStatus} />,
      },
    ],
    [openVoucher],
  )

  const handleExport = () => {
    exportCsv(
      `general-ledger-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Voucher No', value: (r) => r.voucherNo ?? '' },
        { header: 'Voucher Type', value: (r) => r.voucherType },
        { header: 'Date (BS)', value: (r) => r.bsDate },
        { header: 'Date (AD)', value: (r) => csvDate(r.postingDate) },
        { header: 'Account Code', value: (r) => r.accountCode },
        { header: 'Account Name', value: (r) => r.accountName },
        { header: 'Root Type', value: (r) => r.accountRootType },
        { header: 'Party Type', value: (r) => r.partyType ?? '' },
        { header: 'Party', value: (r) => r.partyName ?? '' },
        { header: 'Cost Center', value: (r) => r.costCenterName ?? '' },
        { header: 'Debit (NPR)', value: (r) => csvRupees(r.debit) },
        { header: 'Credit (NPR)', value: (r) => csvRupees(r.credit) },
        { header: 'Balance (NPR)', value: (r) => csvRupees(r.runningBalance) },
        { header: 'Narration', value: (r) => r.narration ?? '' },
        { header: 'Reference', value: (r) => r.refId ?? '' },
        { header: 'Status', value: (r) => r.postingStatus },
      ],
      rows,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Debit</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
          </div>
          <MoneyText
            paisa={totalDebit}
            className="mt-1 block text-lg font-bold text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Credit</span>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </div>
          <MoneyText
            paisa={totalCredit}
            className="mt-1 block text-lg font-bold text-rose-600 dark:text-rose-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Net Movement</span>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </div>
          <MoneyText
            paisa={netMovement}
            className="mt-1 block text-lg font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ledger Lines</span>
            <ListFilter className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {rows.length}
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search voucher, account, narration, reference…"
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              size="sm"
              value={accountFilter}
              onChange={(event) =>
                updateSearch({
                  account:
                    event.target.value === 'all'
                      ? undefined
                      : event.target.value,
                })
              }
              className="h-8 max-w-[210px] text-xs"
            >
              <NativeSelectOption value="all">All Accounts</NativeSelectOption>
              {chartOfAccounts.map((account) => (
                <NativeSelectOption key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <NativeSelect
              size="sm"
              value={rootFilter}
              onChange={(event) => setRootFilter(event.target.value)}
              className="h-8 text-xs"
            >
              {ROOT_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <NativeSelect
              size="sm"
              value={accountTypeFilter}
              onChange={(event) => setAccountTypeFilter(event.target.value)}
              className="h-8 text-xs"
            >
              <NativeSelectOption value="all">All Sub-types</NativeSelectOption>
              {accountTypes.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <NativeSelect
              size="sm"
              value={voucherTypeFilter}
              onChange={(event) =>
                updateSearch({
                  voucherType:
                    event.target.value === 'all'
                      ? undefined
                      : event.target.value,
                })
              }
              className="h-8 text-xs"
            >
              {VOUCHER_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <NativeSelect
              size="sm"
              value={partyTypeFilter}
              onChange={(event) =>
                updateSearch({
                  partyType:
                    event.target.value === 'all'
                      ? undefined
                      : event.target.value,
                  partyId: undefined,
                })
              }
              className="h-8 text-xs"
            >
              {PARTY_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <NativeSelect
              size="sm"
              value={costCenterFilter}
              onChange={(event) => setCostCenterFilter(event.target.value)}
              className="h-8 text-xs"
            >
              <NativeSelectOption value="all">
                All Cost Centers
              </NativeSelectOption>
              {costCenters.map((center) => (
                <NativeSelectOption key={center.id} value={center.id}>
                  {center.code} — {center.name}
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

            {partyIdFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                Party filter active
                <button
                  type="button"
                  onClick={() =>
                    updateSearch({ partyId: undefined, partyType: undefined })
                  }
                  className="hover:text-destructive"
                  aria-label="Clear party filter"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        }
        actionSlot={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
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
        isLoading={isFetching && rows.length === 0}
        emptyMessage="No ledger entries found for the selected filters."
        dense
        initialSorting={[{ id: 'postingDate', desc: true }]}
        footerSlot={
          rows.length > 0 ? (
            <TableRow className="border-border hover:bg-transparent">
              <TableCell colSpan={5} className="px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  {rows.length} ledger line{rows.length === 1 ? '' : 's'}
                </span>
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalDebit}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                />
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalCredit}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={netMovement}
                  className="text-xs font-bold text-foreground"
                />
              </TableCell>
              <TableCell />
            </TableRow>
          ) : null
        }
      />

      {voucherDialog}
    </div>
  )
}
