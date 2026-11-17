import { db, dbTx } from '#/db'
import {
  accountingPeriods,
  fiscalYears,
  journalEntries,
  journalLines,
  ledgerAccounts,
  periodClosingVouchers,
} from '#/db/schema'
import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
import { resolveAccount } from './account-keys'
import { postJournalTx, postPeriodClosingTx } from './double-entry'
import type { FinanceActor, JournalLineInput } from './types'

export interface BSPeriodItem {
  id: string
  fiscalYearId: string
  fiscalYearName?: string
  periodNo: number
  name: string
  startDate: string
  endDate: string
  status: 'open' | 'closed'
  closedAt: string | null
  closedBy: string | null
  createdAt: string
}

export const NEPAL_BS_MONTHS = [
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
  'Baisakh',
  'Jestha',
  'Ashadh',
] as const

export async function getAccountingPeriodsQuery(
  fiscalYearId?: string,
): Promise<BSPeriodItem[]> {
  const conditions = []
  if (fiscalYearId) {
    conditions.push(eq(accountingPeriods.fiscalYearId, fiscalYearId))
  }

  const rows = await db
    .select({
      id: accountingPeriods.id,
      fiscalYearId: accountingPeriods.fiscalYearId,
      fiscalYearName: fiscalYears.name,
      periodNo: accountingPeriods.periodNo,
      name: accountingPeriods.name,
      startDate: accountingPeriods.startDate,
      endDate: accountingPeriods.endDate,
      status: accountingPeriods.status,
      closedAt: accountingPeriods.closedAt,
      closedBy: accountingPeriods.closedBy,
      createdAt: accountingPeriods.createdAt,
    })
    .from(accountingPeriods)
    .innerJoin(fiscalYears, eq(accountingPeriods.fiscalYearId, fiscalYears.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(accountingPeriods.periodNo))

  return rows.map((r) => ({
    id: r.id,
    fiscalYearId: r.fiscalYearId,
    fiscalYearName: r.fiscalYearName,
    periodNo: r.periodNo,
    name: r.name,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    status: r.status as 'open' | 'closed',
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    closedBy: r.closedBy,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function generateBsPeriodsForFiscalYearQuery(
  fiscalYearId: string,
): Promise<{ count: number }> {
  const fy = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fiscalYearId))
    .limit(1)

  if (!fy[0]) throw new Error(`Fiscal Year ${fiscalYearId} not found.`)

  const fyStart = new Date(fy[0].startDate)
  const fyEnd = new Date(fy[0].endDate)
  const totalDays = (fyEnd.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24)
  const approxMonthDays = Math.floor(totalDays / 12)

  let count = 0
  for (let i = 0; i < 12; i++) {
    const periodNo = i + 1
    const monthName = NEPAL_BS_MONTHS[i]
    const pStart = new Date(fyStart.getTime() + i * approxMonthDays * 86400000)
    const pEnd =
      i === 11
        ? new Date(fyEnd)
        : new Date(fyStart.getTime() + (i + 1) * approxMonthDays * 86400000 - 1)

    const id = `period_${fy[0].id}_${periodNo.toString().padStart(2, '0')}`

    await db
      .insert(accountingPeriods)
      .values({
        id,
        fiscalYearId: fy[0].id,
        periodNo,
        name: `${monthName} (${fy[0].name})`,
        startDate: pStart,
        endDate: pEnd,
        status: 'open',
      })
      .onConflictDoNothing()

    count++
  }

  return { count }
}

export async function lockAccountingPeriodQuery(
  periodId: string,
  actor: FinanceActor,
): Promise<{ success: boolean }> {
  await db
    .update(accountingPeriods)
    .set({
      status: 'closed',
      closedAt: new Date(),
      closedBy: actor.name,
    })
    .where(eq(accountingPeriods.id, periodId))

  return { success: true }
}

export async function unlockAccountingPeriodQuery(
  periodId: string,
): Promise<{ success: boolean }> {
  await db
    .update(accountingPeriods)
    .set({
      status: 'open',
      closedAt: null,
      closedBy: null,
    })
    .where(eq(accountingPeriods.id, periodId))

  return { success: true }
}

export async function postYearEndClosingVoucherQuery(params: {
  fiscalYearId: string
  actor: FinanceActor
}): Promise<{ voucherNo: string | null; netProfitOrLoss: number }> {
  const fy = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, params.fiscalYearId))
    .limit(1)

  if (!fy[0]) throw new Error(`Fiscal Year ${params.fiscalYearId} not found.`)
  if (fy[0].isClosed) {
    throw new Error(`Fiscal Year ${fy[0].name} has already been closed.`)
  }

  // Verify no open drafts exist in this fiscal year
  const drafts = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.fiscalYearId, params.fiscalYearId),
        eq(journalEntries.postingStatus, 'draft'),
      ),
    )

  if (Number(drafts[0]?.count || 0) > 0) {
    throw new Error(
      `Cannot close fiscal year: There are ${drafts[0].count} unsubmitted draft voucher(s). Submit or delete all drafts first.`,
    )
  }

  // Pre-closing Trial Balance verification check: Total debits must equal total credits
  const tbTotals = await db
    .select({
      totalDr: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCr: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        eq(journalEntries.fiscalYearId, params.fiscalYearId),
        eq(journalEntries.postingStatus, 'submitted'),
      ),
    )

  const sumDr = Number(tbTotals[0]?.totalDr || 0)
  const sumCr = Number(tbTotals[0]?.totalCr || 0)
  if (sumDr !== sumCr) {
    throw new Error(
      `Cannot close fiscal year: General Ledger Trial Balance is out of balance. Total Debits: Rs. ${(sumDr / 100).toFixed(2)}, Total Credits: Rs. ${(sumCr / 100).toFixed(2)} (Difference: Rs. ${(Math.abs(sumDr - sumCr) / 100).toFixed(2)}).`,
    )
  }

  // Fetch all Income and Expense balances for this FY
  const rows = await db
    .select({
      accountId: journalLines.accountId,
      code: ledgerAccounts.code,
      name: ledgerAccounts.name,
      rootType: ledgerAccounts.rootType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(
      and(
        eq(journalEntries.fiscalYearId, params.fiscalYearId),
        eq(journalEntries.postingStatus, 'submitted'),
        sql`${ledgerAccounts.rootType} IN ('income', 'expense')`,
      ),
    )
    .groupBy(
      journalLines.accountId,
      ledgerAccounts.code,
      ledgerAccounts.name,
      ledgerAccounts.rootType,
    )

  const retainedEarningsAccountId = await resolveAccount(
    db,
    'RETAINED_EARNINGS',
  )

  const closingLines: JournalLineInput[] = []
  let totalIncome = 0
  let totalExpenses = 0

  for (const r of rows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)

    if (r.rootType === 'income') {
      const net = cr - dr
      if (net !== 0) {
        totalIncome += net
        // Debit income to zero it out
        closingLines.push({
          accountId: r.accountId,
          debit: net > 0 ? net : 0,
          credit: net < 0 ? Math.abs(net) : 0,
          costCenter: 'general' as const,
          narration: `Close ${r.name} into Retained Earnings`,
        })
      }
    } else if (r.rootType === 'expense') {
      const net = dr - cr
      if (net !== 0) {
        totalExpenses += net
        // Credit expense to zero it out
        closingLines.push({
          accountId: r.accountId,
          debit: net < 0 ? Math.abs(net) : 0,
          credit: net > 0 ? net : 0,
          costCenter: 'general' as const,
          narration: `Close ${r.name} into Retained Earnings`,
        })
      }
    }
  }

  const netProfitOrLoss = totalIncome - totalExpenses

  // Credit Retained Earnings if Profit (net > 0), Debit if Loss (net < 0)
  if (netProfitOrLoss !== 0) {
    closingLines.push({
      accountId: retainedEarningsAccountId,
      debit: netProfitOrLoss < 0 ? Math.abs(netProfitOrLoss) : 0,
      credit: netProfitOrLoss > 0 ? netProfitOrLoss : 0,
      costCenter: 'general' as const,
      narration: `Net ${netProfitOrLoss >= 0 ? 'Profit' : 'Loss'} transferred to Retained Earnings for FY ${fy[0].name}`,
    })
  }

  if (closingLines.length === 0) {
    throw new Error('No income or expense balances found to close.')
  }

  return dbTx.transaction(async (tx) => {
    const closingPosting = await postPeriodClosingTx(tx, {
      fiscalYearId: fy[0].id,
      fiscalYearName: fy[0].name,
      lines: closingLines,
      retainedEarningsAccountId,
      netProfitOrLoss,
      narration: `Period Closing Voucher: Transferred FY ${fy[0].name} net profit/loss to Retained Earnings`,
      postingDate: new Date(fy[0].endDate),
      actor: params.actor,
    })

    const closingId = `pcv_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

    await tx.insert(periodClosingVouchers).values({
      id: closingId,
      fiscalYearId: fy[0].id,
      closingJournalEntryId: closingPosting.journalEntryId,
      retainedEarningsAccountId,
      netProfitOrLoss,
      closedBy: params.actor.name,
      closedAt: new Date(),
    })

    await tx
      .update(fiscalYears)
      .set({
        isClosed: true,
        closedAt: new Date(),
        closedBy: params.actor.name,
      })
      .where(eq(fiscalYears.id, fy[0].id))

    // Automatically lock all 12 BS periods for this closed fiscal year
    await tx
      .update(accountingPeriods)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy: params.actor.name,
      })
      .where(eq(accountingPeriods.fiscalYearId, fy[0].id))

    return {
      voucherNo: closingPosting.voucherNo,
      netProfitOrLoss,
    }
  })
}

export interface PreCloseVerificationResult {
  fiscalYearId: string
  fiscalYearName: string
  isClosed: boolean
  isTrialBalanceBalanced: boolean
  totalDebits: number
  totalCredits: number
  trialBalanceDifference: number
  draftCount: number
  openPeriodCount: number
  totalIncome: number
  totalExpenses: number
  netProfitOrLoss: number
  retainedEarningsAccount: {
    id: string
    code: string
    name: string
  }
  canClose: boolean
  blockingReasons: string[]
  warnings: string[]
}

export async function verifyFiscalYearPreCloseQuery(
  fiscalYearId: string,
): Promise<PreCloseVerificationResult> {
  const fy = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fiscalYearId))
    .limit(1)

  if (!fy[0]) throw new Error(`Fiscal Year "${fiscalYearId}" not found.`)

  const blockingReasons: string[] = []
  const warnings: string[] = []

  if (fy[0].isClosed) {
    blockingReasons.push(`Fiscal Year "${fy[0].name}" is already closed.`)
  }

  // 1. Check Draft Vouchers
  const drafts = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.fiscalYearId, fiscalYearId),
        eq(journalEntries.postingStatus, 'draft'),
      ),
    )

  const draftCount = Number(drafts[0]?.count || 0)
  if (draftCount > 0) {
    blockingReasons.push(
      `There are ${draftCount} unsubmitted draft voucher(s). All drafts must be approved or deleted before closing.`,
    )
  }

  // 2. Check Trial Balance Balance
  const tbTotals = await db
    .select({
      totalDr: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCr: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        eq(journalEntries.fiscalYearId, fiscalYearId),
        eq(journalEntries.postingStatus, 'submitted'),
      ),
    )

  const totalDebits = Number(tbTotals[0]?.totalDr || 0)
  const totalCredits = Number(tbTotals[0]?.totalCr || 0)
  const isTrialBalanceBalanced = totalDebits === totalCredits
  const trialBalanceDifference = Math.abs(totalDebits - totalCredits)

  if (!isTrialBalanceBalanced) {
    blockingReasons.push(
      `General Ledger Trial Balance is unbalanced! Debits: Rs. ${(totalDebits / 100).toFixed(2)}, Credits: Rs. ${(totalCredits / 100).toFixed(2)} (Difference: Rs. ${(trialBalanceDifference / 100).toFixed(2)}).`,
    )
  }

  // 3. Check Open BS Periods
  const openPeriods = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.fiscalYearId, fiscalYearId),
        eq(accountingPeriods.status, 'open'),
      ),
    )

  const openPeriodCount = Number(openPeriods[0]?.count || 0)
  if (openPeriodCount > 0) {
    warnings.push(
      `${openPeriodCount} BS monthly accounting period(s) remain open. They will be locked automatically upon fiscal year closing.`,
    )
  }

  // 4. Calculate P&L summary
  const rows = await db
    .select({
      rootType: ledgerAccounts.rootType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(
      and(
        eq(journalEntries.fiscalYearId, fiscalYearId),
        eq(journalEntries.postingStatus, 'submitted'),
        sql`${ledgerAccounts.rootType} IN ('income', 'expense')`,
      ),
    )
    .groupBy(ledgerAccounts.rootType)

  let totalIncome = 0
  let totalExpenses = 0

  for (const r of rows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)
    if (r.rootType === 'income') {
      totalIncome = cr - dr
    } else if (r.rootType === 'expense') {
      totalExpenses = dr - cr
    }
  }

  const netProfitOrLoss = totalIncome - totalExpenses

  // 5. Retained Earnings Account
  const retainedEarningsAccountId = await resolveAccount(
    db,
    'RETAINED_EARNINGS',
  )
  const retAcc = await db
    .select({ id: ledgerAccounts.id, code: ledgerAccounts.code, name: ledgerAccounts.name })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, retainedEarningsAccountId))
    .limit(1)

  const canClose = blockingReasons.length === 0

  return {
    fiscalYearId: fy[0].id,
    fiscalYearName: fy[0].name,
    isClosed: Boolean(fy[0].isClosed),
    isTrialBalanceBalanced,
    totalDebits,
    totalCredits,
    trialBalanceDifference,
    draftCount,
    openPeriodCount,
    totalIncome,
    totalExpenses,
    netProfitOrLoss,
    retainedEarningsAccount: retAcc[0] || {
      id: retainedEarningsAccountId,
      code: '3020',
      name: 'Retained Earnings',
    },
    canClose,
    blockingReasons,
    warnings,
  }
}

export interface PeriodClosingHistoryItem {
  id: string
  fiscalYearId: string
  fiscalYearName: string
  closingJournalEntryId: string
  voucherNo: string | null
  retainedEarningsAccountId: string
  retainedEarningsAccountName: string
  retainedEarningsAccountCode: string
  netProfitOrLoss: number
  closedBy: string
  closedAt: string
}

export async function getPeriodClosingHistoryQuery(): Promise<
  PeriodClosingHistoryItem[]
> {
  const rows = await db
    .select({
      id: periodClosingVouchers.id,
      fiscalYearId: periodClosingVouchers.fiscalYearId,
      fiscalYearName: fiscalYears.name,
      closingJournalEntryId: periodClosingVouchers.closingJournalEntryId,
      voucherNo: journalEntries.voucherNo,
      retainedEarningsAccountId: periodClosingVouchers.retainedEarningsAccountId,
      retainedEarningsAccountName: ledgerAccounts.name,
      retainedEarningsAccountCode: ledgerAccounts.code,
      netProfitOrLoss: periodClosingVouchers.netProfitOrLoss,
      closedBy: periodClosingVouchers.closedBy,
      closedAt: periodClosingVouchers.closedAt,
    })
    .from(periodClosingVouchers)
    .innerJoin(fiscalYears, eq(periodClosingVouchers.fiscalYearId, fiscalYears.id))
    .innerJoin(
      journalEntries,
      eq(periodClosingVouchers.closingJournalEntryId, journalEntries.id),
    )
    .innerJoin(
      ledgerAccounts,
      eq(periodClosingVouchers.retainedEarningsAccountId, ledgerAccounts.id),
    )
    .orderBy(desc(periodClosingVouchers.closedAt))

  return rows.map((r) => ({
    id: r.id,
    fiscalYearId: r.fiscalYearId,
    fiscalYearName: r.fiscalYearName,
    closingJournalEntryId: r.closingJournalEntryId,
    voucherNo: r.voucherNo,
    retainedEarningsAccountId: r.retainedEarningsAccountId,
    retainedEarningsAccountName: r.retainedEarningsAccountName,
    retainedEarningsAccountCode: r.retainedEarningsAccountCode,
    netProfitOrLoss: r.netProfitOrLoss,
    closedBy: r.closedBy,
    closedAt: r.closedAt.toISOString(),
  }))
}

export interface CarryForwardOBResult {
  voucherNo: string | null
  journalEntryId: string
  targetFiscalYearId: string
  totalAssetDebit: number
  totalLiabilityCredit: number
  lineCount: number
}

export async function carryForwardOpeningBalancesQuery(params: {
  fromFiscalYearId: string
  toFiscalYearId: string
  actor: FinanceActor
}): Promise<CarryForwardOBResult> {
  const [fromFy, toFy] = await Promise.all([
    db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.id, params.fromFiscalYearId))
      .limit(1),
    db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.id, params.toFiscalYearId))
      .limit(1),
  ])

  if (!fromFy[0]) {
    throw new Error(`Source fiscal year "${params.fromFiscalYearId}" not found.`)
  }
  if (!toFy[0]) {
    throw new Error(`Target fiscal year "${params.toFiscalYearId}" not found.`)
  }

  if (!fromFy[0].isClosed) {
    throw new Error(
      `Cannot carry forward opening balances: Source fiscal year "${fromFy[0].name}" must be closed first.`,
    )
  }
  if (toFy[0].isClosed) {
    throw new Error(
      `Cannot carry forward opening balances into closed fiscal year "${toFy[0].name}".`,
    )
  }

  // Check if an Opening Balance voucher already exists in target FY
  const existingOB = await db
    .select({ id: journalEntries.id, voucherNo: journalEntries.voucherNo })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.fiscalYearId, params.toFiscalYearId),
        eq(journalEntries.voucherType, 'OB'),
        eq(journalEntries.postingStatus, 'submitted'),
      ),
    )
    .limit(1)

  if (existingOB[0]) {
    throw new Error(
      `Opening Balance voucher already exists for fiscal year "${toFy[0].name}" (Voucher: ${existingOB[0].voucherNo || existingOB[0].id}). Duplicate opening balances are prohibited.`,
    )
  }

  // Fetch cumulative closing balances for all permanent Balance Sheet accounts (Asset, Liability, Equity)
  // up to the end date of the closed source fiscal year
  const rows = await db
    .select({
      accountId: journalLines.accountId,
      code: ledgerAccounts.code,
      name: ledgerAccounts.name,
      rootType: ledgerAccounts.rootType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(
      and(
        lte(journalEntries.postingDate, new Date(fromFy[0].endDate)),
        eq(journalEntries.postingStatus, 'submitted'),
        sql`${ledgerAccounts.rootType} IN ('asset', 'liability', 'equity')`,
        eq(ledgerAccounts.isGroup, false),
      ),
    )
    .groupBy(
      journalLines.accountId,
      ledgerAccounts.code,
      ledgerAccounts.name,
      ledgerAccounts.rootType,
    )

  const obLines: JournalLineInput[] = []
  let totalAssetDebit = 0
  let totalLiabilityCredit = 0

  for (const r of rows) {
    const dr = Number(r.debit)
    const cr = Number(r.credit)

    if (r.rootType === 'asset') {
      const netDr = dr - cr
      if (netDr > 0) {
        obLines.push({
          accountId: r.accountId,
          debit: netDr,
          credit: 0,
          narration: `Opening balance for ${r.name}`,
          costCenter: 'general',
        })
        totalAssetDebit += netDr
      } else if (netDr < 0) {
        obLines.push({
          accountId: r.accountId,
          debit: 0,
          credit: Math.abs(netDr),
          narration: `Opening balance (credit) for ${r.name}`,
          costCenter: 'general',
        })
        totalLiabilityCredit += Math.abs(netDr)
      }
    } else {
      // liability or equity
      const netCr = cr - dr
      if (netCr > 0) {
        obLines.push({
          accountId: r.accountId,
          debit: 0,
          credit: netCr,
          narration: `Opening balance for ${r.name}`,
          costCenter: 'general',
        })
        totalLiabilityCredit += netCr
      } else if (netCr < 0) {
        obLines.push({
          accountId: r.accountId,
          debit: Math.abs(netCr),
          credit: 0,
          narration: `Opening balance (debit) for ${r.name}`,
          costCenter: 'general',
        })
        totalAssetDebit += Math.abs(netCr)
      }
    }
  }

  if (obLines.length === 0) {
    throw new Error(
      `No permanent balance sheet accounts found with non-zero balances in FY ${fromFy[0].name}.`,
    )
  }

  // Ensure balance
  if (totalAssetDebit !== totalLiabilityCredit) {
    throw new Error(
      `Opening balances cannot be carried forward: Unbalanced Balance Sheet as of FY ${fromFy[0].name}. Total Debits (${totalAssetDebit} paisa) != Total Credits (${totalLiabilityCredit} paisa). Difference: ${totalAssetDebit - totalLiabilityCredit} paisa.`,
    )
  }

  const result = await dbTx.transaction(async (tx) => {
    return postJournalTx(tx, {
      voucherType: 'OB',
      postingDate: new Date(toFy[0].startDate),
      narration: `Opening Balance Voucher: Carried forward permanent account balances from FY ${fromFy[0].name}`,
      refType: 'opening_balance',
      refId: params.fromFiscalYearId,
      lines: obLines,
      createdBy: params.actor?.name || 'System',
      postingStatus: 'submitted',
    })
  })

  return {
    voucherNo: result.voucherNo,
    journalEntryId: result.journalEntryId,
    targetFiscalYearId: params.toFiscalYearId,
    totalAssetDebit,
    totalLiabilityCredit,
    lineCount: obLines.length,
  }
}
