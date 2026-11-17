import { useState } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  carryForwardOpeningBalancesFn,
  generateFiscalYearPeriodsFn,
  postYearEndClosingVoucherFn,
  togglePeriodLockFn,
} from '#/server/finance/periods.functions'
import { formatNPR } from '#/lib/money'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from 'lucide-react'

export function PeriodCloseTab() {
  const queryClient = useQueryClient()

  // Queries
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const fiscalYears = ledgerData.ops.fiscalYears
  const [selectedFyId, setSelectedFyId] = useState<string>(
    fiscalYears[0]?.id || '',
  )
  const currentFy = fiscalYears.find((f) => f.id === selectedFyId) || fiscalYears[0]

  const { data: periods = [], refetch: refetchPeriods } = useSuspenseQuery(
    adminQueries.accountingPeriods({ fiscalYear: currentFy?.id }),
  )

  const { data: preClose, refetch: refetchPreClose } = useSuspenseQuery(
    adminQueries.fiscalYearPreClose(currentFy?.id || ''),
  )

  const { data: history = [], refetch: refetchHistory } = useSuspenseQuery(
    adminQueries.periodClosingHistory(),
  )

  // Dialog states
  const [isClosingDialogOpen, setIsClosingDialogOpen] = useState(false)
  const [isCarryForwardDialogOpen, setIsCarryForwardDialogOpen] = useState(false)
  const [targetFyId, setTargetFyId] = useState<string>(
    fiscalYears.find((f) => f.id !== currentFy?.id)?.id || '',
  )
  const [closingNarration, setClosingNarration] = useState(
    `Fiscal Year End Closing - ${currentFy?.name || ''}`,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handlers
  const handleToggleLock = async (periodId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open'
    try {
      setIsSubmitting(true)
      await togglePeriodLockFn({
        data: { periodId, status: nextStatus },
      })
      toast.success(
        `Period ${nextStatus === 'closed' ? 'locked' : 'unlocked'} successfully`,
      )
      await Promise.all([refetchPeriods(), refetchPreClose()])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle period lock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGeneratePeriods = async () => {
    if (!currentFy) {
      toast.error('No active fiscal year selected')
      return
    }
    try {
      setIsSubmitting(true)
      const res = await generateFiscalYearPeriodsFn({
        data: { fiscalYearId: currentFy.id },
      })
      toast.success(`Generated ${res.count} BS monthly periods for ${currentFy.name}`)
      await Promise.all([refetchPeriods(), refetchPreClose()])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate BS periods')
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeFyMutation = useMutation({
    mutationFn: async () => {
      if (!currentFy) throw new Error('No fiscal year selected')
      return postYearEndClosingVoucherFn({
        data: {
          fiscalYearId: currentFy.id,
          narration: closingNarration,
        },
      })
    },
    onSuccess: (res) => {
      toast.success(
        `Fiscal Year ${currentFy?.name} closed! Period closing voucher: ${res.voucherNo || 'Created'} (Net P&L: ${formatNPR(res.netProfitOrLoss)})`,
      )
      setIsClosingDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to execute fiscal year close')
    },
  })

  const carryForwardMutation = useMutation({
    mutationFn: async () => {
      if (!currentFy) throw new Error('No source fiscal year selected')
      if (!targetFyId) throw new Error('Please select a target fiscal year')
      return carryForwardOpeningBalancesFn({
        data: {
          fromFiscalYearId: currentFy.id,
          toFiscalYearId: targetFyId,
        },
      })
    },
    onSuccess: (res) => {
      toast.success(
        `Carried forward opening balances to ${targetFyId}! Voucher: ${res.voucherNo || res.journalEntryId} (${res.lineCount} accounts, ${formatNPR(res.totalAssetDebit)})`,
      )
      setIsCarryForwardDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to carry forward opening balances')
    },
  })

  return (
    <div className="space-y-4">
      {/* Top Header & Fiscal Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2.5">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Period Closing & Fiscal Year Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            12 Nepal BS monthly period locks, Pre-closing Trial Balance integrity checks, Year-End Retained Earnings rollover, and Opening Balance carry-forward.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs font-semibold uppercase text-muted-foreground whitespace-nowrap">
            Fiscal Year:
          </Label>
          <select
            value={selectedFyId}
            onChange={(e) => setSelectedFyId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                FY {fy.name} {fy.isClosed ? '(Closed)' : '(Active)'}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPeriods()
              refetchPreClose()
              refetchHistory()
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Pre-Closing Diagnostic Card */}
      <Card className="border-border shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Pre-Closing Trial Balance Integrity Verification
            </CardTitle>
            <Badge
              variant={preClose.isTrialBalanceBalanced ? 'default' : 'destructive'}
              className="text-xs"
            >
              {preClose.isTrialBalanceBalanced ? 'Trial Balance Balanced' : 'Trial Balance Imbalanced'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Total GL Debits</div>
              <div className="text-lg font-bold mt-1 text-foreground">
                {formatNPR(preClose.totalDebits)}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Total GL Credits</div>
              <div className="text-lg font-bold mt-1 text-foreground">
                {formatNPR(preClose.totalCredits)}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Unsubmitted Drafts</div>
              <div className="text-lg font-bold mt-1 flex items-center gap-1.5">
                <span className={preClose.draftCount > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                  {preClose.draftCount}
                </span>
                {preClose.draftCount === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground font-medium">Estimated Net P&L</div>
              <div
                className={`text-lg font-bold mt-1 ${
                  preClose.netProfitOrLoss >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatNPR(preClose.netProfitOrLoss)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Transfer to {preClose.retainedEarningsAccount.name} ({preClose.retainedEarningsAccount.code})
              </div>
            </div>
          </div>

          {/* Diagnostic status alerts */}
          {preClose.blockingReasons.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                Closing Blocked — Action Required Before Close:
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {preClose.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {preClose.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Notice:
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {preClose.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {currentFy?.isClosed ? (
                <span className="text-muted-foreground font-medium">
                  This fiscal year is <strong className="text-foreground">Closed</strong>. Permanent balances can be carried forward into the next fiscal year.
                </span>
              ) : (
                <span>
                  All temporary income and expense balances will be zeroed out and posted to{' '}
                  <strong>{preClose.retainedEarningsAccount.name} ({preClose.retainedEarningsAccount.code})</strong>.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!currentFy?.isClosed && (
                <Button
                  size="sm"
                  disabled={!preClose.canClose || isSubmitting}
                  onClick={() => setIsClosingDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <Lock className="h-4 w-4 mr-1.5" />
                  Execute Year-End Close
                </Button>
              )}

              {currentFy?.isClosed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCarryForwardDialogOpen(true)}
                >
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Carry Forward Opening Balances (OB)
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 12 BS Monthly Periods Lock Control */}
      <Card className="border-border shadow-xs">
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Nepal BS Monthly Accounting Periods (FY {currentFy?.name})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Locking a period prevents retro-dated journal postings, voucher modifications, and expense disbursements.
            </p>
          </div>
          {periods.length === 0 && !currentFy?.isClosed && (
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={handleGeneratePeriods}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Generate 12 BS Periods
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No BS accounting periods generated for FY {currentFy?.name}.
              {!currentFy?.isClosed && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGeneratePeriods}
                  >
                    Generate Shrawan – Ashadh Periods
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Month #</TableHead>
                  <TableHead>BS Month & Period Name</TableHead>
                  <TableHead>Start Date (AD)</TableHead>
                  <TableHead>End Date (AD)</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead>Closed At</TableHead>
                  <TableHead>Closed By</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => {
                  const isClosed = p.status === 'closed'
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.periodNo}</TableCell>
                      <TableCell className="font-medium text-xs flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.startDate.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.endDate.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={isClosed ? 'secondary' : 'default'}
                          className={`text-[10px] ${
                            isClosed
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isClosed ? 'Locked' : 'Open'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.closedAt ? p.closedAt.slice(0, 16).replace('T', ' ') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.closedBy || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSubmitting || currentFy?.isClosed}
                          onClick={() => handleToggleLock(p.id, p.status)}
                          className={`h-7 px-2.5 text-xs font-semibold ${
                            isClosed
                              ? 'text-emerald-600 hover:text-emerald-700'
                              : 'text-amber-600 hover:text-amber-700'
                          }`}
                        >
                          {isClosed ? (
                            <>
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              Unlock
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 mr-1" />
                              Lock
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Historical Year-End Closes Table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Historical Fiscal Year Closing Vouchers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No historical fiscal year closing vouchers recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fiscal Year</TableHead>
                  <TableHead>Closing Voucher</TableHead>
                  <TableHead>Net Profit / Loss</TableHead>
                  <TableHead>Retained Earnings Account</TableHead>
                  <TableHead>Closed By</TableHead>
                  <TableHead className="text-right">Closed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-semibold text-xs">
                      FY {h.fiscalYearName}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      {h.voucherNo || h.closingJournalEntryId}
                    </TableCell>
                    <TableCell
                      className={`font-semibold text-xs ${
                        h.netProfitOrLoss >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatNPR(h.netProfitOrLoss)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.retainedEarningsAccountName} ({h.retainedEarningsAccountCode})
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.closedBy}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right font-mono">
                      {h.closedAt.slice(0, 16).replace('T', ' ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Year-End Close Modal Confirmation */}
      <Dialog open={isClosingDialogOpen} onOpenChange={setIsClosingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirm Fiscal Year End Close
            </DialogTitle>
            <DialogDescription>
              Closing FY {currentFy?.name} is a permanent financial operation. All income and expense accounts will be zeroed out and the net balance transferred to Retained Earnings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/30 rounded-lg space-y-2 border text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fiscal Year:</span>
                <span className="font-bold text-foreground">FY {currentFy?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Net Profit/Loss:</span>
                <span
                  className={`font-bold ${
                    preClose.netProfitOrLoss >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatNPR(preClose.netProfitOrLoss)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retained Earnings Account:</span>
                <span className="font-medium text-foreground">
                  {preClose.retainedEarningsAccount.name} ({preClose.retainedEarningsAccount.code})
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Closing Narration</Label>
              <Input
                value={closingNarration}
                onChange={(e) => setClosingNarration(e.target.value)}
                placeholder="Closing voucher narration..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsClosingDialogOpen(false)}
              disabled={closeFyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => closeFyMutation.mutate()}
              disabled={closeFyMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {closeFyMutation.isPending ? 'Closing FY...' : 'Confirm & Close Fiscal Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opening Balance Carry-Forward Modal */}
      <Dialog
        open={isCarryForwardDialogOpen}
        onOpenChange={setIsCarryForwardDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <RotateCcw className="h-5 w-5 text-primary" />
              Carry Forward Opening Balances (OB)
            </DialogTitle>
            <DialogDescription>
              Transfers permanent Balance Sheet account balances (Assets, Liabilities, Equity) from closed FY {currentFy?.name} into the target open fiscal year.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Open Fiscal Year</Label>
              <select
                value={targetFyId}
                onChange={(e) => setTargetFyId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                {fiscalYears
                  .filter((f) => !f.isClosed && f.id !== currentFy?.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      FY {f.name} (Open)
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              This will create a balanced Opening Balance voucher (<code>OB-xxxx</code>) at the start date of the target fiscal year with no manual intervention.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCarryForwardDialogOpen(false)}
              disabled={carryForwardMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => carryForwardMutation.mutate()}
              disabled={carryForwardMutation.isPending || !targetFyId}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {carryForwardMutation.isPending
                ? 'Generating OB Voucher...'
                : 'Generate Opening Balance Voucher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
