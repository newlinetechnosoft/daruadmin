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
  approveExpenseFn,
  createExpenseCategoryFn,
  createExpenseFn,
  payExpenseFn,
  rejectExpenseFn,
} from '#/server/finance/expenses.functions'
import { formatNPR } from '#/lib/money'
import { formatDualDate } from '#/lib/nepal-date'
import { toast } from 'sonner'
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Plus,
  Receipt,
  Search,
  Tag,
  XCircle,
} from 'lucide-react'
import type { ExpenseItem } from '#/server/finance/expenses.queries'

export function ExpensesTab() {
  const queryClient = useQueryClient()

  // Base financial metadata
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const { data: branches = [] } = useSuspenseQuery(adminQueries.branches())
  const { data: bankAccounts = [] } = useSuspenseQuery(adminQueries.bankAccounts())
  const { data: cashAccounts = [] } = useSuspenseQuery(adminQueries.cashAccounts())
  const { data: categories = [], refetch: refetchCategories } = useSuspenseQuery(
    adminQueries.expenseCategories(),
  )

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Query expenses with filters
  const { data: expenses = [], refetch: refetchExpenses } = useSuspenseQuery(
    adminQueries.expenses({
      status: statusFilter === 'all' ? undefined : statusFilter,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      branchId: branchFilter === 'all' ? undefined : branchFilter,
      search: searchQuery.trim() || undefined,
    }),
  )

  // Dialogs state
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false)
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Details Modal state
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const { data: expenseDetails, isLoading: isLoadingDetails } = useQuery(
    adminQueries.expenseDetails(selectedExpenseId || ''),
  )

  // Disburse Modal state
  const [disbursingExpense, setDisbursingExpense] = useState<ExpenseItem | null>(null)
  const [disbursePaymentAccountId, setDisbursePaymentAccountId] = useState('')
  const [disbursePaymentMethod, setDisbursePaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'esewa'>('cash')
  const [disbursePaymentRef, setDisbursePaymentRef] = useState('')
  const [disburseTdsRs, setDisburseTdsRs] = useState('0')
  const [disburseDate, setDisburseDate] = useState(new Date().toISOString().slice(0, 10))

  // Reject Modal state
  const [rejectingExpense, setRejectingExpense] = useState<ExpenseItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Expense accounts from COA
  const expenseAccounts = useMemo(
    () =>
      chartOfAccounts.filter(
        (a) => a.rootType === 'expense' && !a.isGroup && a.isActive,
      ),
    [chartOfAccounts],
  )

  // Payment accounts (Cash registers & Bank accounts)
  const allPaymentAccounts = useMemo(() => {
    const list: Array<{ id: string; label: string; type: 'cash' | 'bank'; balancePaisa: number }> = []

    // Add cash accounts
    for (const c of cashAccounts) {
      list.push({
        id: c.id,
        label: `${c.code} - ${c.name} (Cash Vault)`,
        type: 'cash',
        balancePaisa: c.currentBalance,
      })
    }

    // Add bank accounts
    for (const b of bankAccounts) {
      if (b.ledgerAccountId) {
        list.push({
          id: b.ledgerAccountId,
          label: `${b.ledgerAccountCode || '1012'} - ${b.bankName} (${b.accountNumber})`,
          type: 'bank',
          balancePaisa: b.ledgerBalance,
        })
      }
    }

    // Fallback to COA cash/bank if list is empty
    if (list.length === 0) {
      chartOfAccounts
        .filter(
          (a) =>
            !a.isGroup &&
            a.isActive &&
            (a.accountType === 'cash' ||
              a.accountType === 'bank' ||
              a.code === '1011' ||
              a.code === '1012'),
        )
        .forEach((a) => {
          list.push({
            id: a.id,
            label: `${a.code} - ${a.name}`,
            type: a.accountType === 'bank' ? 'bank' : 'cash',
            balancePaisa: 0,
          })
        })
    }

    return list
  }, [cashAccounts, bankAccounts, chartOfAccounts])

  // New Expense Claim Form State
  const [categoryAccountId, setCategoryAccountId] = useState(expenseAccounts[0]?.id || '')
  const [claimBranchId, setClaimBranchId] = useState(branches[0]?.id || '')
  const [claimCostCenter, setClaimCostCenter] = useState<'general' | 'liquor' | 'food' | 'delivery'>('general')
  const [claimDate, setClaimDate] = useState(new Date().toISOString().slice(0, 10))
  const [vendorName, setVendorName] = useState('')
  const [vendorPan, setVendorPan] = useState('')
  const [notes, setNotes] = useState('')
  const [amountRs, setAmountRs] = useState('2500')
  const [hasVat, setHasVat] = useState(false)
  const [tdsRateType, setTdsRateType] = useState<'none' | '1.5' | '10' | '15' | 'custom'>('none')
  const [customTdsRs, setCustomTdsRs] = useState('0')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'esewa'>('cash')

  // New Category Form State
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [newCatAccountId, setNewCatAccountId] = useState(expenseAccounts[0]?.id || '')

  // Tax calculations for New Claim
  const grossAmountPaisa = Math.round(Number(amountRs || 0) * 100)
  const taxAmountPaisa = hasVat ? Math.round(grossAmountPaisa * 0.13) : 0
  const calculatedTdsPaisa = useMemo(() => {
    if (tdsRateType === '1.5') return Math.round(grossAmountPaisa * 0.015)
    if (tdsRateType === '10') return Math.round(grossAmountPaisa * 0.10)
    if (tdsRateType === '15') return Math.round(grossAmountPaisa * 0.15)
    if (tdsRateType === 'custom') return Math.round(Number(customTdsRs || 0) * 100)
    return 0
  }, [tdsRateType, grossAmountPaisa, customTdsRs])

  const netPayablePaisa = grossAmountPaisa + taxAmountPaisa - calculatedTdsPaisa

  // KPI Totals
  const totalApproved = useMemo(
    () =>
      expenses
        .filter((e) => e.status === 'approved' || e.status === 'paid')
        .reduce((sum, e) => sum + e.amount + e.taxAmount, 0),
    [expenses],
  )

  const pendingClaims = useMemo(
    () => expenses.filter((e) => e.status === 'submitted'),
    [expenses],
  )
  const totalPending = useMemo(
    () => pendingClaims.reduce((sum, e) => sum + e.amount + e.taxAmount, 0),
    [pendingClaims],
  )

  const settledExpenses = useMemo(
    () => expenses.filter((e) => e.status === 'paid'),
    [expenses],
  )
  const totalPaid = useMemo(
    () => settledExpenses.reduce((sum, e) => sum + e.amount + e.taxAmount, 0),
    [settledExpenses],
  )

  const totalVatClaimed = useMemo(
    () =>
      expenses
        .filter((e) => e.status === 'paid' && e.taxAmount > 0)
        .reduce((sum, e) => sum + e.taxAmount, 0),
    [expenses],
  )

  // Actions
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notes.trim()) {
      toast.error('Description or expense memo is required')
      return
    }
    const amt = Number(amountRs)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid expense gross amount')
      return
    }

    const resolvedAccountId = categoryAccountId || expenseAccounts[0]?.id
    if (!resolvedAccountId) {
      toast.error('Select a valid expense ledger account')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await createExpenseFn({
        data: {
          categoryAccountId: resolvedAccountId,
          branchId: claimBranchId || undefined,
          costCenterId: claimCostCenter || undefined,
          expenseDate: claimDate ? new Date(claimDate).toISOString() : undefined,
          vendorName: vendorName.trim() || undefined,
          vendorPan: vendorPan.trim() || undefined,
          notes: notes.trim(),
          amountInRs: amt,
          taxAmountInRs: hasVat ? Math.round(amt * 0.13 * 100) / 100 : 0,
          paymentMethod,
          receiptUrls: receiptUrl.trim() ? [receiptUrl.trim()] : [],
        },
      })
      toast.success(`Expense claim ${res.expenseNumber} submitted for approval`)
      setIsNewExpenseOpen(false)
      setNotes('')
      setVendorName('')
      setVendorPan('')
      setReceiptUrl('')
      setHasVat(false)
      setTdsRateType('none')
      await refetchExpenses()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit expense claim')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      setIsSubmitting(true)
      await createExpenseCategoryFn({
        data: {
          name: newCatName.trim(),
          description: newCatDesc.trim() || undefined,
          defaultAccountId: newCatAccountId || undefined,
        },
      })
      toast.success('Expense category created successfully')
      setIsNewCategoryOpen(false)
      setNewCatName('')
      setNewCatDesc('')
      await refetchCategories()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create category')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = async (expenseId: string) => {
    try {
      setIsSubmitting(true)
      await approveExpenseFn({ data: { expenseId } })
      toast.success('Expense claim approved. Ready for cash/bank disbursement.')
      await refetchExpenses()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve expense')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openDisburseModal = (expense: ExpenseItem) => {
    setDisbursingExpense(expense)
    setDisbursePaymentMethod(
      (expense.paymentMethod as any) || 'cash',
    )
    setDisbursePaymentRef(expense.paymentReference || '')
    setDisburseDate(new Date().toISOString().slice(0, 10))

    // Match payment account
    const isBank = expense.paymentMethod === 'bank_transfer'
    const matched = allPaymentAccounts.find((p) =>
      isBank ? p.type === 'bank' : p.type === 'cash',
    )
    setDisbursePaymentAccountId(matched ? matched.id : allPaymentAccounts[0]?.id || '')
    setDisburseTdsRs('0')
  }

  const handleDisbursePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disbursingExpense) return

    if (!disbursePaymentAccountId) {
      toast.error('Please select a payment cash register or bank account')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await payExpenseFn({
        data: {
          expenseId: disbursingExpense.id,
          paymentAccountId: disbursePaymentAccountId,
          paymentMethod: disbursePaymentMethod,
          paymentReference: disbursePaymentRef.trim() || undefined,
          tdsAmountInRs: Number(disburseTdsRs || 0) > 0 ? Number(disburseTdsRs) : undefined,
          postingDate: disburseDate ? new Date(disburseDate).toISOString() : undefined,
        },
      })

      toast.success(
        `Expense settled! Payment Voucher ${res.voucherNo || 'PV'} posted to General Ledger.`,
      )
      setDisbursingExpense(null)
      await Promise.all([
        refetchExpenses(),
        queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'cash-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'bank-accounts'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disburse payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingExpense) return

    try {
      setIsSubmitting(true)
      await rejectExpenseFn({
        data: {
          expenseId: rejectingExpense.id,
          reason: rejectReason.trim() || undefined,
        },
      })
      toast.success(`Expense ${rejectingExpense.expenseNumber} rejected`)
      setRejectingExpense(null)
      setRejectReason('')
      await refetchExpenses()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject expense')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1 text-[10px]">
            <Clock className="h-3 w-3" /> Submitted
          </Badge>
        )
      case 'approved':
        return (
          <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400 gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </Badge>
        )
      case 'paid':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Settled / Paid
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 gap-1 text-[10px]">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">
              Total Approved Expenses
            </span>
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-foreground">
            <MoneyText paisa={totalApproved} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Operational & administrative bills approved
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">
              Pending Claims
            </span>
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-amber-600 dark:text-amber-400">
              {pendingClaims.length}
            </span>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
            <MoneyText paisa={totalPending} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Awaiting manager verification & approval
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">
              Disbursed / Settled
            </span>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {settledExpenses.length}
            </span>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            <MoneyText paisa={totalPaid} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Paid out via Cash or Bank with posted vouchers
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">
              VAT Input Tax Credit
            </span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
            <MoneyText paisa={totalVatClaimed} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            13% VAT booked to IRD tax credit ledger
          </p>
        </div>
      </div>

      {/* Filter and Action Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Status Filter */}
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs w-36"
          >
            <NativeSelectOption value="all">All Statuses</NativeSelectOption>
            <NativeSelectOption value="submitted">Submitted</NativeSelectOption>
            <NativeSelectOption value="approved">Approved</NativeSelectOption>
            <NativeSelectOption value="paid">Settled / Paid</NativeSelectOption>
            <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
          </NativeSelect>

          {/* Category Filter */}
          <NativeSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 text-xs w-40"
          >
            <NativeSelectOption value="all">All Categories</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {/* Branch Filter */}
          <NativeSelect
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 text-xs w-36"
          >
            <NativeSelectOption value="all">All Branches</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.code} - {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewCategoryOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Tag className="h-3.5 w-3.5" />
            Add Category
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (expenseAccounts.length > 0 && !categoryAccountId) {
                setCategoryAccountId(expenseAccounts[0].id)
              }
              if (branches.length > 0 && !claimBranchId) {
                setClaimBranchId(branches[0].id)
              }
              setIsNewExpenseOpen(true)
            }}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            New Expense Claim
          </Button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/40">
              <TableHead className="w-28 text-xs font-bold">Expense No</TableHead>
              <TableHead className="w-36 text-xs font-bold">Category Account</TableHead>
              <TableHead className="w-36 text-xs font-bold">Vendor / Beneficiary</TableHead>
              <TableHead className="text-xs font-bold">Description / Memo</TableHead>
              <TableHead className="w-24 text-xs font-bold">Branch</TableHead>
              <TableHead className="w-28 text-xs font-bold">Date</TableHead>
              <TableHead className="w-32 text-right text-xs font-bold">Amount (NPR)</TableHead>
              <TableHead className="w-24 text-center text-xs font-bold">Status</TableHead>
              <TableHead className="w-28 text-xs font-bold">Voucher No</TableHead>
              <TableHead className="w-40 text-right text-xs font-bold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-12 text-center text-xs text-muted-foreground"
                >
                  <Receipt className="mx-auto h-8 w-8 opacity-20 mb-2" />
                  No expense records match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id} className="border-border text-xs hover:bg-muted/30">
                  <TableCell className="font-mono font-semibold text-primary">
                    {e.expenseNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-normal truncate max-w-[130px]" title={e.categoryAccountName}>
                      {e.categoryAccountName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[140px]" title={e.vendorName || ''}>
                    {e.vendorName ? (
                      <span className="font-medium text-foreground">{e.vendorName}</span>
                    ) : (
                      '—'
                    )}
                    {e.vendorPan && (
                      <span className="block text-[10px] font-mono text-muted-foreground">
                        PAN: {e.vendorPan}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={e.notes || ''}>
                    {e.notes || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[11px]">
                    {e.branchName || 'Head Office'}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-[11px]">
                    {e.expenseDate.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    <MoneyText paisa={e.amount + e.taxAmount} />
                    {e.taxAmount > 0 && (
                      <span className="block text-[10px] font-normal text-blue-600 dark:text-blue-400">
                        +13% VAT
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(e.status)}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {e.voucherNo ? (
                      <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                        {e.voucherNo}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="View Details"
                        onClick={() => setSelectedExpenseId(e.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>

                      {e.status === 'submitted' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 border-blue-500/30"
                            disabled={isSubmitting}
                            onClick={() => handleApprove(e.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                            disabled={isSubmitting}
                            onClick={() => {
                              setRejectingExpense(e)
                              setRejectReason('')
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {e.status === 'approved' && (
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                          disabled={isSubmitting}
                          onClick={() => openDisburseModal(e)}
                        >
                          <CreditCard className="h-3 w-3" />
                          Disburse
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

      {/* New Expense Claim Dialog */}
      <Dialog open={isNewExpenseOpen} onOpenChange={setIsNewExpenseOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-4 w-4 text-primary" />
              Submit Expense Claim
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record an operational, administrative, or procurement expense with VAT and TDS compliance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateExpense} className="space-y-3.5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expense Account</Label>
                <NativeSelect
                  value={categoryAccountId}
                  onChange={(e) => setCategoryAccountId(e.target.value)}
                  className="h-8 text-xs"
                >
                  {expenseAccounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Company Branch</Label>
                <NativeSelect
                  value={claimBranchId}
                  onChange={(e) => setClaimBranchId(e.target.value)}
                  className="h-8 text-xs"
                >
                  {branches.map((b) => (
                    <NativeSelectOption key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cost Center</Label>
                <NativeSelect
                  value={claimCostCenter}
                  onChange={(e) => setClaimCostCenter(e.target.value as any)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="general">General Administration</NativeSelectOption>
                  <NativeSelectOption value="liquor">Liquor Operations</NativeSelectOption>
                  <NativeSelectOption value="food">Food Operations</NativeSelectOption>
                  <NativeSelectOption value="delivery">Fulfillment & Delivery</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expense Date</Label>
                <Input
                  type="date"
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vendor / Beneficiary</Label>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Nepal Telecom, Bhatbhateni, Landlord"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vendor PAN / VAT No (Optional)</Label>
                <Input
                  value={vendorPan}
                  onChange={(e) => setVendorPan(e.target.value)}
                  placeholder="e.g. 601234567"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description / Purpose</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Office internet connection charges for Shrawan"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Gross Amount (NPR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountRs}
                  onChange={(e) => setAmountRs(e.target.value)}
                  className="h-8 text-right font-mono text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Preferred Payment Method</Label>
                <NativeSelect
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="cash">Cash in Hand</NativeSelectOption>
                  <NativeSelectOption value="bank_transfer">Bank Transfer</NativeSelectOption>
                  <NativeSelectOption value="cheque">Account Payee Cheque</NativeSelectOption>
                  <NativeSelectOption value="esewa">eSewa / Digital Wallet</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            {/* Tax Details Accordion / Box */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasVatCheck"
                    checked={hasVat}
                    onChange={(e) => setHasVat(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <label htmlFor="hasVatCheck" className="text-xs font-medium cursor-pointer">
                    Tax Invoice: Includes 13% VAT Bill
                  </label>
                </div>
                {hasVat && (
                  <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30">
                    Input Tax Credit: {formatNPR(taxAmountPaisa)}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">TDS Withholding Tax Deduction</Label>
                <NativeSelect
                  value={tdsRateType}
                  onChange={(e) => setTdsRateType(e.target.value as any)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="none">No TDS Withholding (0%)</NativeSelectOption>
                  <NativeSelectOption value="1.5">1.5% - Goods Procurement & Contract Work (§87)</NativeSelectOption>
                  <NativeSelectOption value="10">10% - Building / Vehicle Rent (§88)</NativeSelectOption>
                  <NativeSelectOption value="15">15% - Professional, Audit & Consultancy (§88)</NativeSelectOption>
                  <NativeSelectOption value="custom">Custom TDS Amount</NativeSelectOption>
                </NativeSelect>
              </div>

              {tdsRateType === 'custom' && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Custom TDS Amount (NPR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customTdsRs}
                    onChange={(e) => setCustomTdsRs(e.target.value)}
                    className="h-8 text-right font-mono text-xs"
                  />
                </div>
              )}

              {/* Real-time financial summary */}
              <div className="rounded border border-border bg-background p-2.5 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Expense:</span>
                  <span className="font-mono">{formatNPR(grossAmountPaisa)}</span>
                </div>
                {hasVat && (
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>13% VAT Input Credit (Dr. 2022):</span>
                    <span className="font-mono">+{formatNPR(taxAmountPaisa)}</span>
                  </div>
                )}
                {calculatedTdsPaisa > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>TDS Withheld (Cr. 2023):</span>
                    <span className="font-mono">-{formatNPR(calculatedTdsPaisa)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-border pt-1.5 text-foreground">
                  <span>Net Cash Disbursement:</span>
                  <span className="font-mono text-sm text-primary">{formatNPR(netPayablePaisa)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Receipt / Bill Document URL (Optional)</Label>
              <Input
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://... (Cloud storage or receipt link)"
                className="h-8 text-xs font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewExpenseOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="font-semibold">
                {isSubmitting ? 'Submitting…' : 'Submit Claim'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Disburse Payment Modal */}
      <Dialog open={!!disbursingExpense} onOpenChange={(open) => !open && setDisbursingExpense(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Disburse Expense Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select disbursement account. This immediately posts a double-entry Payment Voucher (PV).
            </DialogDescription>
          </DialogHeader>

          {disbursingExpense && (
            <form onSubmit={handleDisbursePayment} className="space-y-3.5 pt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-muted-foreground">Expense Claim:</span>
                  <span className="font-semibold">{disbursingExpense.expenseNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">{disbursingExpense.categoryAccountName}</span>
                </div>
                {disbursingExpense.vendorName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span>{disbursingExpense.vendorName}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1 font-bold">
                  <span>Gross Claim Amount:</span>
                  <span className="font-mono">{formatNPR(disbursingExpense.amount + disbursingExpense.taxAmount)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Disburse From (Cash / Bank Account)</Label>
                <NativeSelect
                  value={disbursePaymentAccountId}
                  onChange={(e) => setDisbursePaymentAccountId(e.target.value)}
                  className="h-8 text-xs font-mono"
                >
                  {allPaymentAccounts.map((acc) => (
                    <NativeSelectOption key={acc.id} value={acc.id}>
                      {acc.label} [Bal: {formatNPR(acc.balancePaisa)}]
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <NativeSelect
                    value={disbursePaymentMethod}
                    onChange={(e) => setDisbursePaymentMethod(e.target.value as any)}
                    className="h-8 text-xs"
                  >
                    <NativeSelectOption value="cash">Cash in Hand</NativeSelectOption>
                    <NativeSelectOption value="bank_transfer">Bank Transfer</NativeSelectOption>
                    <NativeSelectOption value="cheque">Cheque</NativeSelectOption>
                    <NativeSelectOption value="esewa">eSewa</NativeSelectOption>
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Payment Date</Label>
                  <Input
                    type="date"
                    value={disburseDate}
                    onChange={(e) => setDisburseDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payment Reference / Cheque No</Label>
                <Input
                  value={disbursePaymentRef}
                  onChange={(e) => setDisbursePaymentRef(e.target.value)}
                  placeholder="e.g. CHQ-991204 or Bank Ref #88129"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">TDS Deduction (NPR, if applicable)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={disburseTdsRs}
                  onChange={(e) => setDisburseTdsRs(e.target.value)}
                  className="h-8 text-right font-mono text-xs"
                  placeholder="0.00"
                />
                <span className="text-[10px] text-muted-foreground">
                  Withheld TDS is credited to TDS Payable account (acc_2023)
                </span>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisbursingExpense(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isSubmitting ? 'Posting Voucher…' : 'Confirm & Disburse'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Expense Dialog */}
      <Dialog open={!!rejectingExpense} onOpenChange={(open) => !open && setRejectingExpense(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-rose-600">
              <XCircle className="h-4 w-4" />
              Reject Expense Claim
            </DialogTitle>
            <DialogDescription className="text-xs">
              State the rejection reason for expense {rejectingExpense?.expenseNumber}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReject} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reason for Rejection</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Missing valid tax invoice, duplicate claim, etc."
                className="h-8 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectingExpense(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={isSubmitting || !rejectReason.trim()}
              >
                {isSubmitting ? 'Rejecting…' : 'Reject Claim'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Details Drill-down Modal */}
      <Dialog open={!!selectedExpenseId} onOpenChange={(open) => !open && setSelectedExpenseId(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Expense Details Drill-down
              </DialogTitle>
              {expenseDetails && getStatusBadge(expenseDetails.status)}
            </div>
            <DialogDescription className="text-xs">
              Complete claim breakdown, maker-checker timeline, and posted double-entry voucher.
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading expense details…
            </div>
          ) : expenseDetails ? (
            <div className="space-y-4 pt-2 text-xs">
              {/* Header Card */}
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-primary">
                    {expenseDetails.expenseNumber}
                  </span>
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {formatDualDate(expenseDetails.expenseDate)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Category Account</span>
                    <span className="font-semibold">{expenseDetails.categoryAccountName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Branch / Cost Center</span>
                    <span className="font-semibold">
                      {expenseDetails.branchName || 'Head Office'} • {expenseDetails.costCenterName || 'General'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Vendor / Beneficiary</span>
                    <span className="font-semibold">{expenseDetails.vendorName || 'Not specified'}</span>
                    {expenseDetails.vendorPan && (
                      <span className="block text-[10px] font-mono text-muted-foreground">
                        PAN: {expenseDetails.vendorPan}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Payment Method</span>
                    <span className="capitalize font-semibold">{expenseDetails.paymentMethod || 'cash'}</span>
                    {expenseDetails.paymentReference && (
                      <span className="block text-[10px] font-mono text-muted-foreground">
                        Ref: {expenseDetails.paymentReference}
                      </span>
                    )}
                  </div>
                </div>

                {expenseDetails.notes && (
                  <div className="pt-1 border-t border-border">
                    <span className="text-muted-foreground block text-[10px]">Description & Notes:</span>
                    <p className="mt-0.5 text-foreground">{expenseDetails.notes}</p>
                  </div>
                )}
              </div>

              {/* Financial Breakdown Table */}
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm space-y-2">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                  Financial Breakdown
                </span>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Expense Amount:</span>
                    <span className="font-mono font-semibold">{formatNPR(expenseDetails.amount)}</span>
                  </div>
                  {expenseDetails.taxAmount > 0 && (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400">
                      <span>13% VAT Input Tax Credit (acc_2022):</span>
                      <span className="font-mono font-semibold">+{formatNPR(expenseDetails.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t border-border pt-1 text-foreground">
                    <span>Total Expense:</span>
                    <span className="font-mono">{formatNPR(expenseDetails.amount + expenseDetails.taxAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Attached Receipts */}
              {expenseDetails.receiptUrls && expenseDetails.receiptUrls.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3 shadow-sm space-y-2">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">
                    Supporting Receipts & Invoices
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {expenseDetails.receiptUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Receipt Document {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Maker-Checker Audit Trail */}
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm space-y-2">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                  Audit History
                </span>
                <div className="space-y-1.5 pt-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Submitted by:</span>
                    <span>
                      <strong>{expenseDetails.submittedBy}</strong>
                      {expenseDetails.submittedAt && ` on ${expenseDetails.submittedAt.slice(0, 10)}`}
                    </span>
                  </div>
                  {expenseDetails.approvedBy && (
                    <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                      <span>Approved by:</span>
                      <span>
                        <strong>{expenseDetails.approvedBy}</strong>
                        {expenseDetails.approvedAt && ` on ${expenseDetails.approvedAt.slice(0, 10)}`}
                      </span>
                    </div>
                  )}
                  {expenseDetails.paidBy && (
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Paid / Disbursed by:</span>
                      <span>
                        <strong>{expenseDetails.paidBy}</strong>
                        {expenseDetails.paidAt && ` on ${expenseDetails.paidAt.slice(0, 10)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Double-Entry Journal Voucher */}
              {expenseDetails.voucherNo && (
                <div className="rounded-lg border border-border bg-card p-3 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">
                      Linked General Ledger Voucher
                    </span>
                    <Badge variant="outline" className="font-mono text-xs bg-muted font-bold">
                      {expenseDetails.voucherNo} ({expenseDetails.voucherType || 'PV'})
                    </Badge>
                  </div>

                  {expenseDetails.journalLines && expenseDetails.journalLines.length > 0 && (
                    <div className="mt-2 rounded border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border bg-muted/40 text-[10px]">
                            <TableHead className="w-20 font-bold">Account</TableHead>
                            <TableHead className="font-bold">Account Name</TableHead>
                            <TableHead className="w-24 text-right font-bold">Debit (NPR)</TableHead>
                            <TableHead className="w-24 text-right font-bold">Credit (NPR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenseDetails.journalLines.map((line) => (
                            <TableRow key={line.id} className="border-border text-[11px]">
                              <TableCell className="font-mono">{line.accountCode}</TableCell>
                              <TableCell className="truncate max-w-[150px]">{line.accountName}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {line.debit > 0 ? formatNPR(line.debit) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {line.credit > 0 ? formatNPR(line.credit) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Expense record not found.
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedExpenseId(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Category Dialog */}
      <Dialog open={isNewCategoryOpen} onOpenChange={setIsNewCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Tag className="h-4 w-4 text-primary" />
              Add Expense Category
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a category and link it to its default General Ledger expense account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Category Name</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Fuel & Travel, Server Hosting, Office Supplies"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Default Expense Ledger Account</Label>
              <NativeSelect
                value={newCatAccountId}
                onChange={(e) => setNewCatAccountId(e.target.value)}
                className="h-8 text-xs font-mono"
              >
                {expenseAccounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description (Optional)</Label>
              <Input
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Brief summary of expenses falling under this category"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewCategoryOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="font-semibold">
                {isSubmitting ? 'Creating…' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
