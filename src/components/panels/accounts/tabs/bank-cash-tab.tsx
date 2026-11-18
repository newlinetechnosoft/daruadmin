import { useMemo, useState } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
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
  createBankAccountFn,
  postContraTransferFn,
  postQuickBankEntryFn,
  recordCashClosingFn,
} from '#/server/finance/banking.functions'
import { formatNPR } from '#/lib/money'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  Clock,
  Landmark,
  Plus,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'

export function BankCashTab() {
  const queryClient = useQueryClient()
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const { data: bankAccounts = [], refetch: refetchBanks } = useSuspenseQuery(
    adminQueries.bankAccounts(),
  )
  const { data: cashAccounts = [], refetch: refetchCash } = useSuspenseQuery(
    adminQueries.cashAccounts(),
  )
  const { data: cashHistory = [], refetch: refetchHistory } = useSuspenseQuery(
    adminQueries.cashClosingHistory(),
  )
  const { data: cashFlow, refetch: refetchCashFlow } = useSuspenseQuery(
    adminQueries.cashFlowTracking(),
  )

  // Modals
  const [isContraOpen, setIsContraOpen] = useState(false)
  const [isClosingOpen, setIsClosingOpen] = useState(false)
  const [isAddBankOpen, setIsAddBankOpen] = useState(false)
  const [isQuickBankOpen, setIsQuickBankOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculations for top liquid banner
  const totalCashBalance = useMemo(
    () => cashAccounts.reduce((sum, c) => sum + c.currentBalance, 0),
    [cashAccounts],
  )
  const totalBankBalance = useMemo(
    () => bankAccounts.reduce((sum, b) => sum + b.ledgerBalance, 0),
    [bankAccounts],
  )
  const totalLiquidFunds = totalCashBalance + totalBankBalance

  // Contra Transfer Form
  const [contraFromId, setContraFromId] = useState(cashAccounts[0]?.id || '')
  const [contraToId, setContraToId] = useState(
    bankAccounts[0]?.ledgerAccountId || '',
  )
  const [contraAmountRs, setContraAmountRs] = useState('5000')
  const [contraNarration, setContraNarration] = useState('')

  // Cash Closing Form
  const [closingCashAccountId, setClosingCashAccountId] = useState(
    cashAccounts[0]?.id || '',
  )
  const selectedClosingAccount = useMemo(
    () => cashAccounts.find((c) => c.id === closingCashAccountId) || cashAccounts[0],
    [cashAccounts, closingCashAccountId],
  )
  const expectedClosingBalance = selectedClosingAccount?.currentBalance ?? 0
  const [countedCashRs, setCountedCashRs] = useState(
    (expectedClosingBalance / 100).toFixed(2),
  )
  const [closingNotes, setClosingNotes] = useState('')

  const countedPaisa = Math.round(Number(countedCashRs || 0) * 100)
  const closingVariance = countedPaisa - expectedClosingBalance

  // Add Bank Account Form
  const [newBankName, setNewBankName] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newAccountName, setNewAccountName] = useState('Mezmani Group Pvt Ltd')
  const [newBranchName, setNewBranchName] = useState('Butwal Main Branch')
  const [newOpeningBalanceRs, setNewOpeningBalanceRs] = useState('0')

  // Quick Bank Transaction Form (Bank charges, interest, deposit, withdrawal)
  const [quickBankId, setQuickBankId] = useState(bankAccounts[0]?.id || '')
  const [quickEntryType, setQuickEntryType] = useState<
    'bank_charges' | 'interest' | 'deposit' | 'withdrawal'
  >('bank_charges')
  const [quickAmountRs, setQuickAmountRs] = useState('250')
  const [quickNarration, setQuickNarration] = useState('')
  const [quickRefId, setQuickRefId] = useState('')

  const handlePostContra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contraFromId || !contraToId) {
      toast.error('Select source and destination accounts')
      return
    }
    if (contraFromId === contraToId) {
      toast.error('Source and destination accounts must be different')
      return
    }
    const amt = Number(contraAmountRs)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid transfer amount')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await postContraTransferFn({
        data: {
          fromAccountId: contraFromId,
          toAccountId: contraToId,
          amountInRs: amt,
          narration: contraNarration.trim() || 'Internal Contra Fund Transfer',
        },
      })
      toast.success(`Contra transfer voucher ${res.voucherNo} posted successfully!`)
      setIsContraOpen(false)
      setContraNarration('')
      await Promise.all([
        refetchBanks(),
        refetchCash(),
        refetchCashFlow(),
        queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post contra transfer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCashClosing = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      const res = await recordCashClosingFn({
        data: {
          physicalCashCountedInRs: Number(countedCashRs || 0),
          notes: closingNotes.trim() || undefined,
        },
      })
      toast.success(
        `Day-end cash closing recorded! ${
          res.voucherNo ? `Balancing JV voucher: ${res.voucherNo}` : 'Count verified exact.'
        }`,
      )
      setIsClosingOpen(false)
      setClosingNotes('')
      await Promise.all([
        refetchHistory(),
        refetchCash(),
        queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record cash closing')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBankName.trim() || !newAccountNumber.trim()) {
      toast.error('Bank name and account number are required')
      return
    }

    try {
      setIsSubmitting(true)
      await createBankAccountFn({
        data: {
          bankName: newBankName.trim(),
          accountNumber: newAccountNumber.trim(),
          accountName: newAccountName.trim(),
          branchName: newBranchName.trim() || undefined,
          openingBalanceInRs: Number(newOpeningBalanceRs || 0),
        },
      })
      toast.success('Bank account created successfully')
      setIsAddBankOpen(false)
      setNewBankName('')
      setNewAccountNumber('')
      await refetchBanks()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create bank account')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickBankEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickBankId) {
      toast.error('Please select a bank account')
      return
    }
    const amt = Number(quickAmountRs)
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid positive amount')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await postQuickBankEntryFn({
        data: {
          bankAccountId: quickBankId,
          entryType: quickEntryType,
          amountInRs: amt,
          narration:
            quickNarration.trim() ||
            (quickEntryType === 'bank_charges'
              ? 'Bank service / transfer charge'
              : quickEntryType === 'interest'
                ? 'Bank account interest credit'
                : quickEntryType === 'deposit'
                  ? 'Cash deposit to bank'
                  : 'Cash withdrawal from bank'),
          refId: quickRefId.trim() || undefined,
        },
      })
      toast.success(`Bank entry posted! Voucher No: ${res.voucherNo}`)
      setIsQuickBankOpen(false)
      setQuickNarration('')
      setQuickRefId('')
      await Promise.all([
        refetchBanks(),
        refetchCash(),
        refetchCashFlow(),
        queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post quick bank entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  const transferAccounts = useMemo(() => {
    return chartOfAccounts.filter(
      (a) =>
        !a.isGroup &&
        a.isActive &&
        (a.accountType === 'cash' ||
          a.accountType === 'bank' ||
          a.code === '1011' ||
          a.code === '1012'),
    )
  }, [chartOfAccounts])

  return (
    <div className="space-y-4">
      {/* Top Liquid Funds KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cash in Hand */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total Cash in Hand
            </span>
            <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            <MoneyText paisa={totalCashBalance} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Across {cashAccounts.length} cash account(s) / tills
          </div>
        </div>

        {/* Bank Balances */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total Bank Balances
            </span>
            <div className="rounded-md bg-blue-500/10 p-1.5 text-blue-600">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
            <MoneyText paisa={totalBankBalance} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Across {bankAccounts.length} registered company bank(s)
          </div>
        </div>

        {/* Total Liquid Funds */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total Liquid Funds
            </span>
            <div className="rounded-md bg-purple-500/10 p-1.5 text-purple-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
            <MoneyText paisa={totalLiquidFunds} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Combined Cash + Bank General Ledger
          </div>
        </div>

        {/* Operating Cash Flow Movement */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Operating Net Movement
            </span>
            <div
              className={`rounded-md p-1.5 ${
                cashFlow.netOperatingCashFlow >= 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              {cashFlow.netOperatingCashFlow >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          </div>
          <div
            className={`mt-1 text-lg font-bold font-mono ${
              cashFlow.netOperatingCashFlow >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <MoneyText paisa={cashFlow.netOperatingCashFlow} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            In: {formatNPR(cashFlow.operatingInflows)} &bull; Out: {formatNPR(cashFlow.operatingOutflows)}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Cash & Bank Management
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCountedCashRs((expectedClosingBalance / 100).toFixed(2))
              setIsClosingOpen(true)
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <Scale className="h-3.5 w-3.5 text-amber-500" />
            Cash Closing (Z-Report)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsQuickBankOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Zap className="h-3.5 w-3.5 text-blue-500" />
            Quick Bank Entry
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsContraOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Contra Transfer
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddBankOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Bank Account
          </Button>
        </div>
      </div>

      {/* Multiple Cash Accounts Register */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 text-emerald-600" />
            Cash Registers & Tills ({cashAccounts.length})
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cashAccounts.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-card p-3 space-y-2 hover:border-emerald-500/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <span className="font-mono text-muted-foreground">{c.code}</span>
                    <span>{c.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-0.5">
                    Dr: {formatNPR(c.totalDebit)} &bull; Cr: {formatNPR(c.totalCredit)}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                >
                  Active Cash
                </Badge>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Ledger Balance:</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  <MoneyText paisa={c.currentBalance} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multiple Bank Accounts Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 text-blue-600" />
            Corporate Bank Accounts ({bankAccounts.length})
          </h4>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.length === 0 ? (
            <div className="col-span-full rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No bank accounts registered yet. Click &quot;Add Bank Account&quot; to set up your company bank.
            </div>
          ) : (
            bankAccounts.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {b.bankName}
                    </h4>
                    <p className="text-xs text-muted-foreground">{b.branchName || 'Main Branch'}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      b.isActive
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px]'
                        : 'text-[10px]'
                    }
                  >
                    {b.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Account No:</span>
                    <span className="font-mono font-semibold">{b.accountNumber}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Title:</span>
                    <span className="truncate max-w-[150px]">{b.accountName}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-0.5 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground">GL Account:</span>
                    <span className="font-mono">{b.ledgerAccountCode || '1012'}</span>
                  </div>
                </div>

                <div className="pt-1 flex items-baseline justify-between border-t border-border">
                  <span className="text-xs text-muted-foreground">Ledger Balance:</span>
                  <span className="font-mono text-base font-bold text-foreground">
                    <MoneyText paisa={b.ledgerBalance} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Cash Flow Activity Table */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          Recent Cash & Bank Activity Feed
        </h4>

        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/30 text-[11px]">
                <TableHead className="w-24 text-xs">Date</TableHead>
                <TableHead className="w-28 text-xs">Voucher No</TableHead>
                <TableHead className="w-48 text-xs">Account</TableHead>
                <TableHead className="text-xs">Narration</TableHead>
                <TableHead className="w-28 text-right text-xs">Inflow (Dr)</TableHead>
                <TableHead className="w-28 text-right text-xs">Outflow (Cr)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashFlow.recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    No cash or bank transactions recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                cashFlow.recentTransactions.map((tx) => (
                  <TableRow key={tx.id} className="border-border text-xs">
                    <TableCell className="font-mono text-muted-foreground">
                      {tx.postingDate.slice(0, 10)}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {tx.voucherNo || 'Draft'}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {tx.accountCode} - {tx.accountName}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={tx.narration || ''}>
                      {tx.narration || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {tx.debit > 0 ? <MoneyText paisa={tx.debit} /> : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      {tx.credit > 0 ? <MoneyText paisa={tx.credit} /> : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Cash Closing (Z-Report) History */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-amber-500" />
          Day-End Cash Closing (Z-Reports) & Audited Variances
        </h4>

        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-28 text-xs">Voucher No</TableHead>
                <TableHead className="w-24 text-xs">Date</TableHead>
                <TableHead className="text-xs">Notes / Narration</TableHead>
                <TableHead className="w-28 text-right text-xs">Expected Cash</TableHead>
                <TableHead className="w-28 text-right text-xs">Physical Count</TableHead>
                <TableHead className="w-28 text-right text-xs">Variance</TableHead>
                <TableHead className="w-28 text-xs">Audited By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashHistory.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    No cash closing reports recorded yet. Perform a day-end cash closing to audit physical cash.
                  </TableCell>
                </TableRow>
              ) : (
                cashHistory.map((c) => (
                  <TableRow key={c.id} className="border-border text-xs">
                    <TableCell className="font-mono font-semibold">
                      {c.voucherNo || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {c.postingDate.slice(0, 10)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={c.narration}>
                      {c.narration}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <MoneyText paisa={c.expectedCash} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <MoneyText paisa={c.physicalCashCounted} />
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <MoneyText
                        paisa={c.variance}
                        className={
                          c.variance === 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.createdBy}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Contra Transfer Dialog */}
      <Dialog open={isContraOpen} onOpenChange={setIsContraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              Contra Fund Transfer (Cash / Bank)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Transfer funds between Cash in Hand and Bank accounts without affecting income or expenses. Creates a CV (Contra Voucher).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostContra} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Transfer From (Credit Account)</Label>
              <NativeSelect
                value={contraFromId}
                onChange={(e) => setContraFromId(e.target.value)}
                className="h-8 text-xs"
              >
                {transferAccounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Transfer To (Debit Account)</Label>
              <NativeSelect
                value={contraToId}
                onChange={(e) => setContraToId(e.target.value)}
                className="h-8 text-xs"
              >
                {transferAccounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Transfer Amount (NPR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={contraAmountRs}
                onChange={(e) => setContraAmountRs(e.target.value)}
                className="h-8 text-right font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Narration / Memo</Label>
              <Input
                value={contraNarration}
                onChange={(e) => setContraNarration(e.target.value)}
                placeholder="e.g. Cash deposit to NIC Asia Bank"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsContraOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting…' : 'Post Transfer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Bank Entry Dialog */}
      <Dialog open={isQuickBankOpen} onOpenChange={setIsQuickBankOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-blue-500" />
              Quick Bank Transaction Posting
            </DialogTitle>
            <DialogDescription className="text-xs">
              Quickly recognize bank service charges, account interest, direct cash deposits or withdrawals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickBankEntry} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Bank Account</Label>
              <NativeSelect
                value={quickBankId}
                onChange={(e) => setQuickBankId(e.target.value)}
                className="h-8 text-xs"
              >
                {bankAccounts.map((b) => (
                  <NativeSelectOption key={b.id} value={b.id}>
                    {b.bankName} ({b.accountNumber.slice(-4)})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Transaction Type</Label>
              <NativeSelect
                value={quickEntryType}
                onChange={(e) => setQuickEntryType(e.target.value as any)}
                className="h-8 text-xs"
              >
                <NativeSelectOption value="bank_charges">
                  Bank Charges / SMS / Service Fee (Dr. Expense, Cr. Bank)
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
              <Label className="text-xs">Amount (NPR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={quickAmountRs}
                onChange={(e) => setQuickAmountRs(e.target.value)}
                className="h-8 text-right font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference # (Optional)</Label>
              <Input
                value={quickRefId}
                onChange={(e) => setQuickRefId(e.target.value)}
                placeholder="Cheque #, deposit slip, or statement ref"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Narration / Memo</Label>
              <Input
                value={quickNarration}
                onChange={(e) => setQuickNarration(e.target.value)}
                placeholder="e.g. Quarterly account maintenance charge"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsQuickBankOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting…' : 'Post Bank Voucher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Day-End Cash Closing (Z-Report) Dialog */}
      <Dialog open={isClosingOpen} onOpenChange={setIsClosingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Scale className="h-4 w-4 text-primary" />
              Day-End Cash Closing (Z-Report)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Audit the physical cash in the till and match against system ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCashClosing} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Select Cash Account / Register</Label>
              <NativeSelect
                value={closingCashAccountId}
                onChange={(e) => {
                  setClosingCashAccountId(e.target.value)
                  const acc = cashAccounts.find((c) => c.id === e.target.value)
                  if (acc) {
                    setCountedCashRs((acc.currentBalance / 100).toFixed(2))
                  }
                }}
                className="h-8 text-xs"
              >
                {cashAccounts.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.code} - {c.name} ({formatNPR(c.currentBalance)})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Expected Ledger Balance:</span>
                <span className="font-mono font-bold">{formatNPR(expectedClosingBalance)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Physical Cash Counted:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatNPR(countedPaisa)}
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-border pt-1">
                <span className="text-muted-foreground">Variance:</span>
                <span
                  className={`font-mono font-bold ${
                    closingVariance === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatNPR(closingVariance)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Physical Cash Counted (NPR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={countedCashRs}
                onChange={(e) => setCountedCashRs(e.target.value)}
                className="h-8 text-right font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Explanations</Label>
              <Input
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Audit notes or reason for shortage/excess…"
                className="h-8 text-xs"
              />
            </div>

            {closingVariance !== 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Notice: A non-zero variance will automatically generate a balancing JV to adjust the cash ledger.
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClosingOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Recording…' : 'Record Cash Closing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Bank Account Dialog */}
      <Dialog open={isAddBankOpen} onOpenChange={setIsAddBankOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              Add Company Bank Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register a corporate bank account with an opening balance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBank} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Bank Name</Label>
              <Input
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="e.g. NIC Asia Bank Ltd"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Account Number</Label>
              <Input
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value)}
                placeholder="e.g. 0123456789012345"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Account Name (Title)</Label>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Branch Location</Label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Opening Balance (NPR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newOpeningBalanceRs}
                onChange={(e) => setNewOpeningBalanceRs(e.target.value)}
                className="h-8 text-right font-mono text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddBankOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Save Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
