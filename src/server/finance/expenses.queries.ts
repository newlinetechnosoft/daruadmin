import { db, dbTx } from '#/db'
import {
  branches,
  costCenters,
  expenseCategories,
  expenses,
  journalEntries,
  journalLines,
  ledgerAccounts,
} from '#/db/schema'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { postExpensePaymentTx } from './double-entry'
import type { FinanceActor } from './types'

export interface ExpenseCategoryItem {
  id: string
  name: string
  description: string | null
  defaultAccountId: string | null
  defaultAccountName?: string | null
  defaultAccountCode?: string | null
  isActive: boolean
  createdAt: string
}

export async function getExpenseCategoriesQuery(): Promise<ExpenseCategoryItem[]> {
  const rows = await db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      description: expenseCategories.description,
      defaultAccountId: expenseCategories.defaultAccountId,
      defaultAccountName: ledgerAccounts.name,
      defaultAccountCode: ledgerAccounts.code,
      isActive: expenseCategories.isActive,
      createdAt: expenseCategories.createdAt,
    })
    .from(expenseCategories)
    .leftJoin(
      ledgerAccounts,
      eq(expenseCategories.defaultAccountId, ledgerAccounts.id),
    )
    .orderBy(asc(expenseCategories.name))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    defaultAccountId: r.defaultAccountId,
    defaultAccountName: r.defaultAccountName,
    defaultAccountCode: r.defaultAccountCode,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function createExpenseCategoryQuery(params: {
  name: string
  description?: string
  defaultAccountId?: string
}): Promise<ExpenseCategoryItem> {
  const id = `expcat_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
  await db.insert(expenseCategories).values({
    id,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    defaultAccountId: params.defaultAccountId || null,
  })

  return {
    id,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    defaultAccountId: params.defaultAccountId || null,
    isActive: true,
    createdAt: new Date().toISOString(),
  }
}

export interface ExpenseItem {
  id: string
  expenseNumber: string
  categoryAccountId: string
  categoryAccountName: string
  categoryAccountCode: string
  paymentAccountId: string | null
  paymentAccountName?: string | null
  amount: number // paisa
  taxAmount: number // paisa
  expenseDate: string
  vendorName: string | null
  vendorPan: string | null
  branchId: string | null
  branchName?: string | null
  costCenterId: string | null
  costCenterName?: string | null
  paymentMethod: string | null
  paymentReference: string | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
  receiptUrls: string[]
  notes: string | null
  submittedBy: string
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  paidBy: string | null
  paidAt: string | null
  journalEntryId: string | null
  voucherNo?: string | null
  createdAt: string
  updatedAt: string
}

export interface GetExpensesFilters {
  search?: string
  status?: string
  branchId?: string
  categoryId?: string
  categoryAccountId?: string
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

export async function getExpensesQuery(
  filters: GetExpensesFilters = {},
): Promise<ExpenseItem[]> {
  const conditions: SQL[] = []

  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(expenses.status, filters.status))
  }
  if (filters.branchId && filters.branchId !== 'all') {
    conditions.push(eq(expenses.branchId, filters.branchId))
  }
  if (filters.categoryAccountId && filters.categoryAccountId !== 'all') {
    conditions.push(eq(expenses.categoryAccountId, filters.categoryAccountId))
  } else if (filters.categoryId && filters.categoryId !== 'all') {
    // If categoryId was passed from UI, look up whether it's a category id or account id
    const catRows = await db
      .select({ defaultAccountId: expenseCategories.defaultAccountId })
      .from(expenseCategories)
      .where(eq(expenseCategories.id, filters.categoryId))
      .limit(1)

    if (catRows[0]?.defaultAccountId) {
      conditions.push(eq(expenses.categoryAccountId, catRows[0].defaultAccountId))
    } else {
      conditions.push(eq(expenses.categoryAccountId, filters.categoryId))
    }
  }
  if (filters.fromDate) {
    conditions.push(gte(expenses.expenseDate, filters.fromDate))
  }
  if (filters.toDate) {
    conditions.push(lte(expenses.expenseDate, filters.toDate))
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`
    conditions.push(
      sql`(
        ${expenses.expenseNumber} ILIKE ${q}
        OR ${expenses.vendorName} ILIKE ${q}
        OR ${expenses.vendorPan} ILIKE ${q}
        OR ${expenses.notes} ILIKE ${q}
      )`,
    )
  }

  const rows = await db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      categoryAccountId: expenses.categoryAccountId,
      categoryAccountName: ledgerAccounts.name,
      categoryAccountCode: ledgerAccounts.code,
      paymentAccountId: expenses.paymentAccountId,
      amount: expenses.amount,
      taxAmount: expenses.taxAmount,
      expenseDate: expenses.expenseDate,
      vendorName: expenses.vendorName,
      vendorPan: expenses.vendorPan,
      branchId: expenses.branchId,
      branchName: branches.name,
      costCenterId: expenses.costCenterId,
      costCenterName: costCenters.name,
      paymentMethod: expenses.paymentMethod,
      paymentReference: expenses.paymentReference,
      status: expenses.status,
      receiptUrls: expenses.receiptUrls,
      notes: expenses.notes,
      submittedBy: expenses.submittedBy,
      submittedAt: expenses.submittedAt,
      approvedBy: expenses.approvedBy,
      approvedAt: expenses.approvedAt,
      paidBy: expenses.paidBy,
      paidAt: expenses.paidAt,
      journalEntryId: expenses.journalEntryId,
      voucherNo: journalEntries.voucherNo,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .innerJoin(
      ledgerAccounts,
      eq(expenses.categoryAccountId, ledgerAccounts.id),
    )
    .leftJoin(branches, eq(expenses.branchId, branches.id))
    .leftJoin(costCenters, eq(expenses.costCenterId, costCenters.id))
    .leftJoin(journalEntries, eq(expenses.journalEntryId, journalEntries.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
    .limit(filters.limit || 100)
    .offset(filters.offset || 0)

  return rows.map((r) => ({
    id: r.id,
    expenseNumber: r.expenseNumber,
    categoryAccountId: r.categoryAccountId,
    categoryAccountName: r.categoryAccountName,
    categoryAccountCode: r.categoryAccountCode,
    paymentAccountId: r.paymentAccountId,
    paymentAccountName: null,
    amount: r.amount,
    taxAmount: r.taxAmount,
    expenseDate: r.expenseDate.toISOString(),
    vendorName: r.vendorName,
    vendorPan: r.vendorPan,
    branchId: r.branchId,
    branchName: r.branchName,
    costCenterId: r.costCenterId,
    costCenterName: r.costCenterName,
    paymentMethod: r.paymentMethod,
    paymentReference: r.paymentReference,
    status: r.status as ExpenseItem['status'],
    receiptUrls: Array.isArray(r.receiptUrls) ? (r.receiptUrls as string[]) : [],
    notes: r.notes,
    submittedBy: r.submittedBy,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    paidBy: r.paidBy,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    journalEntryId: r.journalEntryId,
    voucherNo: r.voucherNo,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export interface CreateExpenseInput {
  categoryAccountId: string
  amount: number // paisa
  taxAmount?: number // paisa
  expenseDate?: Date
  vendorName?: string | null
  vendorPan?: string | null
  branchId?: string | null
  costCenterId?: string | null
  paymentMethod?: string
  paymentReference?: string | null
  receiptUrls?: string[]
  notes?: string | null
  actor: FinanceActor
}

export async function createExpenseQuery(
  input: CreateExpenseInput,
): Promise<{ id: string; expenseNumber: string }> {
  const countRes = await db.select({ count: sql<number>`COUNT(*)` }).from(expenses)
  const nextNo = Number(countRes[0]?.count || 0) + 1
  const expenseNumber = `EXP-2083-${nextNo.toString().padStart(5, '0')}`
  const id = `exp_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const now = new Date()

  await db.insert(expenses).values({
    id,
    expenseNumber,
    categoryAccountId: input.categoryAccountId,
    amount: input.amount,
    taxAmount: input.taxAmount || 0,
    expenseDate: input.expenseDate || now,
    vendorName: input.vendorName?.trim() || null,
    vendorPan: input.vendorPan?.trim() || null,
    branchId: input.branchId || null,
    costCenterId: input.costCenterId || null,
    paymentMethod: input.paymentMethod || 'cash',
    paymentReference: input.paymentReference?.trim() || null,
    receiptUrls: input.receiptUrls || [],
    notes: input.notes?.trim() || null,
    status: 'submitted',
    submittedBy: input.actor.name,
    submittedAt: now,
  })

  return { id, expenseNumber }
}

export async function approveExpenseQuery(
  expenseId: string,
  actor: FinanceActor,
): Promise<{ success: boolean }> {
  const exp = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1)

  if (!exp[0]) throw new Error('Expense record not found.')
  if (exp[0].status !== 'submitted') {
    throw new Error(`Expense cannot be approved (current status: ${exp[0].status}).`)
  }

  await db
    .update(expenses)
    .set({
      status: 'approved',
      approvedBy: actor.name,
      approvedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId))

  return { success: true }
}

export async function rejectExpenseQuery(params: {
  expenseId: string
  reason?: string
  actor: FinanceActor
}): Promise<{ success: boolean }> {
  const exp = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, params.expenseId))
    .limit(1)

  if (!exp[0]) throw new Error('Expense record not found.')
  if (exp[0].status !== 'submitted') {
    throw new Error(`Expense cannot be rejected (current status: ${exp[0].status}).`)
  }

  const updatedNotes = params.reason?.trim()
    ? `${exp[0].notes ? `${exp[0].notes}\n` : ''}[Rejected by ${params.actor.name}: ${params.reason.trim()}]`
    : exp[0].notes

  await db
    .update(expenses)
    .set({
      status: 'rejected',
      notes: updatedNotes,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, params.expenseId))

  return { success: true }
}

export async function payExpenseQuery(params: {
  expenseId: string
  paymentAccountId: string
  paymentMethod?: string
  paymentReference?: string | null
  tdsAmount?: number // paisa
  postingDate?: Date
  actor: FinanceActor
}): Promise<{ voucherNo: string | null }> {
  const expRows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, params.expenseId))
    .limit(1)

  if (!expRows[0]) throw new Error('Expense record not found.')
  const exp = expRows[0]

  if (exp.status !== 'approved' && exp.status !== 'submitted') {
    throw new Error(`Expense cannot be paid (current status: ${exp.status}).`)
  }

  const now = params.postingDate || new Date()

  return dbTx.transaction(async (tx) => {
    const posting = await postExpensePaymentTx(tx, {
      expenseId: exp.id,
      expenseNumber: exp.expenseNumber,
      categoryAccountId: exp.categoryAccountId,
      paymentAccountId: params.paymentAccountId,
      amount: exp.amount,
      taxAmount: exp.taxAmount,
      tdsAmount: params.tdsAmount || 0,
      vendorName: exp.vendorName,
      branchId: exp.branchId,
      costCenterId: exp.costCenterId,
      narration: exp.notes || `Disbursement for expense ${exp.expenseNumber}`,
      postingDate: now,
      actor: params.actor,
    })

    await tx
      .update(expenses)
      .set({
        paymentAccountId: params.paymentAccountId,
        paymentMethod: params.paymentMethod || exp.paymentMethod,
        paymentReference: params.paymentReference || exp.paymentReference,
        status: 'paid',
        paidBy: params.actor.name,
        paidAt: now,
        journalEntryId: posting.journalEntryId,
      })
      .where(eq(expenses.id, exp.id))

    return { voucherNo: posting.voucherNo }
  })
}

export interface ExpenseDetailsItem extends ExpenseItem {
  branchCode?: string | null
  costCenterCode?: string | null
  voucherType?: string | null
  voucherPostingDate?: string | null
  journalMetadata?: any
  journalLines?: Array<{
    id: string
    accountId: string
    accountCode: string
    accountName: string
    accountType?: string | null
    debit: number
    credit: number
    narration: string | null
  }>
}

export async function getExpenseDetailsQuery(
  expenseId: string,
): Promise<ExpenseDetailsItem> {
  const rows = await db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      categoryAccountId: expenses.categoryAccountId,
      categoryAccountName: ledgerAccounts.name,
      categoryAccountCode: ledgerAccounts.code,
      paymentAccountId: expenses.paymentAccountId,
      amount: expenses.amount,
      taxAmount: expenses.taxAmount,
      expenseDate: expenses.expenseDate,
      vendorName: expenses.vendorName,
      vendorPan: expenses.vendorPan,
      branchId: expenses.branchId,
      branchName: branches.name,
      branchCode: branches.code,
      costCenterId: expenses.costCenterId,
      costCenterName: costCenters.name,
      costCenterCode: costCenters.code,
      paymentMethod: expenses.paymentMethod,
      paymentReference: expenses.paymentReference,
      status: expenses.status,
      receiptUrls: expenses.receiptUrls,
      notes: expenses.notes,
      submittedBy: expenses.submittedBy,
      submittedAt: expenses.submittedAt,
      approvedBy: expenses.approvedBy,
      approvedAt: expenses.approvedAt,
      paidBy: expenses.paidBy,
      paidAt: expenses.paidAt,
      journalEntryId: expenses.journalEntryId,
      voucherNo: journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      voucherPostingDate: journalEntries.postingDate,
      journalMetadata: journalEntries.metadata,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .innerJoin(
      ledgerAccounts,
      eq(expenses.categoryAccountId, ledgerAccounts.id),
    )
    .leftJoin(branches, eq(expenses.branchId, branches.id))
    .leftJoin(costCenters, eq(expenses.costCenterId, costCenters.id))
    .leftJoin(journalEntries, eq(expenses.journalEntryId, journalEntries.id))
    .where(eq(expenses.id, expenseId))
    .limit(1)

  if (!rows[0]) {
    throw new Error(`Expense claim not found for ID: ${expenseId}`)
  }

  const r = rows[0]
  let lines: ExpenseDetailsItem['journalLines'] = []

  if (r.journalEntryId) {
    const rawLines = await db
      .select({
        id: journalLines.id,
        accountId: journalLines.accountId,
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        accountType: ledgerAccounts.accountType,
        debit: journalLines.debit,
        credit: journalLines.credit,
        narration: journalLines.narration,
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(eq(journalLines.journalEntryId, r.journalEntryId))
      .orderBy(desc(journalLines.debit))

    lines = rawLines
  }

  let paymentAccountName: string | null = null
  if (r.paymentAccountId) {
    const payAcc = await db
      .select({ name: ledgerAccounts.name, code: ledgerAccounts.code })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.id, r.paymentAccountId))
      .limit(1)
    if (payAcc[0]) {
      paymentAccountName = `${payAcc[0].code} - ${payAcc[0].name}`
    }
  }

  return {
    id: r.id,
    expenseNumber: r.expenseNumber,
    categoryAccountId: r.categoryAccountId,
    categoryAccountName: r.categoryAccountName,
    categoryAccountCode: r.categoryAccountCode,
    paymentAccountId: r.paymentAccountId,
    paymentAccountName,
    amount: r.amount,
    taxAmount: r.taxAmount,
    expenseDate: r.expenseDate.toISOString(),
    vendorName: r.vendorName,
    vendorPan: r.vendorPan,
    branchId: r.branchId,
    branchName: r.branchName,
    branchCode: r.branchCode,
    costCenterId: r.costCenterId,
    costCenterName: r.costCenterName,
    costCenterCode: r.costCenterCode,
    paymentMethod: r.paymentMethod,
    paymentReference: r.paymentReference,
    status: r.status as ExpenseItem['status'],
    receiptUrls: Array.isArray(r.receiptUrls) ? (r.receiptUrls as string[]) : [],
    notes: r.notes,
    submittedBy: r.submittedBy,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    paidBy: r.paidBy,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    journalEntryId: r.journalEntryId,
    voucherNo: r.voucherNo,
    voucherType: r.voucherType,
    voucherPostingDate: r.voucherPostingDate ? r.voucherPostingDate.toISOString() : null,
    journalMetadata: r.journalMetadata,
    journalLines: lines,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

