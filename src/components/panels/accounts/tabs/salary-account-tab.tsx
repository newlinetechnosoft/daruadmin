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
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import { useVoucherDialog } from '../use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  Receipt,
  RotateCcw,
  Truck,
  Wallet,
} from 'lucide-react'
import type { Settlement } from '#/server/operations/types'
import type { RiderAccountSummary } from '#/server/finance/finance.queries'

export interface SalaryAccountTabProps {
  onRunPayroll?: () => void
  onApproveSettlement?: (settlement: Settlement) => void
}

const SETTLEMENT_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
]

function settlementPayout(settlement: Settlement) {
  return settlement.netPayout ?? settlement.payout
}

function settlementDeductions(settlement: Settlement) {
  return (
    (settlement.advancesDeducted ?? 0) +
    (settlement.cashShortageDeducted ?? 0) +
    (settlement.cashHeldDeducted ?? 0)
  )
}

export function SalaryAccountTab({
  onRunPayroll,
  onApproveSettlement,
}: SalaryAccountTabProps) {
  const navigate = useNavigate()
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [statusFilter, setStatusFilter] = useState('all')
  const [riderFilter, setRiderFilter] = useState('all')
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const settlements = ledgerData.ops.settlements

  const { data: riderAccounts = [] } = useQuery(
    adminQueries.riderAccountsSummary(),
  )

  const riderOptions = useMemo(
    () =>
      [...new Map(settlements.map((s) => [s.riderId, s.riderName])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [settlements],
  )

  const filteredSettlements = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return settlements.filter((settlement) => {
      if (query) {
        const matches =
          settlement.riderName.toLowerCase().includes(query) ||
          settlement.id.toLowerCase().includes(query) ||
          (settlement.voucherNo ?? '').toLowerCase().includes(query)
        if (!matches) return false
      }
      if (statusFilter !== 'all' && settlement.status !== statusFilter) {
        return false
      }
      if (riderFilter !== 'all' && settlement.riderId !== riderFilter) {
        return false
      }
      const date = new Date(settlement.createdAt || settlement.periodStart)
      if (bounds.start && date < bounds.start) return false
      if (bounds.end && date > bounds.end) return false
      return true
    })
  }, [
    settlements,
    debouncedSearch,
    statusFilter,
    riderFilter,
    bounds.start,
    bounds.end,
  ])

  const filteredRiders = useMemo(() => {
    if (riderFilter === 'all') return riderAccounts
    return riderAccounts.filter((rider) => rider.riderId === riderFilter)
  }, [riderAccounts, riderFilter])

  const totalCommissions = filteredSettlements.reduce(
    (sum, settlement) => sum + settlement.commission,
    0,
  )
  const totalPayouts = filteredSettlements.reduce(
    (sum, settlement) => sum + settlementPayout(settlement),
    0,
  )
  const totalDeliveries = filteredSettlements.reduce(
    (sum, settlement) => sum + settlement.deliveries,
    0,
  )
  const pendingSettlements = filteredSettlements.filter(
    (settlement) => settlement.status !== 'paid',
  ).length
  const totalCashOnHand = filteredRiders.reduce(
    (sum, rider) => sum + rider.cashOnHand,
    0,
  )
  const totalCommissionPayable = filteredRiders.reduce(
    (sum, rider) => sum + rider.commissionPayable,
    0,
  )

  const riderColumns = useMemo<ColumnDef<RiderAccountSummary>[]>(
    () => [
      {
        accessorKey: 'riderName',
        header: 'Rider',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/admin/accounts',
                search: (prev) => ({
                  ...prev,
                  tab: 'rider-ledger',
                  partyType: 'rider',
                  partyId: row.original.riderId,
                }),
              })
            }
            className="text-left text-xs font-semibold text-primary hover:underline"
          >
            {row.original.riderName}
            <span className="block font-normal text-[10px] text-muted-foreground">
              {row.original.phone || 'No phone'}
            </span>
          </button>
        ),
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
          <MoneyText
            paisa={row.original.undepositedCodCash}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400"
          />
        ),
      },
      {
        accessorKey: 'commissionPayable',
        header: 'Commission Payable',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.commissionPayable}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          />
        ),
      },
      {
        accessorKey: 'outstandingAdvances',
        header: 'Advances',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.outstandingAdvances}
            className="text-xs text-rose-600 dark:text-rose-400"
          />
        ),
      },
      {
        id: 'net',
        header: 'Net Position',
        enableSorting: false,
        cell: ({ row }) => {
          const net =
            row.original.commissionPayable -
            row.original.cashOnHand -
            row.original.outstandingAdvances
          return (
            <MoneyText
              paisa={net}
              className={`text-xs font-bold ${
                net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            />
          )
        },
      },
    ],
    [navigate],
  )

  const settlementColumns = useMemo<ColumnDef<Settlement>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Settlement',
        cell: ({ row }) => (
          <div className="leading-tight">
            <span className="block font-mono text-[10px] font-semibold text-foreground">
              {row.original.id}
            </span>
            {row.original.voucherNo ? (
              <button
                type="button"
                onClick={() =>
                  openVoucher(row.original.journalEntryId ?? undefined)
                }
                className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
              >
                <Receipt className="h-2.5 w-2.5" />
                {row.original.voucherNo}
              </button>
            ) : (
              <span className="block text-[10px] text-muted-foreground">
                Not posted
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'riderName',
        header: 'Rider',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/admin/accounts',
                search: (prev) => ({
                  ...prev,
                  tab: 'rider-ledger',
                  partyType: 'rider',
                  partyId: row.original.riderId,
                }),
              })
            }
            className="text-left text-xs font-medium text-primary hover:underline"
          >
            {row.original.riderName}
          </button>
        ),
      },
      {
        id: 'period',
        header: 'Period',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            {csvDate(row.original.periodStart)} →{' '}
            {csvDate(row.original.periodEnd)}
          </span>
        ),
      },
      {
        accessorKey: 'deliveries',
        header: 'Deliveries',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.deliveries}</span>
        ),
      },
      {
        accessorKey: 'commission',
        header: 'Commission',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.commission}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          />
        ),
      },
      {
        id: 'deductions',
        header: 'Deductions',
        enableSorting: false,
        cell: ({ row }) => {
          const deductions = settlementDeductions(row.original)
          return deductions > 0 ? (
            <MoneyText
              paisa={deductions}
              className="text-xs text-rose-600 dark:text-rose-400"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        },
      },
      {
        id: 'payout',
        header: 'Net Payout',
        cell: ({ row }) => (
          <MoneyText
            paisa={settlementPayout(row.original)}
            className="text-xs font-bold"
          />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge value={row.original.status} />,
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
            {row.original.status !== 'paid' && onApproveSettlement && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApproveSettlement(row.original)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <CheckCircle2 className="h-3 w-3" />
                Approve & pay
              </Button>
            )}
            {row.original.voucherNo && row.original.journalEntryId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openVoucher(row.original.journalEntryId)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                Voucher
              </Button>
            )}
          </div>
        ),
      },
    ],
    [navigate, onApproveSettlement, openVoucher],
  )

  const handleExportSettlements = () => {
    exportCsv(
      `rider-settlements-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Settlement ID', value: (s) => s.id },
        { header: 'Voucher No', value: (s) => s.voucherNo ?? '' },
        { header: 'Rider', value: (s) => s.riderName },
        { header: 'Period Start', value: (s) => csvDate(s.periodStart) },
        { header: 'Period End', value: (s) => csvDate(s.periodEnd) },
        { header: 'Deliveries', value: (s) => s.deliveries },
        { header: 'Commission (NPR)', value: (s) => csvRupees(s.commission) },
        {
          header: 'Deductions (NPR)',
          value: (s) => csvRupees(settlementDeductions(s)),
        },
        {
          header: 'Net Payout (NPR)',
          value: (s) => csvRupees(settlementPayout(s)),
        },
        { header: 'Status', value: (s) => s.status },
        { header: 'Paid At', value: (s) => csvDate(s.paidAt) },
      ],
      filteredSettlements,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
          <span className="text-xs text-muted-foreground">Deliveries</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {totalDeliveries}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Commissions</span>
          <MoneyText
            paisa={totalCommissions}
            className="mt-1 block text-lg font-bold text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Net Payouts</span>
          <MoneyText
            paisa={totalPayouts}
            className="mt-1 block text-lg font-bold"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Pending Payable
            </span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <MoneyText
            paisa={totalCommissionPayable}
            className="mt-1 block text-lg font-bold text-amber-600 dark:text-amber-400"
          />
          <span className="text-[10px] text-muted-foreground">
            {pendingSettlements} settlement(s) pending
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            Rider accounts &amp; COD cash
          </h3>
          <span className="text-[10px] text-muted-foreground">
            Cash in hand on rider record: NPR{' '}
            {(totalCashOnHand / 100).toLocaleString('en-NP')}
          </span>
        </div>
        <DataTable
          columns={riderColumns}
          data={filteredRiders}
          emptyMessage="No rider accounts found."
          dense
          initialSorting={[{ id: 'commissionPayable', desc: true }]}
          footerSlot={
            filteredRiders.length > 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell className="px-3 py-2 text-xs">
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
                    paisa={filteredRiders.reduce(
                      (sum, rider) => sum + rider.undepositedCodCash,
                      0,
                    )}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalCommissionPayable}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            ) : null
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            Rider commission settlements
          </h3>
          {onRunPayroll && (
            <Button
              size="sm"
              onClick={onRunPayroll}
              className="h-8 gap-1.5 text-xs"
            >
              <Calendar className="h-3.5 w-3.5" />
              Run payroll
            </Button>
          )}
        </div>

        <DataTable
          columns={settlementColumns}
          data={filteredSettlements}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search rider, settlement ID or voucher…"
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                size="sm"
                value={riderFilter}
                onChange={(event) => setRiderFilter(event.target.value)}
                className="h-8 max-w-[180px] text-xs"
              >
                <NativeSelectOption value="all">All riders</NativeSelectOption>
                {riderOptions.map((rider) => (
                  <NativeSelectOption key={rider.id} value={rider.id}>
                    {rider.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                size="sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-8 text-xs"
              >
                {SETTLEMENT_STATUSES.map((option) => (
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
                  setStatusFilter('all')
                  setRiderFilter('all')
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
                onClick={handleExportSettlements}
                disabled={filteredSettlements.length === 0}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </>
          }
          emptyMessage="No rider settlements found for the selected filters."
          dense
          initialSorting={[{ id: 'period', desc: true }]}
          footerSlot={
            filteredSettlements.length > 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={4} className="px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {filteredSettlements.length} settlement
                    {filteredSettlements.length === 1 ? '' : 's'} ·{' '}
                    {totalDeliveries} deliveries
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalCommissions}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={filteredSettlements.reduce(
                      (sum, settlement) =>
                        sum + settlementDeductions(settlement),
                      0,
                    )}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={totalPayouts}
                    className="text-xs font-bold"
                  />
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            ) : null
          }
        />
      </div>

      {voucherDialog}
    </div>
  )
}
