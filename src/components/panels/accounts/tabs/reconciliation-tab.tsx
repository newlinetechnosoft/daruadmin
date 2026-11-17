import { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
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
  autoMatchBankTransactionsFn,
  clearBankTransactionFn,
  finalizeBankReconciliationFn,
  importBankTransactionsFn,
  matchBankTransactionFn,
  postQuickBankEntryFn,
} from '#/server/finance/banking.functions'
import { formatNPR } from '#/lib/money'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Landmark,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  Upload,
  Zap,
} from 'lucide-react'

export function ReconciliationTab() {
  const queryClient = useQueryClient()

  // Integrity audit query
  const { data: audit, refetch: refetchAudit, isFetching: isAuditFetching } =
    useSuspenseQuery(adminQueries.subledgerIntegrity())

  // Bank accounts
  const { data: bankAccounts = [] } = useSuspenseQuery(
    adminQueries.bankAccounts(),
  )

  const [selectedBankId, setSelectedBankId] = useState(
    bankAccounts[0]?.id || '',
  )

  const effectiveBankId = selectedBankId || bankAccounts[0]?.id || ''

  // Selected Bank Reconciliation Summary
  const { data: reconSummary, refetch: refetchSummary } = useQuery({
    ...adminQueries.bankReconciliationSummary(effectiveBankId),
    enabled: Boolean(effectiveBankId),
  })

  // Bank Statement Transactions
  const {
    data: statementTransactions = [],
    refetch: refetchTransactions,
  } = useQuery({
    ...adminQueries.bankTransactions({ bankAccountId: effectiveBankId }),
    enabled: Boolean(effectiveBankId),
  })

  // Unmatched GL Journal Lines for this bank
  const { data: unmatchedGLLines = [], refetch: refetchUnmatchedGL } = useQuery({
    ...adminQueries.unmatchedBankJournalLines(effectiveBankId),
    enabled: Boolean(effectiveBankId),
  })

  // Modals & Forms State
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importCsvText, setImportCsvText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Manual Match Modal
  const [matchingTransaction, setMatchingTransaction] = useState<any | null>(null)
  const [selectedGLLineId, setSelectedGLLineId] = useState<string>('')

  // Quick Post from Statement Transaction Modal
  const [quickPostTransaction, setQuickPostTransaction] = useState<any | null>(null)
  const [quickPostType, setQuickPostType] = useState<
    'bank_charges' | 'interest' | 'deposit' | 'withdrawal'
  >('bank_charges')
  const [quickPostNarration, setQuickPostNarration] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filtered Statement Transactions
  const filteredStatementTx = useMemo(() => {
    return statementTransactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const desc = (tx.description || '').toLowerCase()
        const ref = (tx.referenceNo || '').toLowerCase()
        if (!desc.includes(q) && !ref.includes(q)) return false
      }
      return true
    })
  }, [statementTransactions, statusFilter, searchQuery])

  // Invalidate all reconciliation queries
  const refetchAll = async () => {
    await Promise.all([
      refetchSummary(),
      refetchTransactions(),
      refetchUnmatchedGL(),
      refetchAudit(),
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
    ])
  }

  // Handle Statement CSV Import
  const handleImportStatement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveBankId) {
      toast.error('Select a bank account first')
      return
    }
    if (!importCsvText.trim()) {
      toast.error('Paste statement CSV rows or text')
      return
    }

    try {
      setIsSubmitting(true)
      const lines = importCsvText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      const transactions: Array<{
        transactionDate: string
        description: string
        referenceNo?: string | null
        debitRs?: number
        creditRs?: number
      }> = []

      for (const line of lines) {
        if (line.toLowerCase().startsWith('date')) continue // Skip CSV header
        const parts = line.split(',').map((p) => p.trim())
        if (parts.length < 3) continue

        const [dateStr, desc, refOrDeposit, maybeWithdrawal, maybeRef] = parts

        let refNo: string | null = null
        let debitRs = 0
        let creditRs = 0

        if (parts.length >= 5) {
          refNo = refOrDeposit || null
          debitRs = parseFloat(maybeWithdrawal) || 0
          creditRs = parseFloat(maybeRef) || 0
        } else if (parts.length === 4) {
          debitRs = parseFloat(refOrDeposit) || 0
          creditRs = parseFloat(maybeWithdrawal) || 0
        } else {
          debitRs = parseFloat(refOrDeposit) || 0
        }

        transactions.push({
          transactionDate: dateStr,
          description: desc,
          referenceNo: refNo,
          debitRs,
          creditRs,
        })
      }

      if (transactions.length === 0) {
        toast.error('No valid transaction rows found in pasted text')
        return
      }

      const res = await importBankTransactionsFn({
        data: {
          bankAccountId: effectiveBankId,
          transactions,
        },
      })

      toast.success(
        `Imported ${res.importedCount} transactions (${res.duplicateCount} duplicates skipped)`,
      )
      setIsImportOpen(false)
      setImportCsvText('')
      await refetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import bank statement')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Auto-Match
  const handleAutoMatch = async () => {
    if (!effectiveBankId) return
    try {
      setIsSubmitting(true)
      const res = await autoMatchBankTransactionsFn({
        data: { bankAccountId: effectiveBankId },
      })
      if (res.matchedCount > 0) {
        toast.success(`Successfully auto-matched ${res.matchedCount} transaction(s)!`)
      } else {
        toast.info('No new exact matches found. Try manual matching.')
      }
      await refetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Auto-match failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Manual Match Confirmation
  const handleConfirmManualMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchingTransaction || !selectedGLLineId) {
      toast.error('Select an eligible GL journal line to match')
      return
    }

    try {
      setIsSubmitting(true)
      await matchBankTransactionFn({
        data: {
          bankTransactionId: matchingTransaction.id,
          journalLineId: selectedGLLineId,
        },
      })
      toast.success('Transaction matched successfully!')
      setMatchingTransaction(null)
      setSelectedGLLineId('')
      await refetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to match transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Unmatch
  const handleUnmatch = async (bankTransactionId: string) => {
    try {
      setIsSubmitting(true)
      await clearBankTransactionFn({
        data: { bankTransactionId },
      })
      toast.success('Transaction unlinked to unmatched status')
      await refetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unmatch transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Quick Post from Statement item
  const handleQuickPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickPostTransaction || !effectiveBankId) return

    const amtPaisa = quickPostTransaction.debit > 0 ? quickPostTransaction.debit : quickPostTransaction.credit
    const amtRs = amtPaisa / 100

    try {
      setIsSubmitting(true)
      const res = await postQuickBankEntryFn({
        data: {
          bankAccountId: effectiveBankId,
          entryType: quickPostType,
          amountInRs: amtRs,
          narration:
            quickPostNarration.trim() ||
            `${quickPostTransaction.description} (Auto-matched)`,
          postingDate: quickPostTransaction.transactionDate.slice(0, 10),
          bankTransactionId: quickPostTransaction.id,
          refId: quickPostTransaction.referenceNo || undefined,
        },
      })
      toast.success(`Posted voucher ${res.voucherNo} and matched transaction!`)
      setQuickPostTransaction(null)
      setQuickPostNarration('')
      await refetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to quick post bank voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Finalize Reconciliation
  const handleFinalizeReconciliation = async () => {
    if (!reconSummary) return
    if (!confirm('Are you sure you want to finalize reconciliation? All matched transactions will be permanently marked as cleared.')) {
      return
    }

    try {
      setIsSubmitting(true)
      const res = await finalizeBankReconciliationFn({
        data: { bankAccountId: effectiveBankId },
      })
      toast.success(`Reconciliation approved! ${res.clearedCount} transactions marked cleared.`)
      await refetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to finalize reconciliation')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Sample CSV generator for easy testing
  const handlePasteSampleCsv = () => {
    const today = new Date().toISOString().slice(0, 10)
    const sample = `Date,Description,ReferenceNo,Deposit,Withdrawal
${today},Online Order Collection,ORD-1092,5400,0
${today},Vendor Payment Transfer,CHQ-4019,0,3200
${today},Bank Service Charge,TAX-991,0,150
${today},Direct Deposit Customer,DEP-881,12000,0`
    setImportCsvText(sample)
  }

  return (
    <div className="space-y-4">
      {/* Integrity Audit Master Banner */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg p-2.5 ${
                audit.auditPassed
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {audit.auditPassed ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Sub-Ledger & Double-Entry Integrity Audit
                </h3>
                {audit.auditPassed ? (
                  <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" /> 100% Reconciled
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-[11px]">
                    <AlertCircle className="h-3 w-3" /> Audit Discrepancy Found
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Verifies that debits equal credits across all historical vouchers and control accounts match sub-ledgers.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAudit()}
            disabled={isAuditFetching}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isAuditFetching ? 'animate-spin' : ''}`}
            />
            Run Live Audit
          </Button>
        </div>

        {/* Global Balanced Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 pt-2">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <span className="text-[11px] uppercase font-semibold text-muted-foreground">
              Global Ledger Debits
            </span>
            <div className="mt-1 font-mono text-base font-bold text-foreground">
              <MoneyText paisa={audit.totalGlobalDebit} />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <span className="text-[11px] uppercase font-semibold text-muted-foreground">
              Global Ledger Credits
            </span>
            <div className="mt-1 font-mono text-base font-bold text-foreground">
              <MoneyText paisa={audit.totalGlobalCredit} />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <span className="text-[11px] uppercase font-semibold text-muted-foreground">
              Trial Balance Variance
            </span>
            <div
              className={`mt-1 font-mono text-base font-bold ${
                audit.globalDifference === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatNPR(audit.globalDifference)}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <span className="text-[11px] uppercase font-semibold text-muted-foreground">
              Unbalanced Vouchers
            </span>
            <div
              className={`mt-1 font-mono text-base font-bold ${
                audit.unbalancedVouchersCount === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {audit.unbalancedVouchersCount} vouchers
            </div>
          </div>
        </div>

        {/* Sub-Ledger Reconciliation Table */}
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/40 text-[11px]">
                <TableHead className="w-28">Control Code</TableHead>
                <TableHead>Control Account Name</TableHead>
                <TableHead className="w-24 text-center">Parties</TableHead>
                <TableHead className="w-36 text-right">Control Balance</TableHead>
                <TableHead className="w-36 text-right">Sum of Sub-Ledgers</TableHead>
                <TableHead className="w-32 text-right">Difference</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.subLedgers.map((s) => (
                <TableRow key={s.controlAccountCode} className="border-border text-xs">
                  <TableCell className="font-mono font-semibold">
                    {s.controlAccountCode}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {s.controlAccountName}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {s.partyCount}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <MoneyText paisa={s.controlAccountBalance} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <MoneyText paisa={s.sumOfPartyBalances} />
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-bold ${
                      s.difference === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatNPR(s.difference)}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.isReconciled ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Exact
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertCircle className="h-3 w-3" /> Mismatch
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Bank Statement Reconciliation Sub-Module */}
      <div className="space-y-4 pt-2">
        {/* Header and Bank Selector Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">
                Bank Statement Reconciliation
              </h3>
              <p className="text-xs text-muted-foreground">
                Import external bank statement transactions and reconcile against General Ledger records.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="h-8 text-xs w-52"
            >
              {bankAccounts.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.bankName} ({b.accountNumber.slice(-4)})
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Statement
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoMatch}
              disabled={isSubmitting}
              className="h-8 gap-1.5 text-xs"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Auto-Match
            </Button>

            {reconSummary && reconSummary.matchedCount > 0 && (
              <Button
                size="sm"
                onClick={handleFinalizeReconciliation}
                disabled={isSubmitting}
                className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Finalize & Clear ({reconSummary.matchedCount})
              </Button>
            )}
          </div>
        </div>

        {/* Reconciliation Summary Cards */}
        {reconSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                GL Book Balance
              </span>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                <MoneyText paisa={reconSummary.glBalance} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Statement Balance
              </span>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                <MoneyText paisa={reconSummary.statementBalance} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Deposits in Transit
              </span>
              <div className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <MoneyText paisa={reconSummary.depositsInTransit} />
              </div>
              <div className="text-[10px] text-muted-foreground">In GL, not bank</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Outstanding Checks
              </span>
              <div className="mt-1 font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                <MoneyText paisa={reconSummary.outstandingPayments} />
              </div>
              <div className="text-[10px] text-muted-foreground">In GL, not bank</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Adjusted Bank Balance
              </span>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                <MoneyText paisa={reconSummary.adjustedBankBalance} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Reconciliation Difference
              </span>
              <div
                className={`mt-1 font-mono text-sm font-bold ${
                  reconSummary.reconciliationDifference === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatNPR(reconSummary.reconciliationDifference)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {reconSummary.isReconciled ? '100% Balanced' : 'Variance to match'}
              </div>
            </div>
          </div>
        )}

        {/* Two-Column Reconciliation Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Column 1: Bank Statement Transactions */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-blue-500" />
                  Bank Statement Transactions ({filteredStatementTx.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Imported directly from external bank statement.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-36">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tx…"
                    className="h-7 pl-6 text-[11px]"
                  />
                </div>

                <NativeSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-7 text-[11px] w-28"
                >
                  <NativeSelectOption value="all">All Statuses</NativeSelectOption>
                  <NativeSelectOption value="unmatched">Unmatched</NativeSelectOption>
                  <NativeSelectOption value="matched">Matched</NativeSelectOption>
                  <NativeSelectOption value="cleared">Cleared</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 text-[11px]">
                    <TableHead className="w-20">Date</TableHead>
                    <TableHead>Description / Ref</TableHead>
                    <TableHead className="w-24 text-right">Deposit</TableHead>
                    <TableHead className="w-24 text-right">Withdrawal</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-24 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStatementTx.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        No bank statement transactions found. Click &quot;Import Statement&quot; to begin.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStatementTx.map((tx) => (
                      <TableRow key={tx.id} className="border-border text-xs">
                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                          {tx.transactionDate.slice(0, 10)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground truncate max-w-[140px]" title={tx.description}>
                            {tx.description}
                          </div>
                          {tx.referenceNo && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              Ref: {tx.referenceNo}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          {tx.debit > 0 ? <MoneyText paisa={tx.debit} /> : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400 font-medium">
                          {tx.credit > 0 ? <MoneyText paisa={tx.credit} /> : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {tx.status === 'matched' ? (
                            <Badge className="bg-blue-600 text-white text-[9px]">Matched</Badge>
                          ) : tx.status === 'cleared' ? (
                            <Badge className="bg-emerald-600 text-white text-[9px]">Cleared</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/40">
                              Unmatched
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {tx.status === 'unmatched' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] gap-1"
                                  onClick={() => setMatchingTransaction(tx)}
                                >
                                  <Link2 className="h-3 w-3" /> Match
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  title="Quick Post to Ledger"
                                  onClick={() => {
                                    setQuickPostTransaction(tx)
                                    setQuickPostType(tx.debit > 0 ? 'interest' : 'bank_charges')
                                    setQuickPostNarration(tx.description)
                                  }}
                                >
                                  <Zap className="h-3 w-3" />
                                </Button>
                              </>
                            )}

                            {tx.status === 'matched' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-rose-600 hover:text-rose-700 gap-1"
                                onClick={() => handleUnmatch(tx.id)}
                              >
                                <Unlink className="h-3 w-3" /> Unlink
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Column 2: Unmatched General Ledger Journal Lines */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Landmark className="h-4 w-4 text-emerald-600" />
                  Un-reconciled General Ledger Lines ({unmatchedGLLines.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Posted vouchers to this bank account awaiting statement verification.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchUnmatchedGL()}
                className="h-7 text-xs text-muted-foreground"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 text-[11px]">
                    <TableHead className="w-20">Date</TableHead>
                    <TableHead className="w-24">Voucher No</TableHead>
                    <TableHead>Narration / Ref</TableHead>
                    <TableHead className="w-24 text-right">Debit</TableHead>
                    <TableHead className="w-24 text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedGLLines.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        All General Ledger bank entries are matched and reconciled!
                      </TableCell>
                    </TableRow>
                  ) : (
                    unmatchedGLLines.map((line) => (
                      <TableRow key={line.id} className="border-border text-xs">
                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                          {line.postingDate.slice(0, 10)}
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {line.voucherNo || line.voucherType}
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[140px]" title={line.narration || ''}>
                            {line.narration || '—'}
                          </div>
                          {line.refId && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              Ref: {line.refId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          {line.debit > 0 ? <MoneyText paisa={line.debit} /> : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400 font-medium">
                          {line.credit > 0 ? <MoneyText paisa={line.credit} /> : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Statement Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-primary" />
              Import Bank Statement Transactions
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste CSV or plain text transactions. Columns: Date (YYYY-MM-DD), Description, Ref No, Deposit, Withdrawal. Duplicate rows are automatically detected and skipped.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportStatement} className="space-y-3 pt-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePasteSampleCsv}
                className="h-6 text-[10px]"
              >
                Paste Sample CSV
              </Button>
            </div>

            <div className="space-y-1">
              <textarea
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder={`2026-11-15, Cash Deposit, DEP-101, 15000, 0\n2026-11-16, Vendor Payment, CHQ-202, 0, 4500\n2026-11-17, Bank SMS Charge, FEE-01, 0, 50`}
                rows={8}
                className="w-full rounded-md border border-border bg-muted/20 p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !importCsvText.trim()}>
                {isSubmitting ? 'Importing…' : 'Import Transactions'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog
        open={Boolean(matchingTransaction)}
        onOpenChange={(open) => !open && setMatchingTransaction(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-primary" />
              Manual Match Transaction
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select the matching General Ledger voucher line for this bank statement record.
            </DialogDescription>
          </DialogHeader>

          {matchingTransaction && (
            <form onSubmit={handleConfirmManualMatch} className="space-y-4 pt-2">
              {/* Selected Statement Record Card */}
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs">
                <div className="font-semibold text-foreground">
                  Statement Item:{' '}
                  <span className="font-mono text-primary">{matchingTransaction.description}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>Date: {matchingTransaction.transactionDate.slice(0, 10)}</span>
                  {matchingTransaction.referenceNo && <span>Ref: {matchingTransaction.referenceNo}</span>}
                  <span>
                    Amount:{' '}
                    <strong className="font-mono text-foreground">
                      {matchingTransaction.debit > 0
                        ? `Deposit ${formatNPR(matchingTransaction.debit)}`
                        : `Withdrawal ${formatNPR(matchingTransaction.credit)}`}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Eligible GL lines selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Eligible General Ledger Lines</Label>
                <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border bg-muted/40 text-[11px]">
                        <TableHead className="w-10 text-center"></TableHead>
                        <TableHead className="w-20">Date</TableHead>
                        <TableHead className="w-24">Voucher No</TableHead>
                        <TableHead>Narration</TableHead>
                        <TableHead className="w-24 text-right">Debit</TableHead>
                        <TableHead className="w-24 text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatchedGLLines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                            No eligible un-reconciled journal lines found in GL.
                          </TableCell>
                        </TableRow>
                      ) : (
                        unmatchedGLLines.map((line) => {
                          const isExactMatch =
                            (matchingTransaction.debit > 0 && line.debit === matchingTransaction.debit) ||
                            (matchingTransaction.credit > 0 && line.credit === matchingTransaction.credit)

                          return (
                            <TableRow
                              key={line.id}
                              className={`border-border text-xs cursor-pointer ${
                                selectedGLLineId === line.id
                                  ? 'bg-primary/10'
                                  : isExactMatch
                                    ? 'bg-emerald-500/5'
                                    : ''
                              }`}
                              onClick={() => setSelectedGLLineId(line.id)}
                            >
                              <TableCell className="p-2 text-center">
                                <input
                                  type="radio"
                                  name="selectedGLLine"
                                  checked={selectedGLLineId === line.id}
                                  onChange={() => setSelectedGLLineId(line.id)}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">
                                {line.postingDate.slice(0, 10)}
                              </TableCell>
                              <TableCell className="font-mono font-medium">
                                {line.voucherNo || line.voucherType}
                              </TableCell>
                              <TableCell className="truncate max-w-[140px]" title={line.narration || ''}>
                                {line.narration || '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                {line.debit > 0 ? <MoneyText paisa={line.debit} /> : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                                {line.credit > 0 ? <MoneyText paisa={line.credit} /> : '—'}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMatchingTransaction(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting || !selectedGLLineId}>
                  {isSubmitting ? 'Matching…' : 'Confirm Match'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Post Dialog */}
      <Dialog
        open={Boolean(quickPostTransaction)}
        onOpenChange={(open) => !open && setQuickPostTransaction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-blue-500" />
              Quick Post from Statement Record
            </DialogTitle>
            <DialogDescription className="text-xs">
              Recognize this statement item in accounting by posting a double-entry voucher and automatically linking it as matched.
            </DialogDescription>
          </DialogHeader>

          {quickPostTransaction && (
            <form onSubmit={handleQuickPost} className="space-y-3 pt-2">
              <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
                <div><strong>Description:</strong> {quickPostTransaction.description}</div>
                <div>
                  <strong>Amount:</strong>{' '}
                  <span className="font-mono font-bold">
                    {formatNPR(
                      quickPostTransaction.debit > 0
                        ? quickPostTransaction.debit
                        : quickPostTransaction.credit,
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Transaction Nature</Label>
                <NativeSelect
                  value={quickPostType}
                  onChange={(e) => setQuickPostType(e.target.value as any)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="bank_charges">
                    Bank Charges / Fees (Dr. Expense, Cr. Bank)
                  </NativeSelectOption>
                  <NativeSelectOption value="interest">
                    Interest Earned (Dr. Bank, Cr. Other Income)
                  </NativeSelectOption>
                  <NativeSelectOption value="deposit">
                    Cash Deposit (Dr. Bank, Cr. Cash in Hand)
                  </NativeSelectOption>
                  <NativeSelectOption value="withdrawal">
                    Cash Withdrawal (Dr. Cash in Hand, Cr. Bank)
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Voucher Narration</Label>
                <Input
                  value={quickPostNarration}
                  onChange={(e) => setQuickPostNarration(e.target.value)}
                  placeholder="Business memo"
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPostTransaction(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Posting & Matching…' : 'Post & Auto-Match'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
