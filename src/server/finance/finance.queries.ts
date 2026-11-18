import { db, dbTx } from '#/db'
import {
  accountDefaults,
  costCenters,
  dealers,
  dealerSettlements,
  fiscalYears,
  journalEntries,
  journalLines,
  ledgerAccounts,
  ledgerEntries,
  orderItems,
  orders,
  payments,
  riders,
  settlements,
} from '#/db/schema'
import { formatBS, formatDualDate } from '#/lib/nepal-date'
import type { LedgerEntry, PaymentTxn } from '#/server/operations/types'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import {
  ACCOUNT_KEY_METADATA,
  invalidateAccountDefaultsCache,
  resolveAccount,
} from './account-keys'
import type { AccountKey, AccountKeyMetadata } from './account-keys'
import { computePayableAging, signedMovement } from './report-math'
import type { DbTx, JournalMetadata, PartyType } from './types'

// ---------------------------------------------------------
// Legacy Single-Entry Mappers (backward compatibility)
// ---------------------------------------------------------

function mapLedgerRecord(l: typeof ledgerEntries.$inferSelect): LedgerEntry {
  return {
    id: l.id,
    date: l.date,
    type: l.type as 'debit' | 'credit',
    category: l.category as LedgerEntry['category'],
    account: l.account,
    memo: l.memo,
    amount: l.amount,
    refType: l.refType as LedgerEntry['refType'],
    refId: l.refId,
    createdAt: l.createdAt.toISOString(),
  }
}

function mapPaymentRecord(p: typeof payments.$inferSelect): PaymentTxn {
  return {
    id: p.id,
    orderId: p.orderId,
    gateway: p.gateway as PaymentTxn['gateway'],
    amount: p.amount,
    status: p.status as PaymentTxn['status'],
    reference: p.reference,
    createdAt: p.createdAt.toISOString(),
  }
}

export async function getAllLedgerEntriesQuery(dateRange?: {
  start?: Date | null
  end?: Date | null
}): Promise<LedgerEntry[]> {
  const conditions = []
  if (dateRange?.start) {
    conditions.push(gte(ledgerEntries.createdAt, dateRange.start))
  }
  if (dateRange?.end) {
    conditions.push(lte(ledgerEntries.createdAt, dateRange.end))
  }

  const query = db.select().from(ledgerEntries)
  const rows = await (
    conditions.length > 0 ? query.where(and(...conditions)) : query
  ).orderBy(desc(ledgerEntries.createdAt))
  return rows.map(mapLedgerRecord)
}

export async function getAllPaymentsQuery(dateRange?: {
  start?: Date | null
  end?: Date | null
}): Promise<PaymentTxn[]> {
  const conditions = []
  if (dateRange?.start) {
    conditions.push(gte(payments.createdAt, dateRange.start))
  }
  if (dateRange?.end) {
    conditions.push(lte(payments.createdAt, dateRange.end))
  }

  const query = db.select().from(payments)
  const rows = await (
    conditions.length > 0 ? query.where(and(...conditions)) : query
  ).orderBy(desc(payments.createdAt))
  return rows.map(mapPaymentRecord)
}

export async function getPaymentsByOrderIdQuery(
  orderId: string,
): Promise<PaymentTxn[]> {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
  return rows.map(mapPaymentRecord)
}

// ---------------------------------------------------------
// Double-Entry Accounting Queries
// ---------------------------------------------------------

export interface JournalLineItem {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  accountRootType: string
  debit: number
  credit: number
  partyType: string | null
  partyId: string | null
  costCenter: string | null
  narration: string | null
}

export interface DetailedJournalEntry {
  id: string
  voucherNo: string | null
  voucherType: string
  fiscalYearId: string
  branchId?: string | null
  postingDate: string
  bsDate: string
  dualDate: string
  narration: string
  refType: string | null
  refId: string | null
  event: string | null
  postingStatus: string
  reversalOf: string | null
  isReversed: boolean
  reversedBy: string | null
  metadata: JournalMetadata | null
  createdBy: string
  totalDebit: number
  totalCredit: number
  lines: JournalLineItem[]
}

export async function getJournalEntriesQuery(params?: {
  id?: string
  fiscalYearId?: string
  voucherType?: string
  refType?: string
  partyType?: string
  partyId?: string
  fromDate?: Date
  toDate?: Date
  search?: string
  limit?: number
  offset?: number
}): Promise<DetailedJournalEntry[]> {
  const conditions: SQL[] = []
  if (params?.id) {
    conditions.push(eq(journalEntries.id, params.id))
  }
  if (params?.fiscalYearId) {
    conditions.push(eq(journalEntries.fiscalYearId, params.fiscalYearId))
  }
  if (params?.voucherType) {
    conditions.push(eq(journalEntries.voucherType, params.voucherType))
  }
  if (params?.refType) {
    conditions.push(eq(journalEntries.refType, params.refType))
  }
  if (params?.fromDate) {
    conditions.push(gte(journalEntries.postingDate, params.fromDate))
  }
  if (params?.toDate) {
    conditions.push(lte(journalEntries.postingDate, params.toDate))
  }
  if (params?.search) {
    const q = `%${params.search}%`
    conditions.push(
      sql`(
        ${journalEntries.voucherNo} ILIKE ${q}
        OR ${journalEntries.narration} ILIKE ${q}
        OR ${journalEntries.refType} ILIKE ${q}
        OR ${journalEntries.refId} ILIKE ${q}
        OR ${journalEntries.event} ILIKE ${q}
      )`,
    )
  }

  // Party filtering is resolved through journal lines because a voucher can
  // contain several parties and several accounts.
  if (params?.partyType || params?.partyId) {
    const partyConditions: SQL[] = []
    if (params.partyType)
      partyConditions.push(eq(journalLines.partyType, params.partyType))
    if (params.partyId)
      partyConditions.push(eq(journalLines.partyId, params.partyId))
    const partyRows = await db
      .selectDistinct({ entryId: journalLines.journalEntryId })
      .from(journalLines)
      .where(and(...partyConditions))
    const partyEntryIds = partyRows.map((r) => r.entryId)
    if (partyEntryIds.length === 0) return []
    conditions.push(inArray(journalEntries.id, partyEntryIds))
  }

  const query = db
    .select()
    .from(journalEntries)
    .orderBy(desc(journalEntries.postingDate), desc(journalEntries.createdAt))

  const entries =
    conditions.length > 0
      ? await query
          .where(and(...conditions))
          .limit(params?.limit || 100)
          .offset(params?.offset || 0)
      : await query.limit(params?.limit || 100).offset(params?.offset || 0)

  if (entries.length === 0) return []

  const entryIds = entries.map((e) => e.id)

  const linesWithAccounts = await db
    .select({
      id: journalLines.id,
      journalEntryId: journalLines.journalEntryId,
      accountId: journalLines.accountId,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      accountRootType: ledgerAccounts.rootType,
      debit: journalLines.debit,
      credit: journalLines.credit,
      partyType: journalLines.partyType,
      partyId: journalLines.partyId,
      costCenter: journalLines.costCenter,
      narration: journalLines.narration,
    })
    .from(journalLines)
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(
      sql`${journalLines.journalEntryId} IN (${sql.join(
        entryIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .orderBy(asc(journalLines.id))

  const linesByEntry = new Map<string, JournalLineItem[]>()
  for (const line of linesWithAccounts) {
    const list = linesByEntry.get(line.journalEntryId) || []
    list.push({
      id: line.id,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountRootType: line.accountRootType,
      debit: line.debit,
      credit: line.credit,
      partyType: line.partyType,
      partyId: line.partyId,
      costCenter: line.costCenter,
      narration: line.narration,
    })
    linesByEntry.set(line.journalEntryId, list)
  }

  return entries.map((e) => {
    const lines = linesByEntry.get(e.id) || []
    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0)
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0)
    const dateObj = new Date(e.postingDate)

    return {
      id: e.id,
      voucherNo: e.voucherNo,
      voucherType: e.voucherType,
      fiscalYearId: e.fiscalYearId,
      postingDate: dateObj.toISOString(),
      bsDate: formatBS(dateObj, { format: 'long' }),
      dualDate: formatDualDate(dateObj),
      narration: e.narration,
      refType: e.refType,
      refId: e.refId,
      event: e.event,
      postingStatus: e.postingStatus,
      reversalOf: e.reversalOf,
      isReversed: e.isReversed,
      reversedBy: e.reversedBy,
      metadata: e.metadata as JournalMetadata | null,
      createdBy: e.createdBy,
      totalDebit,
      totalCredit,
      lines,
    }
  })
}

export interface GeneralLedgerRow {
  lineId: string
  entryId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  bsDate: string
  dualDate: string
  accountId: string
  accountCode: string
  accountName: string
  accountRootType: string
  partyType: string | null
  partyId: string | null
  costCenter: string | null
  narration: string | null
  debit: number
  credit: number
  balance: number // running balance in paisa
}

export async function getGeneralLedgerQuery(params?: {
  accountId?: string
  partyType?: string
  partyId?: string
  fromDate?: Date
  toDate?: Date
  limit?: number
}): Promise<GeneralLedgerRow[]> {
  const conditions = []
  if (params?.accountId) {
    conditions.push(eq(journalLines.accountId, params.accountId))
  }
  if (params?.partyType) {
    conditions.push(eq(journalLines.partyType, params.partyType))
  }
  if (params?.partyId) {
    conditions.push(eq(journalLines.partyId, params.partyId))
  }
  if (params?.fromDate) {
    conditions.push(gte(journalEntries.postingDate, params.fromDate))
  }
  if (params?.toDate) {
    conditions.push(lte(journalEntries.postingDate, params.toDate))
  }

  const query = db
    .select({
      lineId: journalLines.id,
      entryId: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      accountId: journalLines.accountId,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      accountRootType: ledgerAccounts.rootType,
      partyType: journalLines.partyType,
      partyId: journalLines.partyId,
      costCenter: journalLines.costCenter,
      narration: sql<string>`COALESCE(${journalLines.narration}, ${journalEntries.narration})`,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .orderBy(
      asc(journalEntries.postingDate),
      asc(journalEntries.createdAt),
      asc(journalLines.id),
    )

  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).limit(params?.limit || 500)
      : await query.limit(params?.limit || 500)

  let runningBalance = 0
  return rows.map((r) => {
    // Normal balance conventions:
    // Assets & Expenses increase with Debit
    // Liabilities, Equity, Income increase with Credit
    if (r.accountRootType === 'asset' || r.accountRootType === 'expense') {
      runningBalance += r.debit - r.credit
    } else {
      runningBalance += r.credit - r.debit
    }

    const dateObj = new Date(r.postingDate)
    return {
      lineId: r.lineId,
      entryId: r.entryId,
      voucherNo: r.voucherNo,
      voucherType: r.voucherType,
      postingDate: dateObj.toISOString(),
      bsDate: formatBS(dateObj, { format: 'long' }),
      dualDate: formatDualDate(dateObj),
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountRootType: r.accountRootType,
      partyType: r.partyType,
      partyId: r.partyId,
      costCenter: r.costCenter,
      narration: r.narration,
      debit: r.debit,
      credit: r.credit,
      balance: runningBalance,
    }
  })
}

export interface AccountWithBalance {
  id: string
  code: string
  name: string
  rootType: string
  parentId: string | null
  isGroup: boolean
  ownerType: string | null
  ownerId: string | null
  currency: string
  isActive: boolean
  accountType: string | null
  balanceMustBe: string | null
  isFrozen: boolean
  description: string | null
  totalDebit: number
  totalCredit: number
  netBalance: number
  lineCount: number
}

export async function getChartOfAccountsWithBalancesQuery(): Promise<
  AccountWithBalance[]
> {
  const accounts = await db
    .select()
    .from(ledgerAccounts)
    .orderBy(asc(ledgerAccounts.code))

  const balanceAgg = await db
    .select({
      accountId: journalLines.accountId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      lineCount: sql<number>`COUNT(${journalLines.id})`,
    })
    .from(journalLines)
    .groupBy(journalLines.accountId)

  const aggMap = new Map<
    string,
    { totalDebit: number; totalCredit: number; lineCount: number }
  >()
  for (const b of balanceAgg) {
    aggMap.set(b.accountId, {
      totalDebit: Number(b.totalDebit),
      totalCredit: Number(b.totalCredit),
      lineCount: Number(b.lineCount),
    })
  }

  return accounts.map((acc) => {
    const agg = aggMap.get(acc.id) || {
      totalDebit: 0,
      totalCredit: 0,
      lineCount: 0,
    }
    const isDebitNormal = acc.rootType === 'asset' || acc.rootType === 'expense'
    const netBalance = isDebitNormal
      ? agg.totalDebit - agg.totalCredit
      : agg.totalCredit - agg.totalDebit

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      rootType: acc.rootType,
      parentId: acc.parentId,
      isGroup: acc.isGroup,
      ownerType: acc.ownerType,
      ownerId: acc.ownerId,
      currency: acc.currency,
      isActive: acc.isActive,
      accountType: acc.accountType,
      balanceMustBe: acc.balanceMustBe,
      isFrozen: acc.isFrozen,
      description: acc.description,
      totalDebit: agg.totalDebit,
      totalCredit: agg.totalCredit,
      netBalance,
      lineCount: agg.lineCount,
    }
  })
}

export async function getFiscalYearsQuery() {
  return db.select().from(fiscalYears).orderBy(desc(fiscalYears.startDate))
}

export interface DealerPayableSummary {
  dealerId: string
  dealerName: string
  pan: string | null
  city: string | null
  phone: string | null
  tdsRate: number
  paymentTermsDays: number
  creditLimit: number
  isActive: boolean
  totalProcured: number // credit to DEALER_PAYABLE (2011)
  totalPaid: number // debit to DEALER_PAYABLE (2011)
  outstandingPayable: number // totalProcured - totalPaid
  current: number // open payable 0-30 days
  days31To60: number
  days61To90: number
  days90Plus: number
  oldestOpenDate: string | null
  lastActivityDate: string | null
}

/**
 * Dealer payables summary with FIFO aging.
 *
 * Aging is not a simple "createdAt age": payments are applied to the oldest
 * procurement first (FIFO), exactly how an accounts-payable aging report is
 * expected to behave. The remaining open procurement lines are then bucketed
 * into 0-30 / 31-60 / 61-90 / 90+ days.
 */
export async function getDealerPayablesSummaryQuery(): Promise<
  DealerPayableSummary[]
> {
  const allDealers = await db.select().from(dealers).orderBy(asc(dealers.name))
  const payableAccountId = await resolveAccount(db, 'DEALER_PAYABLE')

  const payableLines = await db
    .select({
      lineId: journalLines.id,
      partyId: journalLines.partyId,
      postingDate: journalEntries.postingDate,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(
      and(
        eq(journalLines.accountId, payableAccountId),
        eq(journalLines.partyType, 'dealer'),
        eq(journalEntries.postingStatus, 'submitted'),
      ),
    )
    .orderBy(asc(journalEntries.postingDate), asc(journalLines.id))

  const linesByDealer = new Map<
    string,
    Array<{ date: Date; debit: number; credit: number }>
  >()
  for (const line of payableLines) {
    if (!line.partyId) continue
    const list = linesByDealer.get(line.partyId) ?? []
    list.push({
      date: new Date(line.postingDate),
      debit: line.debit,
      credit: line.credit,
    })
    linesByDealer.set(line.partyId, list)
  }

  const today = new Date()

  return allDealers.map((d) => {
    const aging = computePayableAging(linesByDealer.get(d.id) ?? [], today)

    return {
      dealerId: d.id,
      dealerName: d.name,
      pan: d.pan,
      city: d.city,
      phone: d.contact,
      tdsRate: Number(d.tdsRate),
      paymentTermsDays: d.paymentTermsDays,
      creditLimit: d.creditLimit,
      isActive: d.isActive,
      totalProcured: aging.totalProcured,
      totalPaid: aging.totalPaid,
      outstandingPayable: aging.outstandingPayable,
      current: aging.current,
      days31To60: aging.days31To60,
      days61To90: aging.days61To90,
      days90Plus: aging.days90Plus,
      oldestOpenDate: aging.oldestOpenDate?.toISOString() ?? null,
      lastActivityDate: aging.lastActivityDate?.toISOString() ?? null,
    }
  })
}

export interface RiderAccountSummary {
  riderId: string
  riderName: string
  phone: string | null
  zone: string
  status: string
  cashOnHand: number // in riders table
  undepositedCodCash: number // net debit on RIDER_COD_CASH (1031)
  commissionPayable: number // net credit on RIDER_PAYABLE (2031)
  outstandingAdvances: number // net debit on STAFF_RIDER_ADVANCES (1042)
  lastActivityDate: string | null
}

export async function getRiderAccountsSummaryQuery(): Promise<
  RiderAccountSummary[]
> {
  const allRiders = await db.select().from(riders).orderBy(asc(riders.name))
  const codCashAccountId = await resolveAccount(db, 'RIDER_COD_CASH')
  const payableAccountId = await resolveAccount(db, 'RIDER_PAYABLE')
  const advancesAccountId = await resolveAccount(db, 'STAFF_RIDER_ADVANCES')

  const riderLines = await db
    .select({
      accountId: journalLines.accountId,
      partyId: journalLines.partyId,
      lastPostingDate: sql<Date>`MAX(${journalEntries.postingDate})`,
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
        eq(journalLines.partyType, 'rider'),
        eq(journalEntries.postingStatus, 'submitted'),
      ),
    )
    .groupBy(journalLines.accountId, journalLines.partyId)

  const codMap = new Map<string, number>()
  const commMap = new Map<string, number>()
  const advancesMap = new Map<string, number>()
  const lastActivityMap = new Map<string, Date>()

  for (const rl of riderLines) {
    if (!rl.partyId) continue
    const lastDate = new Date(rl.lastPostingDate)
    const previous = lastActivityMap.get(rl.partyId)
    if (!previous || lastDate > previous) {
      lastActivityMap.set(rl.partyId, lastDate)
    }

    if (rl.accountId === codCashAccountId) {
      // Asset: Dr increases, Cr decreases
      codMap.set(rl.partyId, Number(rl.totalDebit) - Number(rl.totalCredit))
    } else if (rl.accountId === payableAccountId) {
      // Liability: Cr increases, Dr decreases
      commMap.set(rl.partyId, Number(rl.totalCredit) - Number(rl.totalDebit))
    } else if (rl.accountId === advancesAccountId) {
      advancesMap.set(
        rl.partyId,
        Number(rl.totalDebit) - Number(rl.totalCredit),
      )
    }
  }

  return allRiders.map((r) => ({
    riderId: r.id,
    riderName: r.name,
    phone: r.phone,
    zone: r.zone,
    status: r.status,
    cashOnHand: r.cashOnHand,
    undepositedCodCash: codMap.get(r.id) || 0,
    commissionPayable: commMap.get(r.id) || 0,
    outstandingAdvances: advancesMap.get(r.id) || 0,
    lastActivityDate: lastActivityMap.get(r.id)?.toISOString() ?? null,
  }))
}

export interface RiderLedgerBalance {
  riderId: string
  commissionPayable: number // net credit on RIDER_PAYABLE (acc_2031)
  undepositedCodCash: number // net debit on RIDER_COD_CASH (acc_1031)
  outstandingAdvances: number // net debit on STAFF_RIDER_ADVANCES (acc_1042)
}

/**
 * Returns a rider's real-time sub-ledger balances across control accounts.
 * Option A (ACC-0.10): The ledger balance on RIDER_PAYABLE is the source of truth for payroll payouts.
 */
export async function getRiderLedgerBalanceQuery(
  d: DbTx | typeof db,
  riderId: string,
  asOfDate?: Date,
): Promise<RiderLedgerBalance> {
  const conditions = [
    eq(journalLines.partyType, 'rider'),
    eq(journalLines.partyId, riderId),
  ]

  if (asOfDate) {
    conditions.push(lte(journalEntries.postingDate, asOfDate))
  }

  const rows = await d
    .select({
      accountId: journalLines.accountId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .where(and(...conditions))
    .groupBy(journalLines.accountId)

  let commissionPayable = 0
  let undepositedCodCash = 0
  let outstandingAdvances = 0

  const payableAccountId = await resolveAccount(d, 'RIDER_PAYABLE')
  const codCashAccountId = await resolveAccount(d, 'RIDER_COD_CASH')
  const advancesAccountId = await resolveAccount(d, 'STAFF_RIDER_ADVANCES')

  for (const r of rows) {
    const debit = Number(r.totalDebit)
    const credit = Number(r.totalCredit)

    if (r.accountId === payableAccountId) {
      commissionPayable = credit - debit
    } else if (r.accountId === codCashAccountId) {
      undepositedCodCash = debit - credit
    } else if (r.accountId === advancesAccountId) {
      outstandingAdvances = debit - credit
    }
  }

  return {
    riderId,
    commissionPayable,
    undepositedCodCash,
    outstandingAdvances,
  }
}

import {
  defaultStoreSettings,
  getStoreSettingsQuery,
} from '#/server/platform/platform.queries'

export interface PublicVoucherData {
  type: 'dealer' | 'rider'
  voucherNo: string
  slug: string
  partyName: string
  partyType: string
  grossAmount: number
  tdsRate?: number
  tdsAmount?: number
  baseSalaryAmount?: number
  perDropAmount?: number
  commissionAmount?: number
  advancesDeducted?: number
  cashShortageDeducted?: number
  cashHeldDeducted?: number
  netAmount: number
  status: string
  paymentMethod?: string | null
  paymentReference?: string | null
  paidAt?: string | null
  dateBS: { bs: string; dual: string }
  notes?: string | null
  proofUrls: string[]
  journalEntryId?: string | null
  storeSettings?: {
    storeName: string
    legalName: string
    pan: string
    vat: string
    phone: string
    email: string
    address: string
    city: string
  }
}

export async function getPublicVoucherBySlugQuery(
  slug: string,
): Promise<PublicVoucherData | null> {
  const store = await getStoreSettingsQuery().catch(() => defaultStoreSettings())
  const storeSettings = {
    storeName: store.storeName || 'Mezmani',
    legalName: store.legalName || 'Mezmani Retail Pvt. Ltd.',
    pan: store.pan || '',
    vat: store.vat || '',
    phone: store.phone || '',
    email: store.email || '',
    address: store.address || '',
    city: store.city || '',
  }

  // 1. Try dealer settlements
  const ds = await db
    .select()
    .from(dealerSettlements)
    .where(eq(dealerSettlements.slug, slug))
    .limit(1)

  if (ds[0]) {
    const row = ds[0]
    const dateToFormat = row.paidAt || row.createdAt
    const proofs = Array.isArray(row.proofUrls)
      ? (row.proofUrls as string[])
      : []
    return {
      type: 'dealer',
      voucherNo: row.voucherNo,
      slug: row.slug,
      partyName: row.dealerName,
      partyType: 'Authorized Dealer / Supplier',
      grossAmount: row.grossAmount,
      tdsRate: row.tdsRate,
      tdsAmount: row.tdsAmount,
      netAmount: row.netAmount,
      status: row.status,
      paymentMethod: row.paymentMethod,
      paymentReference: row.paymentReference,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      dateBS: {
        bs: formatBS(dateToFormat),
        dual: formatDualDate(dateToFormat),
      },
      notes: row.notes,
      proofUrls: proofs,
      journalEntryId: row.journalEntryId,
      storeSettings,
    }
  }

  // 2. Try rider settlements
  const rs = await db
    .select()
    .from(settlements)
    .where(eq(settlements.slug, slug))
    .limit(1)

  if (rs[0]) {
    const row = rs[0]
    const dateToFormat = row.paidAt || row.createdAt
    const proofs = Array.isArray(row.proofUrls)
      ? (row.proofUrls as string[])
      : []
    return {
      type: 'rider',
      voucherNo: row.voucherNo || `SV-${row.id.slice(-6).toUpperCase()}`,
      slug: row.slug || slug,
      partyName: row.riderName,
      partyType: 'Delivery Fleet Rider',
      grossAmount: row.grossEarnings || row.payout,
      baseSalaryAmount: row.baseSalaryAmount,
      perDropAmount: row.perDropAmount,
      commissionAmount: row.commissionAmount || row.commission,
      advancesDeducted: row.advancesDeducted,
      cashShortageDeducted: row.cashShortageDeducted,
      cashHeldDeducted: row.cashHeldDeducted,
      netAmount: row.netPayout || row.payout,
      status: row.status,
      paymentMethod: row.paymentMethod,
      paymentReference: row.paymentReference,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      dateBS: {
        bs: formatBS(dateToFormat),
        dual: formatDualDate(dateToFormat),
      },
      notes: row.notes,
      proofUrls: proofs,
      journalEntryId: row.journalEntryId,
      storeSettings,
    }
  }

  return null
}

export async function getUnsettledDealerItemsQuery(dealerId?: string) {
  const conditions = [
    eq(orderItems.isSettled, false),
    isNotNull(orderItems.dealerId),
    eq(orders.status, 'delivered'),
  ]

  if (dealerId) {
    conditions.push(eq(orderItems.dealerId, dealerId))
  }

  const rows = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      orderNumber: orders.number,
      orderDate: orders.createdAt,
      dealerId: orderItems.dealerId,
      dealerName: dealers.name,
      dealerPan: dealers.pan,
      name: orderItems.name,
      variantName: orderItems.variantName,
      sku: orderItems.sku,
      qty: orderItems.qty,
      unitPrice: orderItems.unitPrice,
      dealerCostPrice: orderItems.dealerCostPrice,
      actualDealerCostPrice: orderItems.actualDealerCostPrice,
      sourcingStatus: orderItems.sourcingStatus,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(dealers, eq(orderItems.dealerId, dealers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))

  return rows
}

export async function getAllDealerSettlementsQuery() {
  const rows = await db
    .select()
    .from(dealerSettlements)
    .orderBy(desc(dealerSettlements.createdAt))

  return rows.map((r) => ({
    id: r.id,
    dealerId: r.dealerId,
    dealerName: r.dealerName,
    voucherNo: r.voucherNo,
    slug: r.slug,
    grossAmount: r.grossAmount,
    tdsRate: r.tdsRate,
    tdsAmount: r.tdsAmount,
    netAmount: r.netAmount,
    status: r.status,
    paymentMethod: r.paymentMethod,
    paymentReference: r.paymentReference,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    notes: r.notes,
    proofUrls: Array.isArray(r.proofUrls) ? (r.proofUrls as string[]) : [],
    journalEntryId: r.journalEntryId,
    createdAt: r.createdAt.toISOString(),
  }))
}

// ---------------------------------------------------------
// Account Defaults Queries (ACC-1.1)
// ---------------------------------------------------------

export interface AccountDefaultItem {
  id: string
  key: AccountKey
  accountId: string
  accountName: string
  accountCode: string
  accountRootType: string
  isGroup: boolean
  isActive: boolean
  updatedAt: string
  updatedBy: string | null
  metadata: AccountKeyMetadata
}

/**
 * Loads all 25 account defaults joined with their current ledger accounts.
 * If defaults are not yet persisted in the database, falls back seamlessly to seeded defaults.
 */
export async function getAccountDefaultsQuery(
  d: DbTx | typeof db = db,
): Promise<AccountDefaultItem[]> {
  let rows: Array<{
    id: string
    key: string
    accountId: string
    updatedAt: Date
    updatedBy: string | null
    accountName: string | null
    accountCode: string | null
    accountRootType: string | null
    isGroup: boolean | null
    isActive: boolean | null
  }> = []

  try {
    rows = await d
      .select({
        id: accountDefaults.id,
        key: accountDefaults.key,
        accountId: accountDefaults.accountId,
        updatedAt: accountDefaults.updatedAt,
        updatedBy: accountDefaults.updatedBy,
        accountName: ledgerAccounts.name,
        accountCode: ledgerAccounts.code,
        accountRootType: ledgerAccounts.rootType,
        isGroup: ledgerAccounts.isGroup,
        isActive: ledgerAccounts.isActive,
      })
      .from(accountDefaults)
      .leftJoin(
        ledgerAccounts,
        eq(accountDefaults.accountId, ledgerAccounts.id),
      )
  } catch (_err) {
    // If table doesn't exist yet, gracefully use empty rows
    rows = []
  }

  const existingMap = new Map(rows.map((r) => [r.key, r]))
  const allKeys = Object.keys(ACCOUNT_KEY_METADATA) as AccountKey[]
  const result: AccountDefaultItem[] = []

  for (const key of allKeys) {
    const meta = ACCOUNT_KEY_METADATA[key]
    const row = existingMap.get(key)
    if (row && row.accountName) {
      result.push({
        id: row.id,
        key,
        accountId: row.accountId,
        accountName: row.accountName,
        accountCode: row.accountCode || '',
        accountRootType: row.accountRootType || meta.rootType,
        isGroup: !!row.isGroup,
        isActive: row.isActive !== false,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy || null,
        metadata: meta,
      })
    } else {
      result.push({
        id: `def_${key}`,
        key,
        accountId: meta.defaultAccountId,
        accountName: meta.label,
        accountCode: meta.defaultAccountId.replace('acc_', ''),
        accountRootType: meta.rootType,
        isGroup: false,
        isActive: true,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        metadata: meta,
      })
    }
  }

  return result
}

export interface UpdateAccountDefaultInput {
  key: AccountKey
  accountId: string
}

/**
 * Updates default account mappings.
 * Validates that each account exists, is active, and is NOT a group account.
 * Updates the database and invalidates the resolver memory cache.
 */
export async function updateAccountDefaultsQuery(
  updates: UpdateAccountDefaultInput[],
  updatedBy: string,
  externalTx?: DbTx,
): Promise<{ updatedCount: number }> {
  if (updates.length === 0) {
    return { updatedCount: 0 }
  }

  const runWithTx = async (tx: DbTx) => {
    // 1. Validate all target accounts exist, are active, and are NOT group accounts
    const accountIds = Array.from(new Set(updates.map((u) => u.accountId)))
    const foundAccounts = await tx
      .select({
        id: ledgerAccounts.id,
        name: ledgerAccounts.name,
        isGroup: ledgerAccounts.isGroup,
        isActive: ledgerAccounts.isActive,
      })
      .from(ledgerAccounts)
      .where(inArray(ledgerAccounts.id, accountIds))

    const accountMap = new Map(foundAccounts.map((a) => [a.id, a]))

    for (const update of updates) {
      const acc = accountMap.get(update.accountId)
      if (!acc) {
        throw new Error(
          `Cannot map "${update.key}": Target account "${update.accountId}" does not exist in Chart of Accounts.`,
        )
      }
      if (acc.isGroup) {
        throw new Error(
          `Cannot map "${update.key}": Account "${acc.name}" (${acc.id}) is a group folder. Defaults must map to non-group leaf accounts.`,
        )
      }
      if (!acc.isActive) {
        throw new Error(
          `Cannot map "${update.key}": Account "${acc.name}" (${acc.id}) is inactive. Defaults cannot map to disabled accounts.`,
        )
      }
    }

    // 2. Perform upserts
    for (const update of updates) {
      await tx
        .insert(accountDefaults)
        .values({
          id: `def_${update.key}`,
          key: update.key,
          accountId: update.accountId,
          updatedBy,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: accountDefaults.key,
          set: {
            accountId: update.accountId,
            updatedBy,
            updatedAt: new Date(),
          },
        })
    }

    // 3. Invalidate resolver cache
    invalidateAccountDefaultsCache()

    return { updatedCount: updates.length }
  }

  if (externalTx) {
    return runWithTx(externalTx)
  }

  return dbTx.transaction(async (tx) => runWithTx(tx))
}

// ---------------------------------------------------------
// Accounting Section: Focused Report Queries
// ERPNext/Frappe-style: filterable, searchable, linkable,
// single source of truth = journal_lines + journal_entries
// ---------------------------------------------------------

export interface GLEntryRow {
  lineId: string
  entryId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  bsDate: string
  dualDate: string
  accountId: string
  accountCode: string
  accountName: string
  accountRootType: string
  accountType: string | null
  partyType: string | null
  partyId: string | null
  partyName: string | null
  costCenterId: string | null
  costCenterName: string | null
  costCenterCode: string | null
  debit: number
  credit: number
  runningBalance: number
  narration: string | null
  refType: string | null
  refId: string | null
  event: string | null
  postingStatus: string
  createdBy: string
  createdAt: string
}

export interface GLFilters {
  accountId?: string | null
  accountCode?: string | null
  accountRootType?: string | null
  accountType?: string | null
  partyType?: string | null
  partyId?: string | null
  voucherType?: string | null
  refType?: string | null
  refId?: string | null
  branchId?: string | null
  fromDate?: Date | null
  toDate?: Date | null
  costCenterId?: string | null
  search?: string | null
  limit?: number
  offset?: number
}

function balanceKey(
  accountId: string,
  partyType: string | null,
  partyId: string | null,
): string {
  return `${accountId}::${partyType ?? ''}::${partyId ?? ''}`
}

/**
 * Returns flat General Ledger entries with full filtering, search, and pagination.
 * Each row is one journal line joined to its entry, account, party, and cost center.
 *
 * Running balance is calculated per account + party, with an opening balance
 * fetched from all vouchers before the selected start date. This is the same
 * behaviour as an ERPNext General Ledger / party ledger.
 */
export async function getGeneralLedgerEntriesQuery(
  filters: GLFilters = {},
): Promise<GLEntryRow[]> {
  const baseConditions: SQL[] = []
  const conditions: SQL[] = [eq(journalEntries.postingStatus, 'submitted')]

  const addBaseCondition = (condition: SQL) => {
    baseConditions.push(condition)
    conditions.push(condition)
  }

  if (filters.accountId)
    addBaseCondition(eq(journalLines.accountId, filters.accountId))
  if (filters.accountCode)
    addBaseCondition(eq(ledgerAccounts.code, filters.accountCode))
  if (filters.accountRootType)
    addBaseCondition(eq(ledgerAccounts.rootType, filters.accountRootType))
  if (filters.accountType)
    addBaseCondition(eq(ledgerAccounts.accountType, filters.accountType))
  if (filters.partyType)
    addBaseCondition(eq(journalLines.partyType, filters.partyType))
  if (filters.partyId)
    addBaseCondition(eq(journalLines.partyId, filters.partyId))

  if (filters.voucherType)
    conditions.push(eq(journalEntries.voucherType, filters.voucherType))
  if (filters.refType)
    conditions.push(eq(journalEntries.refType, filters.refType))
  if (filters.refId) conditions.push(eq(journalEntries.refId, filters.refId))
  if (filters.branchId)
    conditions.push(eq(journalLines.branchId, filters.branchId))
  if (filters.costCenterId)
    conditions.push(eq(journalLines.costCenterId, filters.costCenterId))
  if (filters.fromDate)
    conditions.push(gte(journalEntries.postingDate, filters.fromDate))
  if (filters.toDate)
    conditions.push(lte(journalEntries.postingDate, filters.toDate))

  // Full-text search across voucher number, account code/name, narration and refs
  if (filters.search) {
    const q = `%${filters.search}%`
    conditions.push(
      sql`(
        COALESCE(${journalEntries.voucherNo}, '') ILIKE ${q}
        OR ${ledgerAccounts.code} ILIKE ${q}
        OR ${ledgerAccounts.name} ILIKE ${q}
        OR COALESCE(${journalLines.narration}, '') ILIKE ${q}
        OR ${journalEntries.narration} ILIKE ${q}
        OR COALESCE(${journalEntries.refId}, '') ILIKE ${q}
      )`,
    )
  }

  const rows = await db
    .select({
      lineId: journalLines.id,
      entryId: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      accountId: journalLines.accountId,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      accountRootType: ledgerAccounts.rootType,
      accountType: ledgerAccounts.accountType,
      partyType: journalLines.partyType,
      partyId: journalLines.partyId,
      costCenterId: journalLines.costCenterId,
      costCenterCode: costCenters.code,
      costCenterName: costCenters.name,
      debit: journalLines.debit,
      credit: journalLines.credit,
      narration: journalLines.narration,
      refType: journalEntries.refType,
      refId: journalEntries.refId,
      event: journalEntries.event,
      postingStatus: journalEntries.postingStatus,
      createdBy: journalEntries.createdBy,
      createdAt: journalEntries.createdAt,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .leftJoin(costCenters, eq(journalLines.costCenterId, costCenters.id))
    .where(and(...conditions))
    .orderBy(
      asc(journalEntries.postingDate),
      asc(journalEntries.createdAt),
      asc(journalLines.id),
    )
    .limit(filters.limit || 500)
    .offset(filters.offset || 0)

  // Opening balances before the selected start date, per account + party.
  const runningBalances = new Map<string, number>()
  if (filters.fromDate) {
    const openingRows = await db
      .select({
        accountId: journalLines.accountId,
        accountRootType: ledgerAccounts.rootType,
        partyType: journalLines.partyType,
        partyId: journalLines.partyId,
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id),
      )
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          ...baseConditions,
          eq(journalEntries.postingStatus, 'submitted'),
          lt(journalEntries.postingDate, filters.fromDate),
        ),
      )
      .groupBy(
        journalLines.accountId,
        ledgerAccounts.rootType,
        journalLines.partyType,
        journalLines.partyId,
      )

    for (const opening of openingRows) {
      const movement = signedMovement(
        opening.accountRootType,
        Number(opening.totalDebit),
        Number(opening.totalCredit),
      )
      runningBalances.set(
        balanceKey(
          opening.accountId,
          opening.partyType ?? null,
          opening.partyId ?? null,
        ),
        movement,
      )
    }
  }

  // Resolve party names in one query per party table.
  const partyIds = [
    ...new Set(
      rows.map((r) => r.partyId).filter((id): id is string => id !== null),
    ),
  ]
  const partyNameMap = new Map<string, string>()
  if (partyIds.length > 0) {
    const [riderRows, dealerRows] = await Promise.all([
      db
        .select({ id: riders.id, name: riders.name })
        .from(riders)
        .where(inArray(riders.id, partyIds)),
      db
        .select({ id: dealers.id, name: dealers.name })
        .from(dealers)
        .where(inArray(dealers.id, partyIds)),
    ])
    for (const r of riderRows) partyNameMap.set(r.id, r.name)
    for (const d of dealerRows) partyNameMap.set(d.id, d.name)
  }

  return rows.map((r) => {
    const key = balanceKey(r.accountId, r.partyType, r.partyId)
    const nextBalance =
      (runningBalances.get(key) ?? 0) +
      signedMovement(r.accountRootType, r.debit, r.credit)
    runningBalances.set(key, nextBalance)

    const dateObj = new Date(r.postingDate)
    return {
      lineId: r.lineId,
      entryId: r.entryId,
      voucherNo: r.voucherNo,
      voucherType: r.voucherType,
      postingDate: dateObj.toISOString(),
      bsDate: formatBS(dateObj, { format: 'long' }),
      dualDate: formatDualDate(dateObj),
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountRootType: r.accountRootType,
      accountType: r.accountType,
      partyType: r.partyType ?? null,
      partyId: r.partyId ?? null,
      partyName: r.partyId ? (partyNameMap.get(r.partyId) ?? null) : null,
      costCenterId: r.costCenterId ?? null,
      costCenterCode: r.costCenterCode ?? null,
      costCenterName: r.costCenterName ?? null,
      debit: r.debit,
      credit: r.credit,
      runningBalance: nextBalance,
      narration: r.narration ?? null,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
      event: r.event ?? null,
      postingStatus: r.postingStatus,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    }
  })
}

export interface PartyStatementRow {
  lineId: string
  entryId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  bsDate: string
  dualDate: string
  accountId: string
  accountCode: string
  accountName: string
  accountRootType: string
  accountType: string | null
  debit: number
  credit: number
  openingBalance: number
  runningBalance: number
  narration: string | null
  refType: string | null
  refId: string | null
}

interface PartyStatementFilters {
  partyType: PartyType
  partyId: string
  fromDate?: Date | null
  toDate?: Date | null
  accountId?: string | null
  limit?: number
}

/**
 * Returns a party statement (sub-ledger) with a per-account running balance.
 * A rider statement can contain both COD cash (asset) and commission payable
 * (liability), so balances are tracked separately per account instead of being
 * mixed into one meaningless number.
 */
export async function getPartyStatementQuery(
  filters: PartyStatementFilters,
): Promise<PartyStatementRow[]> {
  const baseConditions: SQL[] = [
    eq(journalLines.partyType, filters.partyType),
    eq(journalLines.partyId, filters.partyId),
  ]
  const conditions: SQL[] = [
    eq(journalEntries.postingStatus, 'submitted'),
    ...baseConditions,
  ]

  if (filters.accountId) {
    const accountCondition = eq(journalLines.accountId, filters.accountId)
    baseConditions.push(accountCondition)
    conditions.push(accountCondition)
  }
  if (filters.fromDate)
    conditions.push(gte(journalEntries.postingDate, filters.fromDate))
  if (filters.toDate)
    conditions.push(lte(journalEntries.postingDate, filters.toDate))

  const rows = await db
    .select({
      lineId: journalLines.id,
      entryId: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      accountId: journalLines.accountId,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      accountRootType: ledgerAccounts.rootType,
      accountType: ledgerAccounts.accountType,
      debit: journalLines.debit,
      credit: journalLines.credit,
      narration: journalLines.narration,
      refType: journalEntries.refType,
      refId: journalEntries.refId,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id),
    )
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(and(...conditions))
    .orderBy(
      asc(journalEntries.postingDate),
      asc(journalEntries.createdAt),
      asc(journalLines.id),
    )
    .limit(filters.limit || 500)

  const openingByAccount = new Map<string, number>()
  if (filters.fromDate) {
    const openingRows = await db
      .select({
        accountId: journalLines.accountId,
        accountRootType: ledgerAccounts.rootType,
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id),
      )
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          ...baseConditions,
          eq(journalEntries.postingStatus, 'submitted'),
          lt(journalEntries.postingDate, filters.fromDate),
        ),
      )
      .groupBy(journalLines.accountId, ledgerAccounts.rootType)

    for (const opening of openingRows) {
      openingByAccount.set(
        opening.accountId,
        signedMovement(
          opening.accountRootType,
          Number(opening.totalDebit),
          Number(opening.totalCredit),
        ),
      )
    }
  }

  const runningByAccount = new Map(openingByAccount)
  return rows.map((r) => {
    const openingBalance = openingByAccount.get(r.accountId) ?? 0
    const nextBalance =
      (runningByAccount.get(r.accountId) ?? 0) +
      signedMovement(r.accountRootType, r.debit, r.credit)
    runningByAccount.set(r.accountId, nextBalance)

    const dateObj = new Date(r.postingDate)
    return {
      lineId: r.lineId,
      entryId: r.entryId,
      voucherNo: r.voucherNo,
      voucherType: r.voucherType,
      postingDate: dateObj.toISOString(),
      bsDate: formatBS(dateObj, { format: 'long' }),
      dualDate: formatDualDate(dateObj),
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountRootType: r.accountRootType,
      accountType: r.accountType,
      debit: r.debit,
      credit: r.credit,
      openingBalance,
      runningBalance: nextBalance,
      narration: r.narration ?? null,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
    }
  })
}

/**
 * Loads one voucher with all lines for the voucher-details dialog.
 */
export async function getJournalEntryByIdQuery(
  id: string,
): Promise<DetailedJournalEntry | null> {
  const entries = await getJournalEntriesQuery({ id, limit: 1 })
  return entries[0] ?? null
}

export interface CostCenterItem {
  id: string
  code: string
  name: string
  parentId: string | null
  isGroup: boolean
  isActive: boolean
}

export async function getCostCentersQuery(): Promise<CostCenterItem[]> {
  const rows = await db
    .select({
      id: costCenters.id,
      code: costCenters.code,
      name: costCenters.name,
      parentId: costCenters.parentId,
      isGroup: costCenters.isGroup,
      isActive: costCenters.isActive,
    })
    .from(costCenters)
    .orderBy(asc(costCenters.code))

  return rows
}
