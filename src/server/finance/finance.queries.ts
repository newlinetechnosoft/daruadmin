import { db } from '#/db'
import {
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
import { and, asc, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'

// ---------------------------------------------------------
// Legacy Single-Entry Mappers (backward compatibility)
// ---------------------------------------------------------

function mapLedgerRecord(l: typeof ledgerEntries.$inferSelect): LedgerEntry {
  return {
    id: l.id,
    date: l.date,
    type: l.type as 'debit' | 'credit',
    category: l.category as any,
    account: l.account,
    memo: l.memo,
    amount: l.amount,
    refType: l.refType as any,
    refId: l.refId,
    createdAt: l.createdAt.toISOString(),
  }
}

function mapPaymentRecord(p: typeof payments.$inferSelect): PaymentTxn {
  return {
    id: p.id,
    orderId: p.orderId,
    gateway: p.gateway as any,
    amount: p.amount,
    status: p.status as any,
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
  const rows = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query
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
  const rows = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query
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
  voucherNo: string
  voucherType: string
  fiscalYearId: string
  postingDate: string
  bsDate: string
  dualDate: string
  narration: string
  refType: string | null
  refId: string | null
  event: string | null
  postingStatus: string
  reversalOf: string | null
  metadata: any
  createdBy: string
  totalDebit: number
  totalCredit: number
  lines: JournalLineItem[]
}

export async function getJournalEntriesQuery(params?: {
  fiscalYearId?: string
  voucherType?: string
  refType?: string
  limit?: number
  offset?: number
}): Promise<DetailedJournalEntry[]> {
  const conditions = []
  if (params?.fiscalYearId) {
    conditions.push(eq(journalEntries.fiscalYearId, params.fiscalYearId))
  }
  if (params?.voucherType) {
    conditions.push(eq(journalEntries.voucherType, params.voucherType))
  }
  if (params?.refType) {
    conditions.push(eq(journalEntries.refType, params.refType))
  }

  const query = db
    .select()
    .from(journalEntries)
    .orderBy(desc(journalEntries.postingDate), desc(journalEntries.createdAt))

  const entries =
    conditions.length > 0
      ? await query.where(and(...conditions)).limit(params?.limit || 100)
      : await query.limit(params?.limit || 100)

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
      metadata: e.metadata,
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
  voucherNo: string
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
  totalProcured: number // credit to acc_2011
  totalPaid: number // debit to acc_2011
  outstandingPayable: number // totalProcured - totalPaid
}

export async function getDealerPayablesSummaryQuery(): Promise<
  DealerPayableSummary[]
> {
  const allDealers = await db.select().from(dealers).orderBy(asc(dealers.name))

  const payableLines = await db
    .select({
      partyId: journalLines.partyId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .where(
      and(
        eq(journalLines.accountId, 'acc_2011'),
        eq(journalLines.partyType, 'dealer'),
      ),
    )
    .groupBy(journalLines.partyId)

  const payMap = new Map<string, { totalDebit: number; totalCredit: number }>()
  for (const pl of payableLines) {
    if (pl.partyId) {
      payMap.set(pl.partyId, {
        totalDebit: Number(pl.totalDebit),
        totalCredit: Number(pl.totalCredit),
      })
    }
  }

  return allDealers.map((d) => {
    const stats = payMap.get(d.id) || { totalDebit: 0, totalCredit: 0 }
    const totalProcured = stats.totalCredit // Credit to payable increases what we owe
    const totalPaid = stats.totalDebit // Debit to payable decreases what we owe
    return {
      dealerId: d.id,
      dealerName: d.name,
      pan: d.pan,
      city: d.city,
      phone: d.contact,
      totalProcured,
      totalPaid,
      outstandingPayable: totalProcured - totalPaid,
    }
  })
}

export interface RiderAccountSummary {
  riderId: string
  riderName: string
  phone: string | null
  cashOnHand: number // in riders table
  undepositedCodCash: number // net debit on acc_1031
  commissionPayable: number // net credit on acc_2031
}

export async function getRiderAccountsSummaryQuery(): Promise<
  RiderAccountSummary[]
> {
  const allRiders = await db.select().from(riders).orderBy(asc(riders.name))

  const riderLines = await db
    .select({
      accountId: journalLines.accountId,
      partyId: journalLines.partyId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .where(eq(journalLines.partyType, 'rider'))
    .groupBy(journalLines.accountId, journalLines.partyId)

  const codMap = new Map<string, number>()
  const commMap = new Map<string, number>()

  for (const rl of riderLines) {
    if (!rl.partyId) continue
    if (rl.accountId === 'acc_1031') {
      // Asset: Dr increases, Cr decreases
      codMap.set(rl.partyId, Number(rl.totalDebit) - Number(rl.totalCredit))
    } else if (rl.accountId === 'acc_2031') {
      // Liability: Cr increases, Dr decreases
      commMap.set(rl.partyId, Number(rl.totalCredit) - Number(rl.totalDebit))
    }
  }

  return allRiders.map((r) => ({
    riderId: r.id,
    riderName: r.name,
    phone: r.phone,
    cashOnHand: r.cashOnHand,
    undepositedCodCash: codMap.get(r.id) || 0,
    commissionPayable: commMap.get(r.id) || 0,
  }))
}

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
}

export async function getPublicVoucherBySlugQuery(
  slug: string,
): Promise<PublicVoucherData | null> {
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
