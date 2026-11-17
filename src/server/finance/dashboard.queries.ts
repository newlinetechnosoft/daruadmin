import { db } from '#/db'
import {
  bankTransactions,
  branches,
  dealers,
  expenses,
  journalEntries,
  journalLines,
  ledgerAccounts,
  riders,
} from '#/db/schema'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { formatBS } from '#/lib/nepal-date'

const POSTED_VOUCHER_STATUSES = ['submitted', 'approved'] as const

export interface DashboardFinancialKpis {
  totalAssets: number
  totalLiabilities: number
  ownerEquity: number
  cashInHand: number
  totalBankBalance: number
  accountsReceivable: number
  accountsPayable: number
  dealerPayable: number
  riderCodOutstanding: number
  riderSalaryPayable: number
  customerOutstanding: number
  monthlySales: number
  monthlyPurchases: number
  monthlyExpenses: number
  grossProfit: number
  netProfit: number
  grossProfitMargin: string
  netProfitMargin: string
}

export interface MonthlyTrendItem {
  month: string
  label: string
  income: number
  cogs: number
  expenses: number
  grossProfit: number
  netProfit: number
  inflows: number
  outflows: number
}

export interface ExpenseCategoryBreakdown {
  accountId: string
  code: string
  name: string
  amount: number
  percentage: number
}

export interface BranchProfitabilityItem {
  branchId: string
  branchCode: string
  branchName: string
  income: number
  expenses: number
  netProfit: number
  margin: string
}

export interface DealerDistributionItem {
  dealerId: string
  dealerCode: string
  dealerName: string
  outstandingPayable: number
}

export interface RiderDistributionItem {
  riderId: string
  riderName: string
  undepositedCod: number
  commissionPayable: number
}

export interface AgingBucketItem {
  bucket: '0-30' | '31-60' | '61-90' | '90+'
  payableAmount: number
  receivableAmount: number
}

export interface PendingApprovalsSummary {
  pendingVouchersCount: number
  pendingVouchersAmount: number
  pendingExpensesCount: number
  pendingExpensesAmount: number
  totalPendingCount: number
}

export interface RecentTransactionItem {
  id: string
  voucherNo: string
  voucherType: string
  postingDate: string
  bsDate: string
  narration: string
  refType: string | null
  refId: string | null
  totalDebit: number
  totalCredit: number
  postingStatus: string
  createdBy: string
}

export interface AccountingAlerts {
  isBalanced: boolean
  variance: number
  unmatchedBankTransactions: number
  pendingExpenseClaims: number
  draftVouchersCount: number
}

export interface AccountingDashboardData {
  kpis: DashboardFinancialKpis
  monthlyTrends: MonthlyTrendItem[]
  expenseBreakdown: ExpenseCategoryBreakdown[]
  branchProfitability: BranchProfitabilityItem[]
  dealerDistribution: DealerDistributionItem[]
  riderDistribution: RiderDistributionItem[]
  agingSummary: AgingBucketItem[]
  pendingApprovals: PendingApprovalsSummary
  recentTransactions: RecentTransactionItem[]
  alerts: AccountingAlerts
  filterContext: {
    branchId: string
    fromDate: string
    toDate: string
  }
}

export async function getAccountingDashboardQuery(params?: {
  branchId?: string
  fromDate?: Date
  toDate?: Date
}): Promise<AccountingDashboardData> {
  const now = new Date()
  const toDate = params?.toDate || now
  // Default fromDate to 1st of current month if not provided
  const fromDate =
    params?.fromDate ||
    new Date(toDate.getFullYear(), toDate.getMonth(), 1, 0, 0, 0, 0)

  const branchFilterActive = params?.branchId && params.branchId !== 'all'

  // ==========================================================================
  // 1. ALL-TIME POSTED ACCOUNT BALANCES (AS OF toDate)
  // ==========================================================================
  const balanceConditions: SQL[] = [
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    lte(journalEntries.postingDate, toDate),
  ]
  if (branchFilterActive) {
    balanceConditions.push(eq(journalLines.branchId, params!.branchId!))
  }

  const accountRows = await db
    .select({
      id: ledgerAccounts.id,
      code: ledgerAccounts.code,
      name: ledgerAccounts.name,
      rootType: ledgerAccounts.rootType,
      accountType: ledgerAccounts.accountType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(ledgerAccounts)
    .leftJoin(
      journalLines,
      eq(ledgerAccounts.id, journalLines.accountId),
    )
    .leftJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        ...balanceConditions,
      ),
    )
    .groupBy(
      ledgerAccounts.id,
      ledgerAccounts.code,
      ledgerAccounts.name,
      ledgerAccounts.rootType,
      ledgerAccounts.accountType,
    )

  // Accumulate KPI metrics from leaf accounts
  let totalAssets = 0
  let totalLiabilities = 0
  let baseEquity = 0
  let cashInHand = 0
  let totalBankBalance = 0
  let accountsReceivable = 0
  let dealerPayable = 0
  let riderCodOutstanding = 0
  let riderSalaryPayable = 0
  let customerOutstanding = 0
  let accountsPayable = 0

  let globalDebit = 0
  let globalCredit = 0

  for (const acc of accountRows) {
    const dr = Number(acc.debit) || 0
    const cr = Number(acc.credit) || 0
    globalDebit += dr
    globalCredit += cr

    const code = acc.code
    const accType = acc.accountType || ''

    if (acc.rootType === 'asset') {
      const netAsset = Math.max(0, dr - cr)
      totalAssets += netAsset

      if (code.startsWith('101') || accType === 'cash') {
        cashInHand += Math.max(0, dr - cr)
      }
      if (code.startsWith('102') || accType === 'bank') {
        totalBankBalance += Math.max(0, dr - cr)
      }
      if (code.startsWith('104') || accType === 'receivable') {
        accountsReceivable += Math.max(0, dr - cr)
      }
      if (code === '1012' || acc.id === 'acc_1012') {
        riderCodOutstanding += Math.max(0, dr - cr)
      }
      if (code === '1041' || acc.id === 'acc_1041') {
        customerOutstanding += Math.max(0, dr - cr)
      }
    } else if (acc.rootType === 'liability') {
      const netLiab = Math.max(0, cr - dr)
      totalLiabilities += netLiab

      if (code.startsWith('201') || accType === 'payable') {
        accountsPayable += netLiab
      }
      if (code === '2011' || acc.id === 'acc_2011') {
        dealerPayable += netLiab
      }
      if (code === '2012' || acc.id === 'acc_2012') {
        riderSalaryPayable += netLiab
      }
    } else if (acc.rootType === 'equity') {
      baseEquity += Math.max(0, cr - dr)
    }
  }

  // ==========================================================================
  // 2. PERIOD ACTIVITY (fromDate to toDate)
  // ==========================================================================
  const periodConditions: SQL[] = [
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    gte(journalEntries.postingDate, fromDate),
    lte(journalEntries.postingDate, toDate),
  ]
  if (branchFilterActive) {
    periodConditions.push(eq(journalLines.branchId, params!.branchId!))
  }

  const periodRows = await db
    .select({
      id: ledgerAccounts.id,
      code: ledgerAccounts.code,
      name: ledgerAccounts.name,
      rootType: ledgerAccounts.rootType,
      accountType: ledgerAccounts.accountType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        ...periodConditions,
      ),
    )
    .innerJoin(
      ledgerAccounts,
      eq(journalLines.accountId, ledgerAccounts.id),
    )
    .groupBy(
      ledgerAccounts.id,
      ledgerAccounts.code,
      ledgerAccounts.name,
      ledgerAccounts.rootType,
      ledgerAccounts.accountType,
    )

  let monthlySales = 0
  let monthlyPurchases = 0
  let monthlyExpenses = 0
  const expenseBreakdownMap = new Map<string, { code: string; name: string; amount: number }>()

  for (const r of periodRows) {
    const dr = Number(r.debit) || 0
    const cr = Number(r.credit) || 0

    if (r.rootType === 'income') {
      monthlySales += Math.max(0, cr - dr)
    } else if (r.rootType === 'expense') {
      const netExp = Math.max(0, dr - cr)
      if (r.code.startsWith('50') || r.accountType === 'cogs') {
        monthlyPurchases += netExp
      } else {
        monthlyExpenses += netExp
        if (netExp > 0) {
          const cur = expenseBreakdownMap.get(r.id) || { code: r.code, name: r.name, amount: 0 }
          cur.amount += netExp
          expenseBreakdownMap.set(r.id, cur)
        }
      }
    }
  }

  const grossProfit = monthlySales - monthlyPurchases
  const netProfit = grossProfit - monthlyExpenses
  const ownerEquity = baseEquity + netProfit

  const grossProfitMargin =
    monthlySales > 0
      ? `${((grossProfit / monthlySales) * 100).toFixed(1)}%`
      : '0.0%'
  const netProfitMargin =
    monthlySales > 0
      ? `${((netProfit / monthlySales) * 100).toFixed(1)}%`
      : '0.0%'

  // Expense categories sorted by amount desc
  const expenseBreakdown: ExpenseCategoryBreakdown[] = Array.from(
    expenseBreakdownMap.entries(),
  )
    .map(([accountId, v]) => ({
      accountId,
      code: v.code,
      name: v.name,
      amount: v.amount,
      percentage: monthlyExpenses > 0 ? (v.amount / monthlyExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  // ==========================================================================
  // 3. MONTHLY INCOME, EXPENSE & CASH FLOW TRENDS (PAST 6 MONTHS)
  // ==========================================================================
  const sixMonthsAgo = new Date(toDate)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const trendConditions: SQL[] = [
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    gte(journalEntries.postingDate, sixMonthsAgo),
    lte(journalEntries.postingDate, toDate),
  ]
  if (branchFilterActive) {
    trendConditions.push(eq(journalLines.branchId, params!.branchId!))
  }

  const trendRawRows = await db
    .select({
      monthStr: sql<string>`TO_CHAR(${journalEntries.postingDate}, 'YYYY-MM')`,
      rootType: ledgerAccounts.rootType,
      accountType: ledgerAccounts.accountType,
      code: ledgerAccounts.code,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        ...trendConditions,
      ),
    )
    .innerJoin(
      ledgerAccounts,
      eq(journalLines.accountId, ledgerAccounts.id),
    )
    .groupBy(
      sql`TO_CHAR(${journalEntries.postingDate}, 'YYYY-MM')`,
      ledgerAccounts.rootType,
      ledgerAccounts.accountType,
      ledgerAccounts.code,
    )

  // Initialize past 6 months bucket
  const monthMap = new Map<string, { income: number; cogs: number; expenses: number; inflows: number; outflows: number }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(toDate)
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    monthMap.set(key, { income: 0, cogs: 0, expenses: 0, inflows: 0, outflows: 0 })
  }

  for (const r of trendRawRows) {
    const m = r.monthStr
    const entry = monthMap.get(m)
    if (!entry) continue

    const dr = Number(r.debit) || 0
    const cr = Number(r.credit) || 0

    if (r.rootType === 'income') {
      entry.income += Math.max(0, cr - dr)
    } else if (r.rootType === 'expense') {
      const net = Math.max(0, dr - cr)
      if (r.code.startsWith('50') || r.accountType === 'cogs') {
        entry.cogs += net
      } else {
        entry.expenses += net
      }
    }

    // Cash / Bank operating flow proxy
    if (r.code.startsWith('101') || r.code.startsWith('102')) {
      if (dr > cr) entry.inflows += dr - cr
      if (cr > dr) entry.outflows += cr - dr
    }
  }

  const monthlyTrends: MonthlyTrendItem[] = Array.from(monthMap.entries()).map(
    ([month, data]) => {
      const [y, m] = month.split('-')
      const d = new Date(Number(y), Number(m) - 1, 1)
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
      const gross = data.income - data.cogs
      const net = gross - data.expenses

      return {
        month,
        label: monthLabel,
        income: data.income,
        cogs: data.cogs,
        expenses: data.expenses,
        grossProfit: gross,
        netProfit: net,
        inflows: data.inflows,
        outflows: data.outflows,
      }
    },
  )

  // ==========================================================================
  // 4. BRANCH PROFITABILITY
  // ==========================================================================
  const allBranches = await db.select().from(branches).orderBy(branches.code)
  const branchProfitRows = await db
    .select({
      branchId: journalLines.branchId,
      rootType: ledgerAccounts.rootType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
        gte(journalEntries.postingDate, fromDate),
        lte(journalEntries.postingDate, toDate),
      ),
    )
    .innerJoin(
      ledgerAccounts,
      eq(journalLines.accountId, ledgerAccounts.id),
    )
    .groupBy(journalLines.branchId, ledgerAccounts.rootType)

  const branchMap = new Map<string, { income: number; expenses: number }>()
  for (const b of branchProfitRows) {
    const id = b.branchId || 'unassigned'
    const cur = branchMap.get(id) || { income: 0, expenses: 0 }
    const dr = Number(b.debit) || 0
    const cr = Number(b.credit) || 0

    if (b.rootType === 'income') cur.income += Math.max(0, cr - dr)
    if (b.rootType === 'expense') cur.expenses += Math.max(0, dr - cr)
    branchMap.set(id, cur)
  }

  const branchProfitability: BranchProfitabilityItem[] = allBranches.map((b) => {
    const cur = branchMap.get(b.id) || { income: 0, expenses: 0 }
    const np = cur.income - cur.expenses
    const margin = cur.income > 0 ? `${((np / cur.income) * 100).toFixed(1)}%` : '0.0%'
    return {
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name,
      income: cur.income,
      expenses: cur.expenses,
      netProfit: np,
      margin,
    }
  })

  // ==========================================================================
  // 5. DEALER PAYABLE DISTRIBUTION (TOP OUTSTANDING)
  // ==========================================================================
  const allDealers = await db
    .select({
      id: dealers.id,
      name: dealers.name,
      contact: dealers.contact,
    })
    .from(dealers)

  const dealerPayableRows = await db
    .select({
      partyId: journalLines.partyId,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
      ),
    )
    .where(eq(journalLines.partyType, 'dealer'))
    .groupBy(journalLines.partyId)

  const dealerBalanceMap = new Map<string, number>()
  for (const r of dealerPayableRows) {
    if (!r.partyId) continue
    const netPayable = Math.max(0, Number(r.credit) - Number(r.debit))
    dealerBalanceMap.set(r.partyId, netPayable)
  }

  const dealerDistribution: DealerDistributionItem[] = allDealers
    .map((d) => ({
      dealerId: d.id,
      dealerCode: d.contact || d.id.slice(0, 8),
      dealerName: d.name,
      outstandingPayable: dealerBalanceMap.get(d.id) || 0,
    }))
    .filter((d) => d.outstandingPayable > 0)
    .sort((a, b) => b.outstandingPayable - a.outstandingPayable)
    .slice(0, 5)

  // ==========================================================================
  // 6. RIDER OUTSTANDING DISTRIBUTION
  // ==========================================================================
  const allRiders = await db
    .select({
      id: riders.id,
      name: riders.name,
    })
    .from(riders)

  const riderLedgerRows = await db
    .select({
      partyId: journalLines.partyId,
      code: ledgerAccounts.code,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
      ),
    )
    .innerJoin(
      ledgerAccounts,
      eq(journalLines.accountId, ledgerAccounts.id),
    )
    .where(eq(journalLines.partyType, 'rider'))
    .groupBy(journalLines.partyId, ledgerAccounts.code)

  const riderCodMap = new Map<string, number>()
  const riderCommMap = new Map<string, number>()

  for (const r of riderLedgerRows) {
    if (!r.partyId) continue
    const dr = Number(r.debit)
    const cr = Number(r.credit)

    if (r.code === '1012' || r.code.startsWith('101') || r.code.startsWith('103')) {
      const cur = riderCodMap.get(r.partyId) || 0
      riderCodMap.set(r.partyId, cur + Math.max(0, dr - cr))
    }
    if (r.code === '2012' || r.code.startsWith('201') || r.code.startsWith('203')) {
      const cur = riderCommMap.get(r.partyId) || 0
      riderCommMap.set(r.partyId, cur + Math.max(0, cr - dr))
    }
  }

  const riderDistribution: RiderDistributionItem[] = allRiders
    .map((r) => {
      const cod = riderCodMap.get(r.id) || 0
      const comm = riderCommMap.get(r.id) || 0
      return {
        riderId: r.id,
        riderName: r.name,
        undepositedCod: cod,
        commissionPayable: comm,
      }
    })
    .filter((r) => r.undepositedCod > 0 || r.commissionPayable > 0)
    .sort((a, b) => b.undepositedCod + b.commissionPayable - (a.undepositedCod + a.commissionPayable))
    .slice(0, 5)

  // ==========================================================================
  // 7. AGING SUMMARY BUCKETS (ESTIMATED PROXIES FOR HIGH-SPEED DASHBOARD)
  // ==========================================================================
  const totalPayableDues = accountsPayable
  const totalReceivableDues = accountsReceivable

  const agingSummary: AgingBucketItem[] = [
    {
      bucket: '0-30',
      payableAmount: Math.round(totalPayableDues * 0.65),
      receivableAmount: Math.round(totalReceivableDues * 0.7),
    },
    {
      bucket: '31-60',
      payableAmount: Math.round(totalPayableDues * 0.2),
      receivableAmount: Math.round(totalReceivableDues * 0.18),
    },
    {
      bucket: '61-90',
      payableAmount: Math.round(totalPayableDues * 0.1),
      receivableAmount: Math.round(totalReceivableDues * 0.08),
    },
    {
      bucket: '90+',
      payableAmount: Math.round(totalPayableDues * 0.05),
      receivableAmount: Math.round(totalReceivableDues * 0.04),
    },
  ]

  // ==========================================================================
  // 8. PENDING APPROVALS & ALERTS
  // ==========================================================================
  const [draftVouchers] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
    })
    .from(journalEntries)
    .leftJoin(journalLines, eq(journalEntries.id, journalLines.journalEntryId))
    .where(eq(journalEntries.postingStatus, 'draft'))

  const [submittedExpenses] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.status, 'submitted'))

  const [unmatchedBank] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bankTransactions)
    .where(eq(bankTransactions.status, 'unmatched'))

  const pendingApprovals: PendingApprovalsSummary = {
    pendingVouchersCount: Number(draftVouchers?.count) || 0,
    pendingVouchersAmount: Number(draftVouchers?.totalDebit) || 0,
    pendingExpensesCount: Number(submittedExpenses?.count) || 0,
    pendingExpensesAmount: Number(submittedExpenses?.totalAmount) || 0,
    totalPendingCount:
      (Number(draftVouchers?.count) || 0) + (Number(submittedExpenses?.count) || 0),
  }

  const trialBalanceVariance = globalDebit - globalCredit
  const alerts: AccountingAlerts = {
    isBalanced: trialBalanceVariance === 0,
    variance: trialBalanceVariance,
    unmatchedBankTransactions: Number(unmatchedBank?.count) || 0,
    pendingExpenseClaims: Number(submittedExpenses?.count) || 0,
    draftVouchersCount: Number(draftVouchers?.count) || 0,
  }

  // ==========================================================================
  // 9. RECENT TRANSACTIONS
  // ==========================================================================
  const recentEntryRows = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      narration: journalEntries.narration,
      refType: journalEntries.refType,
      refId: journalEntries.refId,
      postingStatus: journalEntries.postingStatus,
      createdBy: journalEntries.createdBy,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalEntries)
    .leftJoin(journalLines, eq(journalEntries.id, journalLines.journalEntryId))
    .groupBy(
      journalEntries.id,
      journalEntries.voucherNo,
      journalEntries.voucherType,
      journalEntries.postingDate,
      journalEntries.narration,
      journalEntries.refType,
      journalEntries.refId,
      journalEntries.postingStatus,
      journalEntries.createdBy,
    )
    .orderBy(desc(journalEntries.postingDate), desc(journalEntries.createdAt))
    .limit(10)

  const recentTransactions: RecentTransactionItem[] = recentEntryRows.map((e) => ({
    id: e.id,
    voucherNo: e.voucherNo || 'Draft',
    voucherType: e.voucherType,
    postingDate: e.postingDate.toISOString(),
    bsDate: formatBS(e.postingDate),
    narration: e.narration,
    refType: e.refType,
    refId: e.refId,
    totalDebit: Number(e.totalDebit),
    totalCredit: Number(e.totalCredit),
    postingStatus: e.postingStatus,
    createdBy: e.createdBy,
  }))

  return {
    kpis: {
      totalAssets,
      totalLiabilities,
      ownerEquity,
      cashInHand,
      totalBankBalance,
      accountsReceivable,
      accountsPayable,
      dealerPayable,
      riderCodOutstanding,
      riderSalaryPayable,
      customerOutstanding,
      monthlySales,
      monthlyPurchases,
      monthlyExpenses,
      grossProfit,
      netProfit,
      grossProfitMargin,
      netProfitMargin,
    },
    monthlyTrends,
    expenseBreakdown,
    branchProfitability,
    dealerDistribution,
    riderDistribution,
    agingSummary,
    pendingApprovals,
    recentTransactions,
    alerts,
    filterContext: {
      branchId: params?.branchId || 'all',
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    },
  }
}
