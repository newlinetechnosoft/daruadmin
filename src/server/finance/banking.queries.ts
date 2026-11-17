import { db, dbTx } from '#/db'
import {
  bankAccounts,
  bankTransactions,
  branches,
  journalEntries,
  journalLines,
  ledgerAccounts,
} from '#/db/schema'
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { resolveAccount } from './account-keys'
import { postJournalTx } from './double-entry'
import type { DbTx, FinanceActor } from './types'

export interface BankAccountItem {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
  branchName: string | null
  ledgerAccountId: string | null
  ledgerAccountName?: string | null
  ledgerAccountCode?: string | null
  currency: string
  openingBalance: number // paisa
  ledgerBalance: number // calculated real-time from GL in paisa
  branchId: string | null
  branchNameStr?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export async function getBankAccountsQuery(): Promise<BankAccountItem[]> {
  const rows = await db
    .select({
      id: bankAccounts.id,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      accountName: bankAccounts.accountName,
      branchName: bankAccounts.branchName,
      ledgerAccountId: bankAccounts.ledgerAccountId,
      ledgerAccountName: ledgerAccounts.name,
      ledgerAccountCode: ledgerAccounts.code,
      currency: bankAccounts.currency,
      openingBalance: bankAccounts.openingBalance,
      branchId: bankAccounts.branchId,
      companyBranchName: branches.name,
      isActive: bankAccounts.isActive,
      createdAt: bankAccounts.createdAt,
      updatedAt: bankAccounts.updatedAt,
    })
    .from(bankAccounts)
    .leftJoin(ledgerAccounts, eq(bankAccounts.ledgerAccountId, ledgerAccounts.id))
    .leftJoin(branches, eq(bankAccounts.branchId, branches.id))
    .orderBy(asc(bankAccounts.bankName))

  // Calculate real-time ledger balance for each linked account
  const ledgerAccountIds = rows
    .map((r) => r.ledgerAccountId)
    .filter((id): id is string => id !== null)

  const balanceMap = new Map<string, number>()
  if (ledgerAccountIds.length > 0) {
    const lines = await db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          sql`${journalLines.accountId} IN (${sql.join(
            ledgerAccountIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          inArray(journalEntries.postingStatus, ['submitted', 'approved']),
          eq(journalEntries.isReversed, false),
        ),
      )
      .groupBy(journalLines.accountId)

    for (const l of lines) {
      // Asset normal balance = Dr - Cr
      balanceMap.set(l.accountId, Number(l.totalDebit) - Number(l.totalCredit))
    }
  }

  return rows.map((r) => ({
    id: r.id,
    bankName: r.bankName,
    accountNumber: r.accountNumber,
    accountName: r.accountName,
    branchName: r.branchName,
    ledgerAccountId: r.ledgerAccountId,
    ledgerAccountName: r.ledgerAccountName,
    ledgerAccountCode: r.ledgerAccountCode,
    currency: r.currency,
    openingBalance: r.openingBalance,
    ledgerBalance: r.ledgerAccountId
      ? (balanceMap.get(r.ledgerAccountId) || 0)
      : r.openingBalance,
    branchId: r.branchId,
    branchNameStr: r.companyBranchName,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export interface CreateBankAccountInput {
  bankName: string
  accountNumber: string
  accountName: string
  branchName?: string | null
  ledgerAccountId?: string | null
  currency?: string
  openingBalance?: number // paisa
  branchId?: string | null
}

export async function createBankAccountQuery(
  input: CreateBankAccountInput,
  tx?: DbTx,
): Promise<{ id: string; bankName: string; accountNumber: string }> {
  const runner = tx || db
  const id = `bank_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

  await runner.insert(bankAccounts).values({
    id,
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.trim(),
    accountName: input.accountName.trim(),
    branchName: input.branchName?.trim() || null,
    ledgerAccountId: input.ledgerAccountId || null,
    currency: input.currency || 'NPR',
    openingBalance: input.openingBalance || 0,
    currentBalance: input.openingBalance || 0,
    branchId: input.branchId || null,
    isActive: true,
  })

  return { id, bankName: input.bankName, accountNumber: input.accountNumber }
}

export async function getCashInHandSummaryQuery(): Promise<{
  accountId: string
  accountName: string
  accountCode: string
  totalDebit: number
  totalCredit: number
  currentBalance: number // paisa
}> {
  const cashAccountId = await resolveAccount(db, 'CASH_IN_HAND')

  const acc = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, cashAccountId))
    .limit(1)

  const lines = await db
    .select({
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, cashAccountId),
        inArray(journalEntries.postingStatus, ['submitted', 'approved']),
        eq(journalEntries.isReversed, false),
      ),
    )

  const totalDebit = Number(lines[0]?.totalDebit || 0)
  const totalCredit = Number(lines[0]?.totalCredit || 0)
  const currentBalance = totalDebit - totalCredit

  return {
    accountId: cashAccountId,
    accountName: acc[0]?.name || 'Cash in Hand',
    accountCode: acc[0]?.code || '1011',
    totalDebit,
    totalCredit,
    currentBalance,
  }
}

export interface CashClosingResult {
  expectedCash: number
  physicalCashCounted: number
  variance: number // physical - expected
  voucherNo?: string | null
}

export async function recordCashClosingQuery(params: {
  physicalCashCounted: number // paisa
  notes?: string
  branchId?: string | null
  actor: FinanceActor
}): Promise<CashClosingResult> {
  const cashSummary = await getCashInHandSummaryQuery()
  const expectedCash = cashSummary.currentBalance
  const variance = params.physicalCashCounted - expectedCash

  let voucherNo: string | null = null

  if (variance !== 0) {
    // Post adjustment voucher for shortage or excess
    const roundOffAccountId = await resolveAccount(db, 'ROUND_OFF')
    const lines: Array<{
      accountId: string
      debit?: number
      credit?: number
      branchId: string | null
      costCenter: 'general'
      narration: string
    }> = []

    if (variance < 0) {
      // Shortage: Dr. Shortage/Expense (acc_5114 ROUND_OFF), Cr. Cash in Hand (acc_1011)
      const shortage = Math.abs(variance)
      lines.push({
        accountId: roundOffAccountId,
        debit: shortage,
        branchId: params.branchId || null,
        costCenter: 'general' as const,
        narration: `Day-end cash shortage adjustment`,
      })
      lines.push({
        accountId: cashSummary.accountId,
        credit: shortage,
        branchId: params.branchId || null,
        costCenter: 'general' as const,
        narration: `Physical cash count shortage (Expected Rs. ${(expectedCash / 100).toFixed(2)}, Counted Rs. ${(params.physicalCashCounted / 100).toFixed(2)})`,
      })
    } else {
      // Excess: Dr. Cash in Hand (acc_1011), Cr. Other Income / Round Off
      const excess = variance
      lines.push({
        accountId: cashSummary.accountId,
        debit: excess,
        branchId: params.branchId || null,
        costCenter: 'general' as const,
        narration: `Day-end cash excess adjustment (Expected Rs. ${(expectedCash / 100).toFixed(2)}, Counted Rs. ${(params.physicalCashCounted / 100).toFixed(2)})`,
      })
      lines.push({
        accountId: roundOffAccountId,
        credit: excess,
        branchId: params.branchId || null,
        costCenter: 'general' as const,
        narration: `Physical cash count excess booked to adjustment`,
      })
    }

    const posting = await dbTx.transaction(async (tx) => {
      return postJournalTx(tx, {
        voucherType: 'JV',
        postingDate: new Date(),
        narration: `Day-end cash closing adjustment (Z-Report): ${params.notes || 'Reconciled to physical count'}`,
        refType: 'cash_closing',
        refId: `z_${Date.now()}`,
        event: 'cash_closing_reconciliation',
        branchId: params.branchId || null,
        createdBy: params.actor.name,
        metadata: {
          expectedCash,
          physicalCashCounted: params.physicalCashCounted,
          variance,
        },
        lines,
      })
    })

    voucherNo = posting.voucherNo
  }

  return {
    expectedCash,
    physicalCashCounted: params.physicalCashCounted,
    variance,
    voucherNo,
  }
}

export interface BankTransactionItem {
  id: string
  bankAccountId: string
  transactionDate: string
  description: string
  referenceNo: string | null
  debit: number // paisa
  credit: number // paisa
  matchedJournalLineId: string | null
  status: 'unmatched' | 'matched' | 'cleared'
  reconciledAt: string | null
  reconciledBy: string | null
  notes: string | null
  createdAt: string
}

export async function getBankTransactionsQuery(params: {
  bankAccountId: string
  status?: string
}): Promise<BankTransactionItem[]> {
  const conditions = [eq(bankTransactions.bankAccountId, params.bankAccountId)]
  if (params.status && params.status !== 'all') {
    conditions.push(eq(bankTransactions.status, params.status))
  }

  const rows = await db
    .select()
    .from(bankTransactions)
    .where(and(...conditions))
    .orderBy(desc(bankTransactions.transactionDate), desc(bankTransactions.createdAt))

  return rows.map((r) => ({
    id: r.id,
    bankAccountId: r.bankAccountId,
    transactionDate: r.transactionDate.toISOString(),
    description: r.description,
    referenceNo: r.referenceNo,
    debit: r.debit,
    credit: r.credit,
    matchedJournalLineId: r.matchedJournalLineId,
    status: r.status as 'unmatched' | 'matched' | 'cleared',
    reconciledAt: r.reconciledAt ? r.reconciledAt.toISOString() : null,
    reconciledBy: r.reconciledBy,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function matchBankTransactionQuery(params: {
  bankTransactionId: string
  journalLineId: string
  actor: FinanceActor
}): Promise<{ success: boolean }> {
  const now = new Date()

  await db
    .update(bankTransactions)
    .set({
      matchedJournalLineId: params.journalLineId,
      status: 'matched',
      reconciledAt: now,
      reconciledBy: params.actor.name,
    })
    .where(eq(bankTransactions.id, params.bankTransactionId))

  return { success: true }
}

export async function clearBankTransactionQuery(
  bankTransactionId: string,
): Promise<{ success: boolean }> {
  await db
    .update(bankTransactions)
    .set({
      matchedJournalLineId: null,
      status: 'unmatched',
      reconciledAt: null,
      reconciledBy: null,
    })
    .where(eq(bankTransactions.id, bankTransactionId))

  return { success: true }
}

export interface CashClosingHistoryItem {
  id: string
  voucherNo: string | null
  postingDate: string
  narration: string
  createdBy: string
  createdAt: string
  expectedCash: number
  physicalCashCounted: number
  variance: number
}

export async function getCashClosingHistoryQuery(params: {
  branchId?: string
  limit?: number
} = {}): Promise<CashClosingHistoryItem[]> {
  const conditions = [eq(journalEntries.refType, 'cash_closing')]
  if (params.branchId) {
    conditions.push(eq(journalEntries.branchId, params.branchId))
  }
  const rows = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      postingDate: journalEntries.postingDate,
      narration: journalEntries.narration,
      createdBy: journalEntries.createdBy,
      createdAt: journalEntries.createdAt,
      metadata: journalEntries.metadata,
    })
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.postingDate), desc(journalEntries.createdAt))
    .limit(params.limit ?? 20)

  return rows.map((r) => {
    const meta = (r.metadata as Record<string, any> | null) || {}
    return {
      id: r.id,
      voucherNo: r.voucherNo,
      postingDate: r.postingDate.toISOString(),
      narration: r.narration,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      expectedCash: typeof meta.expectedCash === 'number' ? meta.expectedCash : 0,
      physicalCashCounted:
        typeof meta.physicalCashCounted === 'number'
          ? meta.physicalCashCounted
          : 0,
      variance: typeof meta.variance === 'number' ? meta.variance : 0,
    }
  })
}

export interface CashAccountItem {
  id: string
  code: string
  name: string
  totalDebit: number
  totalCredit: number
  currentBalance: number // paisa
  isActive: boolean
}

export async function getCashAccountsQuery(): Promise<CashAccountItem[]> {
  const cashRows = await db
    .select({
      id: ledgerAccounts.id,
      code: ledgerAccounts.code,
      name: ledgerAccounts.name,
      isActive: ledgerAccounts.isActive,
    })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.rootType, 'asset'),
        eq(ledgerAccounts.isGroup, false),
        sql`(${ledgerAccounts.accountType} = 'cash' OR ${ledgerAccounts.code} LIKE '101%')`,
      ),
    )
    .orderBy(asc(ledgerAccounts.code))

  if (cashRows.length === 0) return []
  const accIds = cashRows.map((r) => r.id)

  const balances = await db
    .select({
      accountId: journalLines.accountId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        inArray(journalLines.accountId, accIds),
        inArray(journalEntries.postingStatus, ['submitted', 'approved']),
        eq(journalEntries.isReversed, false),
      ),
    )
    .groupBy(journalLines.accountId)

  const balanceMap = new Map<string, { debit: number; credit: number }>()
  for (const b of balances) {
    balanceMap.set(b.accountId, {
      debit: Number(b.totalDebit),
      credit: Number(b.totalCredit),
    })
  }

  return cashRows.map((r) => {
    const b = balanceMap.get(r.id) || { debit: 0, credit: 0 }
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      totalDebit: b.debit,
      totalCredit: b.credit,
      currentBalance: b.debit - b.credit,
      isActive: r.isActive,
    }
  })
}

export interface UnmatchedBankJournalLine {
  id: string
  journalEntryId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  debit: number
  credit: number
  narration: string | null
  refId: string | null
}

export async function getUnmatchedBankJournalLinesQuery(
  bankAccountId: string,
): Promise<UnmatchedBankJournalLine[]> {
  const bank = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))
    .limit(1)

  if (!bank[0] || !bank[0].ledgerAccountId) return []

  const matchedLineRows = await db
    .select({ lineId: bankTransactions.matchedJournalLineId })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        isNotNull(bankTransactions.matchedJournalLineId),
      ),
    )

  const matchedLineIds = matchedLineRows
    .map((r) => r.lineId)
    .filter((id): id is string => Boolean(id))

  const conditions = [
    eq(journalLines.accountId, bank[0].ledgerAccountId),
    inArray(journalEntries.postingStatus, ['submitted', 'approved']),
    eq(journalEntries.isReversed, false),
  ]

  if (matchedLineIds.length > 0) {
    conditions.push(
      sql`${journalLines.id} NOT IN (${sql.join(
        matchedLineIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
  }

  const rows = await db
    .select({
      id: journalLines.id,
      journalEntryId: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      debit: journalLines.debit,
      credit: journalLines.credit,
      narration: journalLines.narration,
      refId: journalEntries.refId,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(and(...conditions))
    .orderBy(desc(journalEntries.postingDate), desc(journalLines.id))
    .limit(100)

  return rows.map((r) => ({
    id: r.id,
    journalEntryId: r.journalEntryId,
    voucherNo: r.voucherNo,
    voucherType: r.voucherType,
    postingDate: r.postingDate.toISOString(),
    debit: r.debit,
    credit: r.credit,
    narration: r.narration,
    refId: r.refId,
  }))
}

export interface ImportBankTransactionsInput {
  bankAccountId: string
  transactions: Array<{
    transactionDate: string
    description: string
    referenceNo?: string | null
    debitRs?: number
    creditRs?: number
  }>
}

export async function importBankTransactionsQuery(
  input: ImportBankTransactionsInput,
): Promise<{ importedCount: number; duplicateCount: number }> {
  let importedCount = 0
  let duplicateCount = 0

  for (const t of input.transactions) {
    const debit = Math.round(Number(t.debitRs || 0) * 100)
    const credit = Math.round(Number(t.creditRs || 0) * 100)
    const txDate = new Date(t.transactionDate)
    const refNo = t.referenceNo?.trim() || null

    const dupConditions = [
      eq(bankTransactions.bankAccountId, input.bankAccountId),
      eq(bankTransactions.debit, debit),
      eq(bankTransactions.credit, credit),
    ]

    if (refNo) {
      dupConditions.push(eq(bankTransactions.referenceNo, refNo))
    } else {
      dupConditions.push(eq(bankTransactions.description, t.description.trim()))
    }

    const existing = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(and(...dupConditions))
      .limit(1)

    if (existing.length > 0) {
      duplicateCount++
      continue
    }

    const id = `btx_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    await db.insert(bankTransactions).values({
      id,
      bankAccountId: input.bankAccountId,
      transactionDate: txDate,
      description: t.description.trim(),
      referenceNo: refNo,
      debit,
      credit,
      status: 'unmatched',
    })
    importedCount++
  }

  return { importedCount, duplicateCount }
}

export async function autoMatchBankTransactionsQuery(
  bankAccountId: string,
  actor: FinanceActor,
): Promise<{ matchedCount: number }> {
  const unmatchedTx = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, 'unmatched'),
      ),
    )

  if (unmatchedTx.length === 0) return { matchedCount: 0 }

  const eligibleLines = await getUnmatchedBankJournalLinesQuery(bankAccountId)
  if (eligibleLines.length === 0) return { matchedCount: 0 }

  let matchedCount = 0
  const usedLineIds = new Set<string>()

  for (const tx of unmatchedTx) {
    const isDeposit = tx.debit > 0
    const txAmount = isDeposit ? tx.debit : tx.credit
    const txDate = new Date(tx.transactionDate).getTime()

    const candidates = eligibleLines.filter((l) => {
      if (usedLineIds.has(l.id)) return false
      const lAmount = isDeposit ? l.debit : l.credit
      if (lAmount !== txAmount) return false

      if (
        tx.referenceNo &&
        l.refId &&
        tx.referenceNo.trim().toLowerCase() === l.refId.trim().toLowerCase()
      ) {
        return true
      }
      if (
        tx.referenceNo &&
        l.voucherNo &&
        tx.referenceNo.trim().toLowerCase() === l.voucherNo.trim().toLowerCase()
      ) {
        return true
      }

      const lDate = new Date(l.postingDate).getTime()
      return Math.abs(txDate - lDate) <= 5 * 86400000
    })

    if (candidates.length === 1) {
      const match = candidates[0]
      usedLineIds.add(match.id)
      await db
        .update(bankTransactions)
        .set({
          matchedJournalLineId: match.id,
          status: 'matched',
          reconciledAt: new Date(),
          reconciledBy: actor.name,
        })
        .where(eq(bankTransactions.id, tx.id))
      matchedCount++
    }
  }

  return { matchedCount }
}

export interface BankReconciliationSummary {
  bankAccountId: string
  bankName: string
  accountNumber: string
  ledgerAccountId: string | null
  glBalance: number // paisa
  statementBalance: number // paisa
  matchedCount: number
  unmatchedCount: number
  clearedCount: number
  depositsInTransit: number // in GL, not in statement (paisa)
  outstandingPayments: number // in GL, not in statement (paisa)
  unrecordedStatementDebits: number // in statement, not in GL (paisa)
  unrecordedStatementCredits: number // in statement, not in GL (paisa)
  adjustedBankBalance: number
  adjustedBookBalance: number
  reconciliationDifference: number
  isReconciled: boolean
}

export async function getBankReconciliationSummaryQuery(
  bankAccountId: string,
): Promise<BankReconciliationSummary> {
  const bankRows = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))
    .limit(1)

  if (!bankRows[0]) {
    throw new Error(`Bank account ${bankAccountId} not found`)
  }
  const bank = bankRows[0]

  let glBalance = bank.openingBalance
  if (bank.ledgerAccountId) {
    const glLines = await db
      .select({
        debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, bank.ledgerAccountId),
          inArray(journalEntries.postingStatus, ['submitted', 'approved']),
          eq(journalEntries.isReversed, false),
        ),
      )
    glBalance = Number(glLines[0]?.debit || 0) - Number(glLines[0]?.credit || 0)
  }

  const txRows = await db
    .select({
      status: bankTransactions.status,
      debit: bankTransactions.debit,
      credit: bankTransactions.credit,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.bankAccountId, bankAccountId))

  let matchedCount = 0
  let unmatchedCount = 0
  let clearedCount = 0
  let statementDebits = 0
  let statementCredits = 0
  let unrecordedStatementDebits = 0
  let unrecordedStatementCredits = 0

  for (const t of txRows) {
    statementDebits += t.debit
    statementCredits += t.credit
    if (t.status === 'matched') matchedCount++
    else if (t.status === 'cleared') clearedCount++
    else {
      unmatchedCount++
      unrecordedStatementDebits += t.debit
      unrecordedStatementCredits += t.credit
    }
  }

  const statementBalance = bank.openingBalance + statementDebits - statementCredits

  const unmatchedGLLines = await getUnmatchedBankJournalLinesQuery(bankAccountId)
  let depositsInTransit = 0
  let outstandingPayments = 0
  for (const l of unmatchedGLLines) {
    depositsInTransit += l.debit
    outstandingPayments += l.credit
  }

  const adjustedBankBalance = statementBalance + depositsInTransit - outstandingPayments
  const adjustedBookBalance =
    glBalance + unrecordedStatementDebits - unrecordedStatementCredits
  const reconciliationDifference = adjustedBankBalance - adjustedBookBalance
  const isReconciled = reconciliationDifference === 0 && unmatchedCount === 0

  return {
    bankAccountId,
    bankName: bank.bankName,
    accountNumber: bank.accountNumber,
    ledgerAccountId: bank.ledgerAccountId,
    glBalance,
    statementBalance,
    matchedCount,
    unmatchedCount,
    clearedCount,
    depositsInTransit,
    outstandingPayments,
    unrecordedStatementDebits,
    unrecordedStatementCredits,
    adjustedBankBalance,
    adjustedBookBalance,
    reconciliationDifference,
    isReconciled,
  }
}

export async function finalizeBankReconciliationQuery(
  bankAccountId: string,
  actor: FinanceActor,
): Promise<{ clearedCount: number }> {
  const result = await db
    .update(bankTransactions)
    .set({
      status: 'cleared',
      reconciledAt: new Date(),
      reconciledBy: actor.name,
    })
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, 'matched'),
      ),
    )

  return { clearedCount: (result as any)?.rowCount || 0 }
}

export async function postQuickBankEntryQuery(params: {
  bankAccountId: string
  entryType: 'bank_charges' | 'interest' | 'deposit' | 'withdrawal'
  amount: number // paisa
  narration: string
  postingDate?: Date
  bankTransactionId?: string
  refId?: string
  actor: FinanceActor
}): Promise<{ voucherNo: string }> {
  const bank = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, params.bankAccountId))
    .limit(1)

  if (!bank[0] || !bank[0].ledgerAccountId) {
    throw new Error('Bank account has no linked General Ledger account.')
  }

  const bankLedgerId = bank[0].ledgerAccountId
  const cashAccountId = await resolveAccount(db, 'CASH_IN_HAND')
  const chargesAccountId = await resolveAccount(db, 'GATEWAY_FEES')
  const incomeAccountId = await resolveAccount(db, 'OTHER_INCOME')

  let voucherType: 'PV' | 'RV' | 'CV' = 'CV'
  const lines: Array<{
    accountId: string
    debit?: number
    credit?: number
    costCenter: 'general'
    narration: string
  }> = []

  if (params.entryType === 'bank_charges') {
    voucherType = 'PV'
    lines.push({
      accountId: chargesAccountId,
      debit: params.amount,
      costCenter: 'general',
      narration: params.narration,
    })
    lines.push({
      accountId: bankLedgerId,
      credit: params.amount,
      costCenter: 'general',
      narration: `Bank charges deducted from ${bank[0].bankName}`,
    })
  } else if (params.entryType === 'interest') {
    voucherType = 'RV'
    lines.push({
      accountId: bankLedgerId,
      debit: params.amount,
      costCenter: 'general',
      narration: `Interest credit received in ${bank[0].bankName}`,
    })
    lines.push({
      accountId: incomeAccountId,
      credit: params.amount,
      costCenter: 'general',
      narration: params.narration,
    })
  } else if (params.entryType === 'deposit') {
    voucherType = 'CV'
    lines.push({
      accountId: bankLedgerId,
      debit: params.amount,
      costCenter: 'general',
      narration: `Cash deposited to ${bank[0].bankName}`,
    })
    lines.push({
      accountId: cashAccountId,
      credit: params.amount,
      costCenter: 'general',
      narration: params.narration,
    })
  } else if (params.entryType === 'withdrawal') {
    voucherType = 'CV'
    lines.push({
      accountId: cashAccountId,
      debit: params.amount,
      costCenter: 'general',
      narration: `Cash withdrawn from ${bank[0].bankName}`,
    })
    lines.push({
      accountId: bankLedgerId,
      credit: params.amount,
      costCenter: 'general',
      narration: params.narration,
    })
  }

  const posting = await dbTx.transaction(async (tx) => {
    return postJournalTx(tx, {
      voucherType,
      postingDate: params.postingDate || new Date(),
      narration: params.narration,
      refType: 'banking',
      refId: params.refId || null,
      event: `bank_${params.entryType}`,
      branchId: bank[0].branchId || null,
      createdBy: params.actor.name,
      lines,
    })
  })

  if (params.bankTransactionId) {
    const bankLine = await db
      .select({ id: journalLines.id })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.journalEntryId, posting.journalEntryId),
          eq(journalLines.accountId, bankLedgerId),
        ),
      )
      .limit(1)

    if (bankLine[0]) {
      await db
        .update(bankTransactions)
        .set({
          matchedJournalLineId: bankLine[0].id,
          status: 'matched',
          reconciledAt: new Date(),
          reconciledBy: params.actor.name,
        })
        .where(eq(bankTransactions.id, params.bankTransactionId))
    }
  }

  return { voucherNo: posting.voucherNo! }
}

export interface CashFlowTrackingItem {
  operatingInflows: number
  operatingOutflows: number
  netOperatingCashFlow: number
  contraMovements: number
  totalInflows: number
  totalOutflows: number
  netLiquidMovement: number
  recentTransactions: Array<{
    id: string
    voucherNo: string | null
    postingDate: string
    accountCode: string
    accountName: string
    debit: number
    credit: number
    narration: string | null
  }>
}

export async function getCashFlowTrackingQuery(): Promise<CashFlowTrackingItem> {
  const liquidAccounts = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.rootType, 'asset'),
        eq(ledgerAccounts.isGroup, false),
        sql`(${ledgerAccounts.accountType} IN ('cash', 'bank') OR ${ledgerAccounts.code} LIKE '101%')`,
      ),
    )

  const accountIds = liquidAccounts.map((a) => a.id)
  if (accountIds.length === 0) {
    return {
      operatingInflows: 0,
      operatingOutflows: 0,
      netOperatingCashFlow: 0,
      contraMovements: 0,
      totalInflows: 0,
      totalOutflows: 0,
      netLiquidMovement: 0,
      recentTransactions: [],
    }
  }

  const rows = await db
    .select({
      id: journalLines.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      debit: journalLines.debit,
      credit: journalLines.credit,
      narration: journalLines.narration,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(
      and(
        inArray(journalLines.accountId, accountIds),
        inArray(journalEntries.postingStatus, ['submitted', 'approved']),
        eq(journalEntries.isReversed, false),
      ),
    )
    .orderBy(desc(journalEntries.postingDate), desc(journalLines.id))
    .limit(50)

  let totalInflows = 0
  let totalOutflows = 0
  let contraMovements = 0

  for (const r of rows) {
    totalInflows += r.debit
    totalOutflows += r.credit
    if (r.voucherType === 'CV') {
      contraMovements += r.debit
    }
  }

  const operatingInflows = totalInflows - contraMovements
  const operatingOutflows = totalOutflows - contraMovements
  const netOperatingCashFlow = operatingInflows - operatingOutflows
  const netLiquidMovement = totalInflows - totalOutflows

  return {
    operatingInflows,
    operatingOutflows,
    netOperatingCashFlow,
    contraMovements,
    totalInflows,
    totalOutflows,
    netLiquidMovement,
    recentTransactions: rows.map((r) => ({
      id: r.id,
      voucherNo: r.voucherNo,
      postingDate: r.postingDate.toISOString(),
      accountCode: r.accountCode,
      accountName: r.accountName,
      debit: r.debit,
      credit: r.credit,
      narration: r.narration,
    })),
  }
}
