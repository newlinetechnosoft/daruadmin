import { db } from '#/db'
import {
  branches,
  dealers,
  journalEntries,
  journalLines,
  ledgerAccounts,
  riders,
  user,
} from '#/db/schema'
import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { resolveAccount } from './account-keys'

// Base posted voucher condition: only submitted or approved vouchers that are not reversed
const POSTED_VOUCHER_STATUSES = ['submitted', 'approved'] as const

// ============================================================================
// 1. TRIAL BALANCE REPORT (Server-side SQL)
// ============================================================================

export interface TrialBalanceItem {
  id: string
  code: string
  name: string
  rootType: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  accountType: string | null
  parentId: string | null
  isGroup: boolean
  openingDebit: number // paisa
  openingCredit: number // paisa
  periodDebit: number // paisa
  periodCredit: number // paisa
  closingDebit: number // paisa
  closingCredit: number // paisa
}

export interface TrialBalanceReportResult {
  accounts: TrialBalanceItem[]
  totalOpeningDebit: number
  totalOpeningCredit: number
  totalPeriodDebit: number
  totalPeriodCredit: number
  totalClosingDebit: number
  totalClosingCredit: number
  isBalanced: boolean
  variance: number // totalClosingDebit - totalClosingCredit
  dateRange: { from?: string; to?: string }
}

export async function getTrialBalanceReportQuery(params?: {
  fromDate?: Date
  toDate?: Date
  branchId?: string
  costCenterId?: string
  includeZero?: boolean
}): Promise<TrialBalanceReportResult> {
  const allAccounts = await db
    .select()
    .from(ledgerAccounts)
    .orderBy(asc(ledgerAccounts.code))

  const baseConditions: SQL[] = [
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
  ]
  if (params?.branchId && params.branchId !== 'all') {
    baseConditions.push(eq(journalLines.branchId, params.branchId))
  }
  if (params?.costCenterId && params.costCenterId !== 'all') {
    baseConditions.push(eq(journalLines.costCenterId, params.costCenterId))
  }

  // 1. Opening movements (before fromDate)
  const openingMap = new Map<string, { debit: number; credit: number }>()
  if (params?.fromDate) {
    const openingRows = await db
      .select({
        accountId: journalLines.accountId,
        debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id),
      )
      .where(
        and(
          ...baseConditions,
          lt(journalEntries.postingDate, params.fromDate),
        ),
      )
      .groupBy(journalLines.accountId)

    for (const r of openingRows) {
      openingMap.set(r.accountId, {
        debit: Number(r.debit),
        credit: Number(r.credit),
      })
    }
  }

  // 2. Period movements (between fromDate and toDate)
  const periodConditions = [...baseConditions]
  if (params?.fromDate) {
    periodConditions.push(gte(journalEntries.postingDate, params.fromDate))
  }
  if (params?.toDate) {
    periodConditions.push(lte(journalEntries.postingDate, params.toDate))
  }

  const periodRows = await db
    .select({
      accountId: journalLines.accountId,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(and(...periodConditions))
    .groupBy(journalLines.accountId)

  const periodMap = new Map<string, { debit: number; credit: number }>()
  for (const r of periodRows) {
    periodMap.set(r.accountId, {
      debit: Number(r.debit),
      credit: Number(r.credit),
    })
  }

  // 3. Compute per-account and roll-up totals
  const nonGroupAccounts = allAccounts.filter((a) => !a.isGroup)

  let totalOpeningDebit = 0
  let totalOpeningCredit = 0
  let totalPeriodDebit = 0
  let totalPeriodCredit = 0
  let totalClosingDebit = 0
  let totalClosingCredit = 0

  const items: TrialBalanceItem[] = []

  for (const acc of nonGroupAccounts) {
    const op = openingMap.get(acc.id) || { debit: 0, credit: 0 }
    const pe = periodMap.get(acc.id) || { debit: 0, credit: 0 }

    const isDebitNormal = acc.rootType === 'asset' || acc.rootType === 'expense'

    // Opening normal side net
    const netOpening = isDebitNormal ? op.debit - op.credit : op.credit - op.debit
    const opDr = netOpening > 0 && isDebitNormal ? netOpening : netOpening < 0 && !isDebitNormal ? Math.abs(netOpening) : 0
    const opCr = netOpening > 0 && !isDebitNormal ? netOpening : netOpening < 0 && isDebitNormal ? Math.abs(netOpening) : 0

    // Period gross
    const peDr = pe.debit
    const peCr = pe.credit

    // Closing total movement
    const cumDr = op.debit + pe.debit
    const cumCr = op.credit + pe.credit
    const netClosing = cumDr - cumCr

    const clDr = netClosing > 0 ? netClosing : 0
    const clCr = netClosing < 0 ? Math.abs(netClosing) : 0

    // Filter out zero accounts if not included
    if (
      !params?.includeZero &&
      opDr === 0 &&
      opCr === 0 &&
      peDr === 0 &&
      peCr === 0 &&
      clDr === 0 &&
      clCr === 0
    ) {
      continue
    }

    totalOpeningDebit += opDr
    totalOpeningCredit += opCr
    totalPeriodDebit += peDr
    totalPeriodCredit += peCr
    totalClosingDebit += clDr
    totalClosingCredit += clCr

    items.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      rootType: acc.rootType as TrialBalanceItem['rootType'],
      accountType: acc.accountType,
      parentId: acc.parentId,
      isGroup: false,
      openingDebit: opDr,
      openingCredit: opCr,
      periodDebit: peDr,
      periodCredit: peCr,
      closingDebit: clDr,
      closingCredit: clCr,
    })
  }

  const variance = Math.abs(totalClosingDebit - totalClosingCredit)
  const isBalanced = variance === 0

  return {
    accounts: items,
    totalOpeningDebit,
    totalOpeningCredit,
    totalPeriodDebit,
    totalPeriodCredit,
    totalClosingDebit,
    totalClosingCredit,
    isBalanced,
    variance,
    dateRange: {
      from: params?.fromDate?.toISOString(),
      to: params?.toDate?.toISOString(),
    },
  }
}

// ============================================================================
// 2. PROFIT AND LOSS REPORT (Server-side SQL)
// ============================================================================

export interface PnLAccountRow {
  accountId: string
  code: string
  name: string
  accountType: string | null
  currentPeriod: number // paisa
  previousPeriod: number // paisa
}

export interface ProfitAndLossReportResult {
  incomeRows: PnLAccountRow[]
  totalIncome: number
  cogsRows: PnLAccountRow[]
  totalCogs: number
  grossProfit: number
  operatingExpenseRows: PnLAccountRow[]
  totalOperatingExpenses: number
  netProfit: number
  previousPeriod: {
    totalIncome: number
    totalCogs: number
    grossProfit: number
    totalOperatingExpenses: number
    netProfit: number
  }
  dateRange: { from?: string; to?: string }
}

export async function getProfitAndLossReportQuery(params?: {
  fromDate?: Date
  toDate?: Date
  branchId?: string
  costCenterId?: string
}): Promise<ProfitAndLossReportResult> {
  const fromDate = params?.fromDate || new Date(new Date().getFullYear(), 0, 1)
  const toDate = params?.toDate || new Date()

  // Calculate previous period for comparison (same duration immediately preceding)
  const durationMs = toDate.getTime() - fromDate.getTime()
  const prevToDate = new Date(fromDate.getTime() - 1)
  const prevFromDate = new Date(prevToDate.getTime() - durationMs)

  async function fetchPeriodPnL(start: Date, end: Date) {
    const conditions = [
      inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
      eq(journalEntries.isReversed, false),
      gte(journalEntries.postingDate, start),
      lte(journalEntries.postingDate, end),
    ]
    if (params?.branchId && params.branchId !== 'all') {
      conditions.push(eq(journalLines.branchId, params.branchId))
    }
    if (params?.costCenterId && params.costCenterId !== 'all') {
      conditions.push(eq(journalLines.costCenterId, params.costCenterId))
    }

    const rows = await db
      .select({
        accountId: journalLines.accountId,
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
        eq(journalLines.journalEntryId, journalEntries.id),
      )
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(and(...conditions))
      .groupBy(
        journalLines.accountId,
        ledgerAccounts.code,
        ledgerAccounts.name,
        ledgerAccounts.rootType,
        ledgerAccounts.accountType,
      )

    return rows
  }

  const [currentRows, prevRows] = await Promise.all([
    fetchPeriodPnL(fromDate, toDate),
    fetchPeriodPnL(prevFromDate, prevToDate),
  ])

  const prevMap = new Map<string, number>()
  for (const r of prevRows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)
    const net = r.rootType === 'income' ? cr - dr : dr - cr
    prevMap.set(r.accountId, net)
  }

  const incomeRows: PnLAccountRow[] = []
  const cogsRows: PnLAccountRow[] = []
  const expenseRows: PnLAccountRow[] = []

  let totalIncome = 0
  let totalCogs = 0
  let totalExpenses = 0

  for (const r of currentRows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)
    const prevNet = prevMap.get(r.accountId) || 0

    if (r.rootType === 'income') {
      const net = cr - dr
      totalIncome += net
      incomeRows.push({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        accountType: r.accountType,
        currentPeriod: net,
        previousPeriod: prevNet,
      })
    } else if (r.rootType === 'expense') {
      const net = dr - cr
      if (r.accountType === 'cogs') {
        totalCogs += net
        cogsRows.push({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          accountType: r.accountType,
          currentPeriod: net,
          previousPeriod: prevNet,
        })
      } else {
        totalExpenses += net
        expenseRows.push({
          accountId: r.accountId,
          code: r.code,
          name: r.name,
          accountType: r.accountType,
          currentPeriod: net,
          previousPeriod: prevNet,
        })
      }
    }
  }

  // Previous period totals
  let prevIncome = 0
  let prevCogs = 0
  let prevExpenses = 0
  for (const r of prevRows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)
    if (r.rootType === 'income') {
      prevIncome += cr - dr
    } else if (r.rootType === 'expense') {
      if (r.accountType === 'cogs') {
        prevCogs += dr - cr
      } else {
        prevExpenses += dr - cr
      }
    }
  }

  const grossProfit = totalIncome - totalCogs
  const netProfit = grossProfit - totalExpenses

  const prevGrossProfit = prevIncome - prevCogs
  const prevNetProfit = prevGrossProfit - prevExpenses

  return {
    incomeRows: incomeRows.sort((a, b) => a.code.localeCompare(b.code)),
    totalIncome,
    cogsRows: cogsRows.sort((a, b) => a.code.localeCompare(b.code)),
    totalCogs,
    grossProfit,
    operatingExpenseRows: expenseRows.sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
    totalOperatingExpenses: totalExpenses,
    netProfit,
    previousPeriod: {
      totalIncome: prevIncome,
      totalCogs: prevCogs,
      grossProfit: prevGrossProfit,
      totalOperatingExpenses: prevExpenses,
      netProfit: prevNetProfit,
    },
    dateRange: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
  }
}

// ============================================================================
// 3. BALANCE SHEET REPORT (Server-side SQL)
// ============================================================================

export interface BalanceSheetRow {
  accountId: string
  code: string
  name: string
  accountType: string | null
  balance: number // paisa
}

export interface BalanceSheetReportResult {
  assetRows: BalanceSheetRow[]
  totalAssets: number
  liabilityRows: BalanceSheetRow[]
  totalLiabilities: number
  equityRows: BalanceSheetRow[]
  totalEquity: number
  currentYearProfit: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
  variance: number // totalAssets - totalLiabilitiesAndEquity
  asOfDate: string
}

export async function getBalanceSheetReportQuery(params?: {
  asOfDate?: Date
  branchId?: string
}): Promise<BalanceSheetReportResult> {
  const asOfDate = params?.asOfDate || new Date()

  const conditions = [
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    lte(journalEntries.postingDate, asOfDate),
  ]
  if (params?.branchId && params.branchId !== 'all') {
    conditions.push(eq(journalLines.branchId, params.branchId))
  }

  const rows = await db
    .select({
      accountId: journalLines.accountId,
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
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(and(...conditions))
    .groupBy(
      journalLines.accountId,
      ledgerAccounts.code,
      ledgerAccounts.name,
      ledgerAccounts.rootType,
      ledgerAccounts.accountType,
    )

  const assetRows: BalanceSheetRow[] = []
  const liabilityRows: BalanceSheetRow[] = []
  const equityRows: BalanceSheetRow[] = []

  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0
  let totalIncomeMovement = 0
  let totalExpenseMovement = 0

  for (const r of rows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)

    if (r.rootType === 'asset') {
      const net = dr - cr
      totalAssets += net
      assetRows.push({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        accountType: r.accountType,
        balance: net,
      })
    } else if (r.rootType === 'liability') {
      const net = cr - dr
      totalLiabilities += net
      liabilityRows.push({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        accountType: r.accountType,
        balance: net,
      })
    } else if (r.rootType === 'equity') {
      const net = cr - dr
      totalEquity += net
      equityRows.push({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        accountType: r.accountType,
        balance: net,
      })
    } else if (r.rootType === 'income') {
      totalIncomeMovement += cr - dr
    } else if (r.rootType === 'expense') {
      totalExpenseMovement += dr - cr
    }
  }

  // Current period unclosed profit (Income - Expenses) rolls into equity
  const currentYearProfit = totalIncomeMovement - totalExpenseMovement
  const totalLiabilitiesAndEquity =
    totalLiabilities + totalEquity + currentYearProfit

  const variance = Math.abs(totalAssets - totalLiabilitiesAndEquity)
  const isBalanced = variance === 0

  return {
    assetRows: assetRows.sort((a, b) => a.code.localeCompare(b.code)),
    totalAssets,
    liabilityRows: liabilityRows.sort((a, b) => a.code.localeCompare(b.code)),
    totalLiabilities,
    equityRows: equityRows.sort((a, b) => a.code.localeCompare(b.code)),
    totalEquity,
    currentYearProfit,
    totalLiabilitiesAndEquity,
    isBalanced,
    variance,
    asOfDate: asOfDate.toISOString(),
  }
}

// ============================================================================
// 4. CASH FLOW STATEMENT (Direct Method)
// ============================================================================

export interface CashFlowActivityGroup {
  name: string
  amount: number // paisa
  narration: string
}

export interface CashFlowStatementResult {
  operatingInflows: CashFlowActivityGroup[]
  totalOperatingInflows: number
  operatingOutflows: CashFlowActivityGroup[]
  totalOperatingOutflows: number
  netOperatingCashFlow: number
  openingCashAndBank: number
  closingCashAndBank: number
  netChangeInCash: number
  dateRange: { from?: string; to?: string }
}

export async function getCashFlowStatementReportQuery(params?: {
  fromDate?: Date
  toDate?: Date
  branchId?: string
}): Promise<CashFlowStatementResult> {
  const fromDate = params?.fromDate || new Date(new Date().getFullYear(), 0, 1)
  const toDate = params?.toDate || new Date()

  // Cash and bank accounts
  const cashAccounts = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      sql`${ledgerAccounts.accountType} IN ('cash', 'bank') OR ${ledgerAccounts.code} IN ('1011', '1012', '1021', '1022')`,
    )
  const cashAccountIds = cashAccounts.map((c) => c.id)

  if (cashAccountIds.length === 0) {
    return {
      operatingInflows: [],
      totalOperatingInflows: 0,
      operatingOutflows: [],
      totalOperatingOutflows: 0,
      netOperatingCashFlow: 0,
      openingCashAndBank: 0,
      closingCashAndBank: 0,
      netChangeInCash: 0,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    }
  }

  // 1. Opening Cash and Bank (before fromDate)
  const openingLines = await db
    .select({
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        inArray(journalLines.accountId, cashAccountIds),
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
        lt(journalEntries.postingDate, fromDate),
      ),
    )

  const openingCashAndBank =
    Number(openingLines[0]?.debit || 0) - Number(openingLines[0]?.credit || 0)

  // 2. Period Cash Flow by Event / RefType
  const periodConditions = [
    inArray(journalLines.accountId, cashAccountIds),
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    gte(journalEntries.postingDate, fromDate),
    lte(journalEntries.postingDate, toDate),
  ]
  if (params?.branchId && params.branchId !== 'all') {
    periodConditions.push(eq(journalLines.branchId, params.branchId))
  }

  const periodLines = await db
    .select({
      refType: journalEntries.refType,
      event: journalEntries.event,
      narration: journalEntries.narration,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(and(...periodConditions))
    .groupBy(
      journalEntries.refType,
      journalEntries.event,
      journalEntries.narration,
    )

  const inflows: CashFlowActivityGroup[] = []
  const outflows: CashFlowActivityGroup[] = []
  let totalInflows = 0
  let totalOutflows = 0

  for (const l of periodLines) {
    const dr = Number(l.debit)
    const cr = Number(l.credit)

    if (dr > 0) {
      totalInflows += dr
      inflows.push({
        name: l.event || l.refType || 'Customer Payment / Receipt',
        amount: dr,
        narration: l.narration,
      })
    }
    if (cr > 0) {
      totalOutflows += cr
      outflows.push({
        name: l.event || l.refType || 'Disbursement / Expense',
        amount: cr,
        narration: l.narration,
      })
    }
  }

  const netOperatingCashFlow = totalInflows - totalOutflows
  const closingCashAndBank = openingCashAndBank + netOperatingCashFlow
  const netChangeInCash = netOperatingCashFlow

  return {
    operatingInflows: inflows,
    totalOperatingInflows: totalInflows,
    operatingOutflows: outflows,
    totalOperatingOutflows: totalOutflows,
    netOperatingCashFlow,
    openingCashAndBank,
    closingCashAndBank,
    netChangeInCash,
    dateRange: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
  }
}

// ============================================================================
// 5. TAX SUMMARY & VAT RETURN REPORT (Nepal Compliance)
// ============================================================================

export interface TaxSummaryResult {
  taxableSales: number // paisa
  vatOutputCollected: number // 13% Output VAT
  taxablePurchases: number // paisa
  vatInputCredit: number // 13% Input VAT
  netVatPayable: number // Output - Input
  tdsPayableOwed: number // TDS payable to IRD
  tdsDeductedFromDealers: number // TDS withheld on dealer settlements
  dateRange: { from?: string; to?: string }
}

export async function getTaxSummaryReportQuery(params?: {
  fromDate?: Date
  toDate?: Date
}): Promise<TaxSummaryResult> {
  const fromDate = params?.fromDate || new Date(new Date().getFullYear(), 0, 1)
  const toDate = params?.toDate || new Date()

  const vatOutputId = await resolveAccount(db, 'VAT_OUTPUT')
  const vatInputId = await resolveAccount(db, 'VAT_INPUT')
  const tdsPayableId = await resolveAccount(db, 'TDS_PAYABLE')
  const salesId = await resolveAccount(db, 'SALES')

  const targetIds = [vatOutputId, vatInputId, tdsPayableId, salesId]

  const rows = await db
    .select({
      accountId: journalLines.accountId,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        inArray(journalLines.accountId, targetIds),
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
        gte(journalEntries.postingDate, fromDate),
        lte(journalEntries.postingDate, toDate),
      ),
    )
    .groupBy(journalLines.accountId)

  const agg = new Map<string, { dr: number; cr: number }>()
  for (const r of rows) {
    agg.set(r.accountId, { dr: Number(r.debit), cr: Number(r.credit) })
  }

  const salesNet = (agg.get(salesId)?.cr || 0) - (agg.get(salesId)?.dr || 0)
  const vatOutput =
    (agg.get(vatOutputId)?.cr || 0) - (agg.get(vatOutputId)?.dr || 0)
  const vatInput =
    (agg.get(vatInputId)?.dr || 0) - (agg.get(vatInputId)?.cr || 0)
  const netVatPayable = vatOutput - vatInput

  const tdsCr = agg.get(tdsPayableId)?.cr || 0
  const tdsDr = agg.get(tdsPayableId)?.dr || 0
  const tdsPayableOwed = tdsCr - tdsDr

  return {
    taxableSales: salesNet,
    vatOutputCollected: vatOutput,
    taxablePurchases: 0,
    vatInputCredit: vatInput,
    netVatPayable,
    tdsPayableOwed,
    tdsDeductedFromDealers: tdsCr,
    dateRange: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
  }
}

// ============================================================================
// 6. DAY BOOK REPORT (Chronological Daily Journal Transactions)
// ============================================================================

export interface DayBookLineItem {
  id: string
  journalEntryId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  narration: string | null
  partyType: string | null
  partyId: string | null
  branchId: string | null
  branchName: string | null
  accountId: string
  accountCode: string
  accountName: string
  debit: number // paisa
  credit: number // paisa
}

export interface DayBookReportResult {
  date: string
  lines: DayBookLineItem[]
  totalDebit: number
  totalCredit: number
  voucherCount: number
}

export async function getDayBookReportQuery(params?: {
  date?: Date
  branchId?: string
  voucherType?: string
  limit?: number
  offset?: number
}): Promise<DayBookReportResult> {
  const targetDate = params?.date || new Date()
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  const conditions: SQL[] = [
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    gte(journalEntries.postingDate, startOfDay),
    lte(journalEntries.postingDate, endOfDay),
  ]

  if (params?.branchId && params.branchId !== 'all') {
    conditions.push(eq(journalEntries.branchId, params.branchId))
  }
  if (params?.voucherType && params.voucherType !== 'all') {
    conditions.push(eq(journalEntries.voucherType, params.voucherType))
  }

  const rows = await db
    .select({
      id: journalLines.id,
      journalEntryId: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      entryNarration: journalEntries.narration,
      lineNarration: journalLines.narration,
      partyType: journalLines.partyType,
      partyId: journalLines.partyId,
      branchId: journalEntries.branchId,
      branchName: branches.name,
      accountId: ledgerAccounts.id,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(
      ledgerAccounts,
      eq(journalLines.accountId, ledgerAccounts.id),
    )
    .leftJoin(branches, eq(journalEntries.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(asc(journalEntries.postingDate), asc(journalEntries.voucherNo), asc(journalLines.id))
    .limit(params?.limit || 200)
    .offset(params?.offset || 0)

  let totalDebit = 0
  let totalCredit = 0
  const uniqueVouchers = new Set<string>()

  const lines: DayBookLineItem[] = rows.map((r) => {
    totalDebit += r.debit
    totalCredit += r.credit
    uniqueVouchers.add(r.journalEntryId)

    return {
      id: r.id,
      journalEntryId: r.journalEntryId,
      voucherNo: r.voucherNo,
      voucherType: r.voucherType,
      postingDate: r.postingDate.toISOString(),
      narration: r.lineNarration || r.entryNarration,
      partyType: r.partyType,
      partyId: r.partyId,
      branchId: r.branchId,
      branchName: r.branchName,
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      debit: r.debit,
      credit: r.credit,
    }
  })

  return {
    date: targetDate.toISOString(),
    lines,
    totalDebit,
    totalCredit,
    voucherCount: uniqueVouchers.size,
  }
}

// ============================================================================
// 7. AGING REPORT (Accounts Receivable & Accounts Payable 30/60/90/90+)
// ============================================================================

export interface AgingPartyRow {
  partyId: string
  partyType: 'dealer' | 'rider' | 'customer' | 'supplier' | 'employee'
  partyName: string
  currentBalance: number // 0-30 days in paisa
  days31to60: number // 31-60 days in paisa
  days61to90: number // 61-90 days in paisa
  daysOver90: number // 91+ days in paisa
  totalOutstanding: number // paisa
}

export interface AgingReportResult {
  type: 'receivable' | 'payable'
  asOfDate: string
  parties: AgingPartyRow[]
  total0to30: number
  total31to60: number
  total61to90: number
  totalOver90: number
  grandTotal: number
}

export async function getAgingReportQuery(params?: {
  type?: 'receivable' | 'payable'
  asOfDate?: Date
  branchId?: string
}): Promise<AgingReportResult> {
  const type = params?.type || 'payable'
  const asOf = params?.asOfDate || new Date()

  // 1. Determine target accounts
  const targetAccountKeys =
    type === 'receivable'
      ? ['CUSTOMER_RECEIVABLE', 'STAFF_RIDER_ADVANCES']
      : ['DEALER_PAYABLE', 'RIDER_PAYABLE']

  const targetAccountIds = await Promise.all(
    targetAccountKeys.map((k) => resolveAccount(db, k)),
  )

  const conditions: SQL[] = [
    inArray(journalLines.accountId, targetAccountIds),
    inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
    eq(journalEntries.isReversed, false),
    lte(journalEntries.postingDate, asOf),
  ]

  if (params?.branchId && params.branchId !== 'all') {
    conditions.push(eq(journalLines.branchId, params.branchId))
  }

  const lines = await db
    .select({
      partyType: journalLines.partyType,
      partyId: journalLines.partyId,
      debit: journalLines.debit,
      credit: journalLines.credit,
      postingDate: journalEntries.postingDate,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(and(...conditions))
    .orderBy(asc(journalEntries.postingDate))

  // Fetch party names
  const [dealerList, riderList, userList] = await Promise.all([
    db.select({ id: dealers.id, name: dealers.name }).from(dealers),
    db.select({ id: riders.id, name: riders.name }).from(riders),
    db.select({ id: user.id, name: user.name }).from(user),
  ])

  const nameMap = new Map<string, string>()
  for (const d of dealerList) nameMap.set(d.id, d.name)
  for (const r of riderList) nameMap.set(r.id, r.name)
  for (const u of userList) nameMap.set(u.id, u.name)

  const partyBuckets = new Map<
    string,
    {
      partyId: string
      partyType: AgingPartyRow['partyType']
      partyName: string
      b0_30: number
      b31_60: number
      b61_90: number
      bOver90: number
      total: number
    }
  >()

  const nowMs = asOf.getTime()

  for (const l of lines) {
    if (!l.partyId) continue

    const isDrNormal = type === 'receivable'
    const net = isDrNormal ? l.debit - l.credit : l.credit - l.debit
    if (net === 0) continue

    const ageDays = Math.max(
      0,
      Math.floor((nowMs - l.postingDate.getTime()) / (1000 * 60 * 60 * 24)),
    )

    let entry = partyBuckets.get(l.partyId)
    if (!entry) {
      entry = {
        partyId: l.partyId,
        partyType: (l.partyType as AgingPartyRow['partyType']) || (type === 'receivable' ? 'customer' : 'dealer'),
        partyName: nameMap.get(l.partyId) || `Party (${l.partyId.slice(0, 8)})`,
        b0_30: 0,
        b31_60: 0,
        b61_90: 0,
        bOver90: 0,
        total: 0,
      }
      partyBuckets.set(l.partyId, entry)
    }

    entry.total += net
    if (ageDays <= 30) {
      entry.b0_30 += net
    } else if (ageDays <= 60) {
      entry.b31_60 += net
    } else if (ageDays <= 90) {
      entry.b61_90 += net
    } else {
      entry.bOver90 += net
    }
  }

  const parties: AgingPartyRow[] = []
  let total0to30 = 0
  let total31to60 = 0
  let total61to90 = 0
  let totalOver90 = 0
  let grandTotal = 0

  for (const entry of partyBuckets.values()) {
    if (entry.total === 0 && entry.b0_30 === 0 && entry.b31_60 === 0 && entry.b61_90 === 0 && entry.bOver90 === 0) {
      continue
    }
    parties.push({
      partyId: entry.partyId,
      partyType: entry.partyType,
      partyName: entry.partyName,
      currentBalance: entry.b0_30,
      days31to60: entry.b31_60,
      days61to90: entry.b61_90,
      daysOver90: entry.bOver90,
      totalOutstanding: entry.total,
    })

    total0to30 += entry.b0_30
    total31to60 += entry.b31_60
    total61to90 += entry.b61_90
    totalOver90 += entry.bOver90
    grandTotal += entry.total
  }

  return {
    type,
    asOfDate: asOf.toISOString(),
    parties: parties.sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    total0to30,
    total31to60,
    total61to90,
    totalOver90,
    grandTotal,
  }
}

// ============================================================================
// 8. SUB-LEDGER INTEGRITY & RECONCILIATION AUDIT
// ============================================================================

export interface SubLedgerIntegrityItem {
  controlAccountCode: string
  controlAccountName: string
  controlAccountBalance: number // paisa
  sumOfPartyBalances: number // paisa
  difference: number // paisa
  isReconciled: boolean
  partyCount: number
}

export interface AccountingIntegrityAuditResult {
  globalBalanced: boolean
  totalGlobalDebit: number
  totalGlobalCredit: number
  globalDifference: number
  subLedgers: SubLedgerIntegrityItem[]
  unbalancedVouchersCount: number
  auditPassed: boolean
}

export async function getAccountingIntegrityAuditQuery(): Promise<AccountingIntegrityAuditResult> {
  // 1. Global Debit == Credit Check across ALL posted lines
  const globalAgg = await db
    .select({
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
      ),
    )

  const totalGlobalDebit = Number(globalAgg[0]?.totalDebit || 0)
  const totalGlobalCredit = Number(globalAgg[0]?.totalCredit || 0)
  const globalDifference = Math.abs(totalGlobalDebit - totalGlobalCredit)
  const globalBalanced = globalDifference === 0

  // 2. Check each party-controlled control account
  const controlChecks = [
    { key: 'DEALER_PAYABLE', partyType: 'dealer', label: 'Dealer Procurement Payable' },
    { key: 'RIDER_COD_CASH', partyType: 'rider', label: 'Rider Undeposited COD Cash' },
    { key: 'RIDER_PAYABLE', partyType: 'rider', label: 'Rider Compensation & Salary Payable' },
    { key: 'CUSTOMER_RECEIVABLE', partyType: 'customer', label: 'Customer Receivables' },
    { key: 'STAFF_RIDER_ADVANCES', partyType: 'rider', label: 'Staff & Rider Advances' },
  ]

  const subLedgers: SubLedgerIntegrityItem[] = []
  let allSubLedgersReconciled = true

  for (const c of controlChecks) {
    const accId = await resolveAccount(db, c.key)
    const acc = await db
      .select()
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.id, accId))
      .limit(1)

    const isDebitNormal =
      acc[0]?.rootType === 'asset' || acc[0]?.rootType === 'expense'

    // Control account total
    const ctrlLine = await db
      .select({
        debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id),
      )
      .where(
        and(
          eq(journalLines.accountId, accId),
          inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
          eq(journalEntries.isReversed, false),
        ),
      )

    const ctrlDr = Number(ctrlLine[0]?.debit || 0)
    const ctrlCr = Number(ctrlLine[0]?.credit || 0)
    const controlBalance = isDebitNormal ? ctrlDr - ctrlCr : ctrlCr - ctrlDr

    // Sum of party lines
    const partyLines = await db
      .select({
        partyId: journalLines.partyId,
        debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id),
      )
      .where(
        and(
          eq(journalLines.accountId, accId),
          eq(journalLines.partyType, c.partyType),
          inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
          eq(journalEntries.isReversed, false),
        ),
      )
      .groupBy(journalLines.partyId)

    let sumPartyBalances = 0
    let partyCount = 0

    for (const p of partyLines) {
      if (p.partyId) {
        partyCount++
        const pDr = Number(p.debit)
        const pCr = Number(p.credit)
        const pNet = isDebitNormal ? pDr - pCr : pCr - pDr
        sumPartyBalances += pNet
      }
    }

    const diff = Math.abs(controlBalance - sumPartyBalances)
    const isReconciled = diff === 0
    if (!isReconciled) allSubLedgersReconciled = false

    subLedgers.push({
      controlAccountCode: acc[0]?.code || '',
      controlAccountName: acc[0]?.name || c.label,
      controlAccountBalance: controlBalance,
      sumOfPartyBalances: sumPartyBalances,
      difference: diff,
      isReconciled,
      partyCount,
    })
  }

  // 3. Unbalanced vouchers check
  const voucherChecks = await db
    .select({
      entryId: journalLines.journalEntryId,
      debit: sql<number>`SUM(${journalLines.debit})`,
      credit: sql<number>`SUM(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        inArray(journalEntries.postingStatus, POSTED_VOUCHER_STATUSES as unknown as string[]),
        eq(journalEntries.isReversed, false),
      ),
    )
    .groupBy(journalLines.journalEntryId)
    .having(sql`SUM(${journalLines.debit}) <> SUM(${journalLines.credit})`)

  const unbalancedVouchersCount = voucherChecks.length

  const auditPassed =
    globalBalanced && allSubLedgersReconciled && unbalancedVouchersCount === 0

  return {
    globalBalanced,
    totalGlobalDebit,
    totalGlobalCredit,
    globalDifference,
    subLedgers,
    unbalancedVouchersCount,
    auditPassed,
  }
}

