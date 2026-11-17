import { db } from '#/db'
import { branches, journalEntries, journalLines, ledgerAccounts } from '#/db/schema'
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import type { DbTx } from './types'

export interface BranchItem {
  id: string
  code: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
  isHeadOffice: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export async function getBranchesQuery(): Promise<BranchItem[]> {
  const rows = await db
    .select()
    .from(branches)
    .orderBy(asc(branches.code))

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    city: r.city,
    address: r.address,
    phone: r.phone,
    isHeadOffice: r.isHeadOffice,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export interface CreateBranchInput {
  code: string
  name: string
  city?: string | null
  address?: string | null
  phone?: string | null
  isHeadOffice?: boolean
}

export async function createBranchQuery(
  input: CreateBranchInput,
  tx?: DbTx,
): Promise<{ id: string; code: string; name: string }> {
  const runner = tx || db
  const code = input.code.trim().toUpperCase()
  const id = `br_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

  const existing = await runner
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.code, code))
    .limit(1)

  if (existing[0]) {
    throw new Error(`Branch code "${code}" is already in use.`)
  }

  await runner.insert(branches).values({
    id,
    code,
    name: input.name.trim(),
    city: input.city?.trim() || null,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    isHeadOffice: input.isHeadOffice ?? false,
    isActive: true,
  })

  return { id, code, name: input.name }
}

export interface UpdateBranchInput {
  id: string
  name?: string
  city?: string | null
  address?: string | null
  phone?: string | null
  isHeadOffice?: boolean
  isActive?: boolean
}

export async function updateBranchQuery(
  input: UpdateBranchInput,
  tx?: DbTx,
): Promise<{ success: boolean }> {
  const runner = tx || db

  const updateData: Record<string, any> = { updatedAt: new Date() }
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.city !== undefined) updateData.city = input.city?.trim() || null
  if (input.address !== undefined) updateData.address = input.address?.trim() || null
  if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null
  if (input.isHeadOffice !== undefined) updateData.isHeadOffice = input.isHeadOffice
  if (input.isActive !== undefined) updateData.isActive = input.isActive

  await runner.update(branches).set(updateData).where(eq(branches.id, input.id))

  return { success: true }
}

export interface BranchProfitabilityRow {
  branchId: string
  branchCode: string
  branchName: string
  totalIncome: number // paisa
  totalCogs: number // paisa
  grossProfit: number // paisa
  totalExpenses: number // paisa
  netProfit: number // paisa
}

export async function getBranchProfitabilityQuery(params?: {
  branchId?: string
  fromDate?: Date
  toDate?: Date
}): Promise<BranchProfitabilityRow[]> {
  const allBranches = await getBranchesQuery()

  const conditions = [eq(journalEntries.postingStatus, 'submitted')]
  if (params?.branchId && params.branchId !== 'all') {
    conditions.push(eq(journalLines.branchId, params.branchId))
  }
  if (params?.fromDate) {
    conditions.push(gte(journalEntries.postingDate, params.fromDate))
  }
  if (params?.toDate) {
    conditions.push(lte(journalEntries.postingDate, params.toDate))
  }

  const rows = await db
    .select({
      branchId: journalLines.branchId,
      rootType: ledgerAccounts.rootType,
      accountType: ledgerAccounts.accountType,
      debit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      credit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .where(and(...conditions))
    .groupBy(journalLines.branchId, ledgerAccounts.rootType, ledgerAccounts.accountType)

  const branchMap = new Map<
    string,
    { income: number; cogs: number; expenses: number }
  >()

  for (const r of rows) {
    const bId = r.branchId || 'unassigned'
    const cur = branchMap.get(bId) || { income: 0, cogs: 0, expenses: 0 }

    const debit = Number(r.debit)
    const credit = Number(r.credit)

    if (r.rootType === 'income') {
      cur.income += credit - debit
    } else if (r.rootType === 'expense') {
      if (r.accountType === 'cogs') {
        cur.cogs += debit - credit
      } else {
        cur.expenses += debit - credit
      }
    }
    branchMap.set(bId, cur)
  }

  const result: BranchProfitabilityRow[] = allBranches.map((b) => {
    const cur = branchMap.get(b.id) || { income: 0, cogs: 0, expenses: 0 }
    const grossProfit = cur.income - cur.cogs
    const netProfit = grossProfit - cur.expenses

    return {
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name,
      totalIncome: cur.income,
      totalCogs: cur.cogs,
      grossProfit,
      totalExpenses: cur.expenses,
      netProfit,
    }
  })

  // Add unassigned if any
  const unassigned = branchMap.get('unassigned')
  if (unassigned && (unassigned.income !== 0 || unassigned.expenses !== 0)) {
    result.push({
      branchId: 'unassigned',
      branchCode: 'UNASSIGNED',
      branchName: 'Headquarters / Unassigned',
      totalIncome: unassigned.income,
      totalCogs: unassigned.cogs,
      grossProfit: unassigned.income - unassigned.cogs,
      totalExpenses: unassigned.expenses,
      netProfit: unassigned.income - unassigned.cogs - unassigned.expenses,
    })
  }

  return result
}
