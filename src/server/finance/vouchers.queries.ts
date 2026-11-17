import { db, dbTx } from '#/db'
import {
  branches,
  journalEntries,
  journalLines,
  ledgerAccounts,
  voucherAttachments,
} from '#/db/schema'
import { formatBS, formatDualDate } from '#/lib/nepal-date'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import {
  postJournalTx,
  submitDraftJournalTx,
} from './double-entry'
import type { FinanceActor, JournalLineInput, VoucherType } from './types'

export interface VoucherListItem {
  id: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  bsDate: string
  dualDate: string
  narration: string
  branchId: string | null
  branchName?: string | null
  postingStatus: 'draft' | 'submitted' | 'approved' | 'cancelled'
  isReversed: boolean
  reversedBy: string | null
  reversalOf: string | null
  refType: string | null
  refId: string | null
  event: string | null
  totalDebit: number // paisa
  totalCredit: number // paisa
  lineCount: number
  attachmentCount: number
  createdBy: string
  submittedBy: string | null
  approvedBy: string | null
  createdAt: string
}

export interface GetVouchersFilters {
  voucherType?: string
  postingStatus?: string
  branchId?: string
  search?: string
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

export async function getVouchersListQuery(
  filters: GetVouchersFilters = {},
): Promise<VoucherListItem[]> {
  const conditions: SQL[] = []

  if (filters.voucherType && filters.voucherType !== 'all') {
    conditions.push(eq(journalEntries.voucherType, filters.voucherType))
  }
  if (filters.postingStatus && filters.postingStatus !== 'all') {
    conditions.push(eq(journalEntries.postingStatus, filters.postingStatus))
  }
  if (filters.branchId && filters.branchId !== 'all') {
    conditions.push(eq(journalEntries.branchId, filters.branchId))
  }
  if (filters.fromDate) {
    conditions.push(gte(journalEntries.postingDate, filters.fromDate))
  }
  if (filters.toDate) {
    conditions.push(lte(journalEntries.postingDate, filters.toDate))
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`
    conditions.push(
      sql`(
        COALESCE(${journalEntries.voucherNo}, '') ILIKE ${q}
        OR ${journalEntries.narration} ILIKE ${q}
        OR COALESCE(${journalEntries.refId}, '') ILIKE ${q}
      )`,
    )
  }

  const entries = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      postingDate: journalEntries.postingDate,
      narration: journalEntries.narration,
      branchId: journalEntries.branchId,
      branchName: branches.name,
      postingStatus: journalEntries.postingStatus,
      isReversed: journalEntries.isReversed,
      reversedBy: journalEntries.reversedBy,
      reversalOf: journalEntries.reversalOf,
      refType: journalEntries.refType,
      refId: journalEntries.refId,
      event: journalEntries.event,
      createdBy: journalEntries.createdBy,
      submittedBy: journalEntries.submittedBy,
      approvedBy: journalEntries.approvedBy,
      createdAt: journalEntries.createdAt,
    })
    .from(journalEntries)
    .leftJoin(branches, eq(journalEntries.branchId, branches.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(journalEntries.postingDate), desc(journalEntries.createdAt))
    .limit(filters.limit || 100)
    .offset(filters.offset || 0)

  if (entries.length === 0) return []

  const entryIds = entries.map((e) => e.id)

  // Aggregate line debit/credit per entry
  const lineAgg = await db
    .select({
      journalEntryId: journalLines.journalEntryId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      lineCount: sql<number>`COUNT(*)`,
    })
    .from(journalLines)
    .where(inArray(journalLines.journalEntryId, entryIds))
    .groupBy(journalLines.journalEntryId)

  const lineMap = new Map<
    string,
    { totalDebit: number; totalCredit: number; lineCount: number }
  >()
  for (const l of lineAgg) {
    lineMap.set(l.journalEntryId, {
      totalDebit: Number(l.totalDebit),
      totalCredit: Number(l.totalCredit),
      lineCount: Number(l.lineCount),
    })
  }

  // Aggregate attachments per entry
  const attachAgg = await db
    .select({
      journalEntryId: voucherAttachments.journalEntryId,
      count: sql<number>`COUNT(*)`,
    })
    .from(voucherAttachments)
    .where(inArray(voucherAttachments.journalEntryId, entryIds))
    .groupBy(voucherAttachments.journalEntryId)

  const attachMap = new Map<string, number>()
  for (const a of attachAgg) {
    attachMap.set(a.journalEntryId, Number(a.count))
  }

  return entries.map((e) => {
    const l = lineMap.get(e.id) || { totalDebit: 0, totalCredit: 0, lineCount: 0 }
    const dateObj = new Date(e.postingDate)

    return {
      id: e.id,
      voucherNo: e.voucherNo,
      voucherType: e.voucherType,
      postingDate: dateObj.toISOString(),
      bsDate: formatBS(dateObj, { format: 'long' }),
      dualDate: formatDualDate(dateObj),
      narration: e.narration,
      branchId: e.branchId,
      branchName: e.branchName,
      postingStatus: e.postingStatus as VoucherListItem['postingStatus'],
      isReversed: e.isReversed,
      reversedBy: e.reversedBy,
      reversalOf: e.reversalOf,
      refType: e.refType,
      refId: e.refId,
      event: e.event,
      totalDebit: l.totalDebit,
      totalCredit: l.totalCredit,
      lineCount: l.lineCount,
      attachmentCount: attachMap.get(e.id) || 0,
      createdBy: e.createdBy,
      submittedBy: e.submittedBy,
      approvedBy: e.approvedBy,
      createdAt: e.createdAt.toISOString(),
    }
  })
}

export async function createDraftJournalVoucherQuery(params: {
  voucherType: VoucherType
  postingDate?: Date
  narration: string
  refId?: string | null
  branchId?: string | null
  lines: JournalLineInput[]
  actor: FinanceActor
}) {
  return dbTx.transaction(async (tx) => {
    return postJournalTx(tx, {
      voucherType: params.voucherType,
      postingDate: params.postingDate,
      narration: params.narration,
      refType: params.refId ? 'manual_voucher' : null,
      refId: params.refId || null,
      branchId: params.branchId,
      postingStatus: 'draft',
      createdBy: params.actor.name,
      lines: params.lines,
    })
  })
}

export async function submitDraftVoucherQuery(params: {
  journalEntryId: string
  actor: FinanceActor
  approvedBy?: string
}) {
  return dbTx.transaction(async (tx) => {
    return submitDraftJournalTx(tx, {
      journalEntryId: params.journalEntryId,
      actor: params.actor,
      approvedBy: params.approvedBy,
    })
  })
}

export async function addVoucherAttachmentQuery(params: {
  journalEntryId: string
  url: string
  name: string
  size?: number
  mimeType?: string
  uploadedBy: string
}) {
  const id = `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

  await db.insert(voucherAttachments).values({
    id,
    journalEntryId: params.journalEntryId,
    url: params.url,
    name: params.name,
    size: params.size || 0,
    mimeType: params.mimeType || null,
    uploadedBy: params.uploadedBy,
  })

  return { id, name: params.name }
}

export async function getVoucherAttachmentsQuery(journalEntryId: string) {
  const rows = await db
    .select()
    .from(voucherAttachments)
    .where(eq(voucherAttachments.journalEntryId, journalEntryId))
    .orderBy(desc(voucherAttachments.createdAt))

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    name: r.name,
    size: r.size,
    mimeType: r.mimeType,
    uploadedBy: r.uploadedBy,
    createdAt: r.createdAt.toISOString(),
  }))
}

export interface VoucherDetailsLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  accountRootType: string
  debit: number
  credit: number
  partyType: string | null
  partyId: string | null
  branchId: string | null
  branchName?: string | null
  costCenter: string | null
  narration: string | null
}

export interface VoucherAttachmentItem {
  id: string
  url: string
  name: string
  size: number
  mimeType: string | null
  uploadedBy: string | null
  createdAt: string
}

export interface VoucherDetailsItem {
  id: string
  voucherNo: string | null
  voucherType: string
  fiscalYearId: string
  branchId: string | null
  branchName?: string | null
  postingDate: string
  bsDate: string
  dualDate: string
  narration: string
  refType: string | null
  refId: string | null
  event: string | null
  postingStatus: 'draft' | 'submitted' | 'approved' | 'cancelled'
  reversalOf: string | null
  isReversed: boolean
  reversedBy: string | null
  metadata: any
  createdBy: string
  submittedBy: string | null
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  totalDebit: number
  totalCredit: number
  lines: VoucherDetailsLine[]
  attachments: VoucherAttachmentItem[]
}

export async function getVoucherDetailsQuery(
  journalEntryId: string,
): Promise<VoucherDetailsItem | null> {
  const entryRows = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      fiscalYearId: journalEntries.fiscalYearId,
      branchId: journalEntries.branchId,
      branchName: branches.name,
      postingDate: journalEntries.postingDate,
      narration: journalEntries.narration,
      refType: journalEntries.refType,
      refId: journalEntries.refId,
      event: journalEntries.event,
      postingStatus: journalEntries.postingStatus,
      reversalOf: journalEntries.reversalOf,
      isReversed: journalEntries.isReversed,
      reversedBy: journalEntries.reversedBy,
      metadata: journalEntries.metadata,
      createdBy: journalEntries.createdBy,
      submittedBy: journalEntries.submittedBy,
      submittedAt: journalEntries.submittedAt,
      approvedBy: journalEntries.approvedBy,
      approvedAt: journalEntries.approvedAt,
      createdAt: journalEntries.createdAt,
      updatedAt: journalEntries.updatedAt,
    })
    .from(journalEntries)
    .leftJoin(branches, eq(journalEntries.branchId, branches.id))
    .where(eq(journalEntries.id, journalEntryId))
    .limit(1)

  if (entryRows.length === 0) return null
  const entry = entryRows[0]

  const lineRows = await db
    .select({
      id: journalLines.id,
      accountId: journalLines.accountId,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      accountRootType: ledgerAccounts.rootType,
      debit: journalLines.debit,
      credit: journalLines.credit,
      partyType: journalLines.partyType,
      partyId: journalLines.partyId,
      branchId: journalLines.branchId,
      branchName: branches.name,
      costCenter: journalLines.costCenter,
      narration: journalLines.narration,
    })
    .from(journalLines)
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .leftJoin(branches, eq(journalLines.branchId, branches.id))
    .where(eq(journalLines.journalEntryId, journalEntryId))
    .orderBy(asc(journalLines.id))

  const attachments = await getVoucherAttachmentsQuery(journalEntryId)

  const totalDebit = lineRows.reduce((sum, l) => sum + Number(l.debit || 0), 0)
  const totalCredit = lineRows.reduce((sum, l) => sum + Number(l.credit || 0), 0)

  const dateObj = new Date(entry.postingDate)

  return {
    id: entry.id,
    voucherNo: entry.voucherNo,
    voucherType: entry.voucherType,
    fiscalYearId: entry.fiscalYearId,
    branchId: entry.branchId,
    branchName: entry.branchName,
    postingDate: dateObj.toISOString(),
    bsDate: formatBS(dateObj, { format: 'long' }),
    dualDate: formatDualDate(dateObj),
    narration: entry.narration,
    refType: entry.refType,
    refId: entry.refId,
    event: entry.event,
    postingStatus: entry.postingStatus as VoucherListItem['postingStatus'],
    reversalOf: entry.reversalOf,
    isReversed: entry.isReversed,
    reversedBy: entry.reversedBy,
    metadata: entry.metadata,
    createdBy: entry.createdBy,
    submittedBy: entry.submittedBy,
    submittedAt: entry.submittedAt ? entry.submittedAt.toISOString() : null,
    approvedBy: entry.approvedBy,
    approvedAt: entry.approvedAt ? entry.approvedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    totalDebit,
    totalCredit,
    lines: lineRows.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      accountRootType: l.accountRootType,
      debit: Number(l.debit),
      credit: Number(l.credit),
      partyType: l.partyType,
      partyId: l.partyId,
      branchId: l.branchId,
      branchName: l.branchName,
      costCenter: l.costCenter,
      narration: l.narration,
    })),
    attachments,
  }
}
