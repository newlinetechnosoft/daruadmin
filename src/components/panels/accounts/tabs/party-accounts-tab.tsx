import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Bike,
  Building2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Search,
  Store,
  UserCheck,
  Users,
} from 'lucide-react'
import type { PartyType } from '#/server/finance/types'
import type { PartySummaryRow } from '#/server/finance/parties.queries'
import { exportFinancialReportFn } from '#/server/finance/export.functions'
import { toast } from 'sonner'

interface PartyAccountsTabProps {
  initialPartyType?: PartyType
}

const PARTY_TABS: Array<{
  type: PartyType
  label: string
  icon: typeof Store
  controlCode: string
  controlName: string
}> = [
  {
    type: 'dealer',
    label: 'Dealers',
    icon: Store,
    controlCode: '2010',
    controlName: 'Dealer Payable',
  },
  {
    type: 'rider',
    label: 'Riders',
    icon: Bike,
    controlCode: '1031 / 2031',
    controlName: 'Rider COD / Rider Payable',
  },
  {
    type: 'customer',
    label: 'Customers',
    icon: Users,
    controlCode: '1020',
    controlName: 'Accounts Receivable (Customers)',
  },
  {
    type: 'supplier',
    label: 'Suppliers',
    icon: Building2,
    controlCode: '2010',
    controlName: 'Accounts Payable',
  },
  {
    type: 'employee',
    label: 'Employees',
    icon: UserCheck,
    controlCode: '1042 / 2030',
    controlName: 'Staff Advances / Salary Payable',
  },
]

export function PartyAccountsTab({ initialPartyType = 'dealer' }: PartyAccountsTabProps) {
  const navigate = useNavigate()
  const [activePartyType, setActivePartyType] = useState<PartyType>(initialPartyType)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedParty, setSelectedParty] = useState<PartySummaryRow | null>(null)

  const activeTabMeta = PARTY_TABS.find((t) => t.type === activePartyType)!

  const { data: parties = [] } = useSuspenseQuery(
    adminQueries.partyAccountsSummary({
      partyType: activePartyType,
      search: searchQuery.trim() || undefined,
    }),
  )

  const totalDebit = parties.reduce((s, p) => s + p.totalDebit, 0)
  const totalCredit = parties.reduce((s, p) => s + p.totalCredit, 0)
  const netBalance = parties.reduce((s, p) => s + p.currentBalance, 0)

  const handleOpenLedger = (party: PartySummaryRow) => {
    setSelectedParty(party)
  }

  const handleNavigateToGL = (partyId: string) => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({
        ...prev,
        tab: 'ledger',
        partyType: activePartyType,
        partyId,
      }),
    })
  }

  return (
    <div className="space-y-4">
      {/* Party Type Segmented Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {PARTY_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.type === activePartyType
          return (
            <Button
              key={tab.type}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivePartyType(tab.type)}
              className="h-8 gap-1.5 text-xs"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </Button>
          )
        })}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Control Account
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-sm font-bold text-foreground">
              {activeTabMeta.controlCode}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {activeTabMeta.controlName}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Total {activeTabMeta.label}
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-foreground">
            {parties.length}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Total Debit
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
            <MoneyText paisa={totalDebit} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Total Credit
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
            <MoneyText paisa={totalCredit} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Net Balance
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-foreground">
            <MoneyText paisa={netBalance} />
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTabMeta.label.toLowerCase()}…`}
            className="h-8 pl-8 text-xs font-mono"
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {parties.length} records
        </span>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-48 text-xs">Name</TableHead>
              <TableHead className="w-28 text-xs">Code / Ref</TableHead>
              <TableHead className="w-32 text-xs">Phone</TableHead>
              <TableHead className="w-28 text-xs">City / Zone</TableHead>
              <TableHead className="text-right text-xs">Total Debit</TableHead>
              <TableHead className="text-right text-xs">Total Credit</TableHead>
              <TableHead className="text-right text-xs">Balance (NPR)</TableHead>
              <TableHead className="w-16 text-center text-xs">Dir</TableHead>
              <TableHead className="w-36 text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-xs text-muted-foreground"
                >
                  No {activeTabMeta.label.toLowerCase()} found.
                </TableCell>
              </TableRow>
            ) : (
              parties.map((p) => (
                <TableRow
                  key={p.partyId}
                  className="border-border text-xs cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => handleOpenLedger(p)}
                >
                  <TableCell className="font-medium text-foreground">
                    {p.partyName}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {p.partyCode || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {p.phone || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.city || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <MoneyText paisa={p.totalDebit} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <MoneyText paisa={p.totalCredit} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    <MoneyText
                      paisa={p.currentBalance}
                      className={
                        p.currentBalance > 0
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        p.balanceDirection === 'Dr'
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-600'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                      }`}
                    >
                      {p.balanceDirection}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenLedger(p)}
                        className="h-6 gap-1 px-2 text-[11px]"
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        Statement
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigateToGL(p.partyId)}
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        title="Open in General Ledger tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Interactive Party Statement Modal */}
      {selectedParty && (
        <PartyStatementModal
          party={selectedParty}
          partyType={activePartyType}
          onClose={() => setSelectedParty(null)}
        />
      )}
    </div>
  )
}

function PartyStatementModal({
  party,
  partyType,
  onClose,
}: {
  party: PartySummaryRow
  partyType: PartyType
  onClose: () => void
}) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const { data: statementRows = [], isLoading } = useQuery(
    adminQueries.partyStatement({
      partyType,
      partyId: party.partyId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: 500,
    }),
  )

  const totalPeriodDebit = statementRows.reduce((s, r) => s + r.debit, 0)
  const totalPeriodCredit = statementRows.reduce((s, r) => s + r.credit, 0)
  const openingBalance = statementRows[0]?.openingBalance ?? 0
  const closingBalance =
    statementRows[statementRows.length - 1]?.runningBalance ?? openingBalance

  const handleExportCsv = async () => {
    try {
      setIsExporting(true)
      const res = await exportFinancialReportFn({
        data: {
          reportType: 'party-statement',
          partyType,
          partyId: party.partyId,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      })
      const blob = new Blob([res.csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', res.filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`Statement exported as ${res.filename}`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export statement')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  {party.partyName}
                </DialogTitle>
                <Badge variant="outline" className="text-xs uppercase font-mono">
                  {partyType}
                </Badge>
                {party.partyCode && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    Ref: {party.partyCode}
                  </Badge>
                )}
              </div>
              <DialogDescription className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                {party.phone && <span>Phone: {party.phone}</span>}
                {party.city && <span>City: {party.city}</span>}
                <span>
                  Control: {party.controlAccountCode} ({party.controlAccountName})
                </span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? 'Exporting…' : 'Export Statement CSV'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Date Filters & KPI Summary */}
        <div className="space-y-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Date Range:
              </span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="From Date"
                className="h-7 w-32 text-xs font-mono"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="To Date"
                className="h-7 w-32 text-xs font-mono"
              />
              {(fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFromDate('')
                    setToDate('')
                  }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Filter
                </Button>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {statementRows.length} transaction line(s)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Opening Balance
              </span>
              <div className="mt-0.5 font-mono text-sm font-bold text-foreground">
                <MoneyText paisa={Math.abs(openingBalance)} />
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {openingBalance >= 0 ? 'Dr' : 'Cr'}
                </span>
              </div>
            </div>
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Period Debit
              </span>
              <div className="mt-0.5 font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                <MoneyText paisa={totalPeriodDebit} />
              </div>
            </div>
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Period Credit
              </span>
              <div className="mt-0.5 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <MoneyText paisa={totalPeriodCredit} />
              </div>
            </div>
            <div className="rounded-md border border-border bg-card p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Closing Balance
              </span>
              <div className="mt-0.5 font-mono text-sm font-bold text-foreground">
                <MoneyText paisa={Math.abs(closingBalance)} />
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {closingBalance >= 0 ? 'Dr' : 'Cr'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Lines Table */}
        <div className="flex-1 overflow-y-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
              <TableRow className="border-border">
                <TableHead className="w-28 text-xs">Date</TableHead>
                <TableHead className="w-32 text-xs">Voucher No</TableHead>
                <TableHead className="w-16 text-center text-xs">Type</TableHead>
                <TableHead className="w-40 text-xs">Account</TableHead>
                <TableHead className="text-xs">Narration</TableHead>
                <TableHead className="text-right text-xs">Debit (Dr)</TableHead>
                <TableHead className="text-right text-xs">Credit (Cr)</TableHead>
                <TableHead className="text-right text-xs">Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    Loading ledger statement…
                  </TableCell>
                </TableRow>
              ) : statementRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    No transactions found for this party.
                  </TableCell>
                </TableRow>
              ) : (
                statementRows.map((r) => (
                  <TableRow key={r.lineId} className="border-border text-xs">
                    <TableCell className="font-mono text-muted-foreground">
                      <div>{r.bsDate}</div>
                      <div className="text-[10px] text-muted-foreground/70">
                        {r.postingDate.slice(0, 10)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-medium text-foreground">
                      {r.voucherNo || '—'}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge variant="outline" className="text-[10px]">
                        {r.voucherType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {r.accountCode}
                      </div>
                      <div className="truncate max-w-[150px]">
                        {r.accountName}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {r.narration || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.debit > 0 ? <MoneyText paisa={r.debit} /> : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.credit > 0 ? <MoneyText paisa={r.credit} /> : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <div className="flex items-center justify-end gap-1.5">
                        <MoneyText paisa={Math.abs(r.runningBalance)} />
                        <span
                          className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded border ${
                            r.runningBalance >= 0
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          }`}
                        >
                          {r.runningBalance >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
