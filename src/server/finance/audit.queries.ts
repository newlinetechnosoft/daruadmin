import { db } from '#/db'
import {
  auditLogs,
  journalEntries,
  journalLines,
} from '#/db/schema'
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'

export interface FinancialAuditLogItem {
  id: string
  actor: string
  module: string
  action: string
  detail: string
  createdAt: string
}

export interface FinancialAuditLogsResult {
  items: FinancialAuditLogItem[]
  totalCount: number
}

export async function getFinancialAuditLogsQuery(params?: {
  fromDate?: string
  toDate?: string
  action?: string
  actor?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<FinancialAuditLogsResult> {
  const conditions = [eq(auditLogs.module, 'accounts')]

  if (params?.action && params.action !== 'all') {
    conditions.push(eq(auditLogs.action, params.action))
  }

  if (params?.actor && params.actor.trim() !== '') {
    conditions.push(ilike(auditLogs.actor, `%${params.actor.trim()}%`))
  }

  if (params?.search && params.search.trim() !== '') {
    const s = `%${params.search.trim()}%`
    conditions.push(or(ilike(auditLogs.detail, s), ilike(auditLogs.actor, s))!)
  }

  if (params?.fromDate) {
    conditions.push(gte(auditLogs.createdAt, new Date(params.fromDate)))
  }

  if (params?.toDate) {
    const to = new Date(params.toDate)
    to.setHours(23, 59, 59, 999)
    conditions.push(lte(auditLogs.createdAt, to))
  }

  const whereClause = and(...conditions)

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(whereClause),
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params?.limit || 100)
      .offset(params?.offset || 0),
  ])

  return {
    totalCount: Number(countResult[0]?.count || 0),
    items: rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      module: r.module,
      action: r.action,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export interface VoucherApprovalLogItem {
  id: string
  voucherNo: string | null
  voucherType: string
  narration: string
  postingDate: string
  postingStatus: string
  totalAmount: number
  submittedBy: string | null
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  isReversed: boolean
}

export async function getVoucherApprovalLogsQuery(params?: {
  limit?: number
}): Promise<VoucherApprovalLogItem[]> {
  const rows = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      narration: journalEntries.narration,
      postingDate: journalEntries.postingDate,
      postingStatus: journalEntries.postingStatus,
      submittedBy: journalEntries.submittedBy,
      submittedAt: journalEntries.submittedAt,
      approvedBy: journalEntries.approvedBy,
      approvedAt: journalEntries.approvedAt,
      isReversed: journalEntries.isReversed,
      totalAmount: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
    })
    .from(journalEntries)
    .leftJoin(
      journalLines,
      eq(journalEntries.id, journalLines.journalEntryId),
    )
    .groupBy(
      journalEntries.id,
      journalEntries.voucherNo,
      journalEntries.voucherType,
      journalEntries.narration,
      journalEntries.postingDate,
      journalEntries.postingStatus,
      journalEntries.submittedBy,
      journalEntries.submittedAt,
      journalEntries.approvedBy,
      journalEntries.approvedAt,
      journalEntries.isReversed,
    )
    .orderBy(desc(journalEntries.postingDate))
    .limit(params?.limit || 100)

  return rows.map((r) => ({
    id: r.id,
    voucherNo: r.voucherNo,
    voucherType: r.voucherType,
    narration: r.narration,
    postingDate: r.postingDate.toISOString(),
    postingStatus: r.postingStatus,
    totalAmount: Number(r.totalAmount),
    submittedBy: r.submittedBy,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    isReversed: Boolean(r.isReversed),
  }))
}

export interface ReversalPairItem {
  original: {
    id: string
    voucherNo: string | null
    voucherType: string
    narration: string
    postingDate: string
    totalAmount: number
  }
  reversal: {
    id: string
    voucherNo: string | null
    voucherType: string
    narration: string
    postingDate: string
    totalAmount: number
  }
}

export async function getReversalHistoryQuery(): Promise<ReversalPairItem[]> {
  // Query entries that are reversals (reversalOf is not null)
  const reversalEntries = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      narration: journalEntries.narration,
      postingDate: journalEntries.postingDate,
      reversalOf: journalEntries.reversalOf,
      totalAmount: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
    })
    .from(journalEntries)
    .leftJoin(
      journalLines,
      eq(journalEntries.id, journalLines.journalEntryId),
    )
    .where(sql`${journalEntries.reversalOf} IS NOT NULL`)
    .groupBy(
      journalEntries.id,
      journalEntries.voucherNo,
      journalEntries.voucherType,
      journalEntries.narration,
      journalEntries.postingDate,
      journalEntries.reversalOf,
    )
    .orderBy(desc(journalEntries.postingDate))
    .limit(100)

  if (reversalEntries.length === 0) return []

  const originalIds = reversalEntries
    .map((r) => r.reversalOf)
    .filter((id): id is string => Boolean(id))

  const originalEntries = await db
    .select({
      id: journalEntries.id,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      narration: journalEntries.narration,
      postingDate: journalEntries.postingDate,
      totalAmount: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
    })
    .from(journalEntries)
    .leftJoin(
      journalLines,
      eq(journalEntries.id, journalLines.journalEntryId),
    )
    .where(sql`${journalEntries.id} IN ${originalIds}`)
    .groupBy(
      journalEntries.id,
      journalEntries.voucherNo,
      journalEntries.voucherType,
      journalEntries.narration,
      journalEntries.postingDate,
    )

  const originalMap = new Map(originalEntries.map((o) => [o.id, o]))

  const pairs: ReversalPairItem[] = []

  for (const rev of reversalEntries) {
    if (!rev.reversalOf) continue
    const orig = originalMap.get(rev.reversalOf)
    if (orig) {
      pairs.push({
        original: {
          id: orig.id,
          voucherNo: orig.voucherNo,
          voucherType: orig.voucherType,
          narration: orig.narration,
          postingDate: orig.postingDate.toISOString(),
          totalAmount: Number(orig.totalAmount),
        },
        reversal: {
          id: rev.id,
          voucherNo: rev.voucherNo,
          voucherType: rev.voucherType,
          narration: rev.narration,
          postingDate: rev.postingDate.toISOString(),
          totalAmount: Number(rev.totalAmount),
        },
      })
    }
  }

  return pairs
}

export async function getExportAuditLogsQuery(): Promise<FinancialAuditLogItem[]> {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.module, 'accounts'), eq(auditLogs.action, 'export')))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100)

  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    module: r.module,
    action: r.action,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  }))
}
