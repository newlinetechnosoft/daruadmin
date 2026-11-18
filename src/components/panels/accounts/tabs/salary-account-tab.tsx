import { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
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
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { useVoucherDialog } from '../use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { can } from '#/server/auth/permissions-shared'
import {
  approveOnlySettlementFn,
  cancelSettlementFn,
  deleteSettlementFn,
} from '#/server/operations/operations.functions'
import { toast } from 'sonner'
import {
  Ban,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  MoreVertical,
  Receipt,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
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
  { value: 'cancelled', label: 'Cancelled' },
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
  const queryClient = useQueryClient()
  const { data: access } = useQuery(adminQueries.access())
  const grants = access?.grants
  const canApprove = can(grants, 'accounts_salary_account', 'approve')
  const canDelete = can(grants, 'accounts_salary_account', 'delete')
  const canExport = can(grants, 'accounts_salary_account', 'export')
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [statusFilter, setStatusFilter] = useState('all')
  const [riderFilter, setRiderFilter] = useState('all')
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const [cancellingSettlement, setCancellingSettlement] =
    useState<Settlement | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [deletingSettlement, setDeletingSettlement] =
    useState<Settlement | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isActionSubmitting, setIsActionSubmitting] = useState(false)

  const handleApproveOnly = async (settlement: Settlement) => {
    try {
      setIsActionSubmitting(true)
      const res = await approveOnlySettlementFn({ data: { id: settlement.id } })
      toast.success(
        `Settlement accrued and approved under NAS 19 (Voucher: ${res.voucherNo})`,
      )
      await queryClient.invalidateQueries({
        queryKey: adminQueries.ledger().queryKey,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve settlement accrual')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancellingSettlement) return
    try {
      setIsActionSubmitting(true)
      await cancelSettlementFn({
        data: {
          id: cancellingSettlement.id,
          reason: cancelReason.trim() || undefined,
        },
      })
      toast.success(
        `Settlement ${cancellingSettlement.voucherNo || cancellingSettlement.id} cancelled successfully`,
      )
      setCancellingSettlement(null)
      setCancelReason('')
      await queryClient.invalidateQueries({
        queryKey: adminQueries.ledger().queryKey,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel settlement')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingSettlement) return
    if (
      deletingSettlement.status === 'approved' ||
      deletingSettlement.status === 'paid'
    ) {
      toast.error(
        'Deletion blocked: Approved and Paid settlements are permanently locked under Nepal Accounting Standards (NAS 1 / NAS 19)',
      )
      return
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Please type DELETE to confirm deletion')
      return
    }
    try {
      setIsActionSubmitting(true)
      await deleteSettlementFn({
        data: {
          id: deletingSettlement.id,
          confirmed: true,
        },
      })
      toast.success(`Settlement record deleted successfully`)
      setDeletingSettlement(null)
      setDeleteConfirmText('')
      await queryClient.invalidateQueries({
        queryKey: adminQueries.ledger().queryKey,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete settlement')
    } finally {
      setIsActionSubmitting(false)
    }
  }

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
        header: 'Courier / Role',
        cell: ({ row }) => (
          <div>
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
              className="text-left text-xs font-semibold text-primary hover:underline block leading-tight"
            >
              {row.original.riderName}
            </button>
            <span className="block font-normal text-[10px] text-muted-foreground mt-0.5">
              Role: Delivery Courier
            </span>
          </div>
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
        cell: ({ row }) => {
          const settlement = row.original
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(event) => event.stopPropagation()}
            >
              {settlement.status === 'draft' && onApproveSettlement && canApprove && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApproveSettlement(settlement)}
                  className="h-7 gap-1 px-2 text-xs font-medium"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Approve &amp; pay
                </Button>
              )}

              {settlement.status === 'approved' && onApproveSettlement && canApprove && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApproveSettlement(settlement)}
                  className="h-7 gap-1 px-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Disburse payout
                </Button>
              )}

              {settlement.voucherNo && settlement.journalEntryId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openVoucher(settlement.journalEntryId)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  Voucher
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Settlement options"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                    <span className="sr-only">Open options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  {settlement.status === 'draft' && (
                    <>
                      {canApprove && (
                        <DropdownMenuItem
                          onClick={() => handleApproveOnly(settlement)}
                          disabled={isActionSubmitting}
                          className="gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" />
                          <div>
                            <span className="font-medium block">Approve Accrual</span>
                            <span className="text-[10px] text-muted-foreground block">
                              NAS 19 Dr. Expense / Cr. Payable
                            </span>
                          </div>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setCancellingSettlement(settlement)
                          setCancelReason('')
                        }}
                        disabled={isActionSubmitting}
                        className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span>Cancel Settlement</span>
                      </DropdownMenuItem>
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeletingSettlement(settlement)
                              setDeleteConfirmText('')
                            }}
                            disabled={isActionSubmitting}
                            className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Draft</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}

                  {settlement.status === 'approved' && (
                    <>
                      {onApproveSettlement && (
                        <DropdownMenuItem
                          onClick={() => onApproveSettlement(settlement)}
                          className="gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Disburse Payout (Pay)</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setCancellingSettlement(settlement)
                          setCancelReason('')
                        }}
                        disabled={isActionSubmitting}
                        className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <div>
                          <span className="font-medium block">Cancel &amp; Reverse</span>
                          <span className="text-[10px] text-muted-foreground block">
                            Reverses NAS 8 journal entry
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setDeletingSettlement(settlement)
                          setDeleteConfirmText('')
                        }}
                        className="gap-2 cursor-pointer text-muted-foreground hover:text-rose-600"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                        <span>Delete (Locked by NAS 19)</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {settlement.status === 'paid' && (
                    <>
                      {settlement.journalEntryId && (
                        <DropdownMenuItem
                          onClick={() => openVoucher(settlement.journalEntryId)}
                          className="gap-2 cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>View Voucher Details</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setDeletingSettlement(settlement)
                          setDeleteConfirmText('')
                        }}
                        className="gap-2 cursor-pointer text-muted-foreground"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                        <span>Delete (Prohibited under NAS 1)</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {settlement.status === 'cancelled' && (
                    <DropdownMenuItem
                      onClick={() => {
                        setDeletingSettlement(settlement)
                        setDeleteConfirmText('')
                      }}
                      disabled={isActionSubmitting}
                      className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Cancelled Record</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [navigate, onApproveSettlement, openVoucher, isActionSubmitting],
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
      {/* Nepal Accounting Standards (NAS 19 / NAS 1) Standard Compliance Banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <span>Nepal Accounting Standards (NAS 19 &amp; NAS 1) Compliant Payroll</span>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-[10px] font-mono text-primary uppercase"
            >
              NAS 19 · NAS 1 · IFRS
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Courier &amp; staff compensation follows statutory two-stage double-entry principles:
            <strong> Stage 1 (Accrual / Approval):</strong> Recognizes personnel expense obligations (Dr. Salary/Courier Expense, Cr. Rider/Staff Payable).
            <strong> Stage 2 (Disbursement / Payout):</strong> Settles payable liabilities against physical cash vault or bank accounts with shortage and advance deduction clearances (Dr. Payable, Cr. Cash/Bank).
            Under NAS 1 audit trail rules, posted vouchers cannot be deleted; cancellations generate traceable reverse-entry credit vouchers.
          </p>
        </div>
      </div>

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
          {onRunPayroll && can(grants, 'accounts_salary_account', 'create') && (
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
              {canExport && (
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
              )}
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

      {/* Cancel Settlement Modal */}
      <Dialog
        open={Boolean(cancellingSettlement)}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingSettlement(null)
            setCancelReason('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Ban className="h-4 w-4 text-warning" />
              Cancel Payroll Settlement
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nepal Accounting Standards (NAS 8 / NAS 1) Compliance Notice:
              {cancellingSettlement?.status === 'approved'
                ? ' This settlement was already approved and posted as an accrual. Cancelling it will generate an automatic reversal journal entry in the General Ledger.'
                : ' Cancelling this draft settlement will mark it cancelled. No financial disbursements will take place.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-md border border-border bg-muted/40 p-2.5 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient:</span>
                <span className="font-semibold">
                  {cancellingSettlement?.riderName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Settlement ID:</span>
                <span className="font-mono">{cancellingSettlement?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Payout:</span>
                <MoneyText
                  paisa={
                    cancellingSettlement
                      ? settlementPayout(cancellingSettlement)
                      : 0
                  }
                  className="font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Cancellation Reason / Memo
              </Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Recalculation needed, duplicate payroll batch"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCancellingSettlement(null)
                setCancelReason('')
              }}
              disabled={isActionSubmitting}
            >
              Keep Settlement
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={isActionSubmitting}
              className="gap-1.5"
            >
              <Ban className="h-3.5 w-3.5" />
              {isActionSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Guard Dialog */}
      <Dialog
        open={Boolean(deletingSettlement)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSettlement(null)
            setDeleteConfirmText('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {deletingSettlement &&
          (deletingSettlement.status === 'paid' ||
            deletingSettlement.status === 'approved') ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                  Deletion Blocked by Accounting Standards
                </DialogTitle>
                <DialogDescription className="text-xs pt-1">
                  Nepal Accounting Standard 1 (NAS 1: Presentation of Financial
                  Statements) &amp; NAS 19 (Employee Benefits) Guard:
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 space-y-2 text-rose-700 dark:text-rose-300">
                  <p className="leading-relaxed">
                    Settlement{' '}
                    <strong>
                      {deletingSettlement.voucherNo || deletingSettlement.id}
                    </strong>{' '}
                    has status{' '}
                    <strong>
                      "{deletingSettlement.status.toUpperCase()}"
                    </strong>{' '}
                    and contains journal entries posted to the General Ledger.
                  </p>
                  <p className="leading-relaxed text-[11px]">
                    Under statutory double-entry accounting and Nepal tax
                    regulations, transactions that have been approved or paid{' '}
                    <strong>CANNOT be hard-deleted</strong>. To revoke this
                    payroll record, you must cancel the settlement, which
                    creates a traceable audit reversal entry.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeletingSettlement(null)
                    setDeleteConfirmText('')
                  }}
                >
                  Understood
                </Button>
                {deletingSettlement.status === 'approved' && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const s = deletingSettlement
                      setDeletingSettlement(null)
                      setDeleteConfirmText('')
                      setCancellingSettlement(s)
                    }}
                    className="gap-1.5"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel Settlement Instead
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete Settlement Record
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Safety Deletion Guard: Without typing DELETE and clicking
                  confirm, this record cannot be deleted.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="rounded-md border border-border bg-muted/40 p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient:</span>
                    <span className="font-semibold">
                      {deletingSettlement?.riderName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-mono uppercase text-muted-foreground">
                      {deletingSettlement?.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Gross Earnings:
                    </span>
                    <MoneyText
                      paisa={
                        deletingSettlement?.grossEarnings ||
                        deletingSettlement?.commission ||
                        0
                      }
                      className="font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    To confirm deletion, please type{' '}
                    <span className="font-mono font-bold text-destructive">
                      DELETE
                    </span>
                    :
                  </Label>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeletingSettlement(null)
                    setDeleteConfirmText('')
                  }}
                  disabled={isActionSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={
                    isActionSubmitting ||
                    deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                  }
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isActionSubmitting ? 'Deleting...' : 'Delete Settlement'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
