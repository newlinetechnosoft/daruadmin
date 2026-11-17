import { db } from '#/db'
import { ledgerAccounts, journalLines } from '#/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import type { DbTx } from './types'

export interface AccountTreeNode {
  id: string
  code: string
  name: string
  rootType: string
  parentId: string | null
  isGroup: boolean
  currency: string
  isActive: boolean
  accountType: string | null
  balanceMustBe: string | null
  isFrozen: boolean
  sortOrder: number
  description: string | null
  totalDebit: number
  totalCredit: number
  netBalance: number
  lineCount: number
  children?: AccountTreeNode[]
}

export async function getChartOfAccountsTreeQuery(): Promise<AccountTreeNode[]> {
  const accounts = await db
    .select()
    .from(ledgerAccounts)
    .orderBy(asc(ledgerAccounts.code), asc(ledgerAccounts.sortOrder))

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

  const nodes: AccountTreeNode[] = accounts.map((acc) => {
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
      currency: acc.currency,
      isActive: acc.isActive,
      accountType: acc.accountType,
      balanceMustBe: acc.balanceMustBe,
      isFrozen: acc.isFrozen,
      sortOrder: acc.sortOrder,
      description: acc.description,
      totalDebit: agg.totalDebit,
      totalCredit: agg.totalCredit,
      netBalance,
      lineCount: agg.lineCount,
    }
  })

  // Build tree
  const nodeMap = new Map<string, AccountTreeNode>()
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n, children: [] })
  }

  const rootNodes: AccountTreeNode[] = []
  for (const n of nodeMap.values()) {
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children!.push(n)
    } else {
      rootNodes.push(n)
    }
  }

  // Roll up group balances from children
  function rollUpGroupBalances(node: AccountTreeNode) {
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        rollUpGroupBalances(child)
        if (node.isGroup) {
          node.totalDebit += child.totalDebit
          node.totalCredit += child.totalCredit
          node.lineCount += child.lineCount
        }
      }
      if (node.isGroup) {
        const isDebitNormal =
          node.rootType === 'asset' || node.rootType === 'expense'
        node.netBalance = isDebitNormal
          ? node.totalDebit - node.totalCredit
          : node.totalCredit - node.totalDebit
      }
    }
  }

  for (const root of rootNodes) {
    rollUpGroupBalances(root)
  }

  return rootNodes
}

export interface CreateAccountInput {
  code?: string
  name: string
  rootType?: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  parentId?: string | null
  isGroup?: boolean
  accountType?: string | null
  balanceMustBe?: 'debit' | 'credit' | null
  currency?: string
  description?: string | null
}

export async function createAccountQuery(
  input: CreateAccountInput,
  tx?: DbTx,
): Promise<{ id: string; code: string; name: string }> {
  const runner = tx || db

  let rootType = input.rootType
  let code = input.code?.trim()

  if (input.parentId) {
    const parent = await runner
      .select()
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.id, input.parentId))
      .limit(1)

    if (!parent[0]) {
      throw new Error(`Parent account ${input.parentId} not found.`)
    }
    if (!parent[0].isGroup) {
      throw new Error(
        `Parent account "${parent[0].name}" (${parent[0].code}) is not a group folder. Only group accounts can have sub-accounts.`,
      )
    }
    rootType = parent[0].rootType as CreateAccountInput['rootType']

    if (!code) {
      // Auto-generate code based on parent
      const siblings = await runner
        .select({ code: ledgerAccounts.code })
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.parentId, input.parentId))

      const siblingCodes = siblings.map((s) => s.code)
      let nextSuffix = 1
      while (siblingCodes.includes(`${parent[0].code}${nextSuffix.toString().padStart(2, '0')}`)) {
        nextSuffix++
      }
      code = `${parent[0].code}${nextSuffix.toString().padStart(2, '0')}`
    }
  }

  if (!rootType) {
    throw new Error('Account root type is required.')
  }

  if (!code) {
    // Generate code based on root type
    const rootPrefixMap: Record<string, string> = {
      asset: '19',
      liability: '29',
      equity: '39',
      income: '49',
      expense: '59',
    }
    const prefix = rootPrefixMap[rootType] || '99'
    code = `${prefix}${Math.floor(100 + Math.random() * 900)}`
  }

  // Check unique code
  const existing = await runner
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.code, code))
    .limit(1)

  if (existing[0]) {
    throw new Error(`Account code "${code}" is already in use by another account.`)
  }

  const id = `acc_${code}`

  await runner.insert(ledgerAccounts).values({
    id,
    code,
    name: input.name.trim(),
    rootType,
    parentId: input.parentId || null,
    isGroup: input.isGroup ?? false,
    currency: input.currency || 'NPR',
    isActive: true,
    accountType: input.accountType || null,
    balanceMustBe: input.balanceMustBe || null,
    isFrozen: false,
    description: input.description?.trim() || null,
  })

  return { id, code, name: input.name }
}

export interface UpdateAccountInput {
  id: string
  name?: string
  description?: string | null
  accountType?: string | null
  balanceMustBe?: 'debit' | 'credit' | null
  isFrozen?: boolean
  isActive?: boolean
}

export async function updateAccountQuery(
  input: UpdateAccountInput,
  tx?: DbTx,
): Promise<{ success: boolean }> {
  const runner = tx || db

  const existing = await runner
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, input.id))
    .limit(1)

  if (!existing[0]) {
    throw new Error(`Account ${input.id} not found.`)
  }

  // If deactivating, assert account has zero unresolved balance
  if (input.isActive === false && existing[0].isActive) {
    const lines = await runner
      .select({
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(journalLines)
      .where(eq(journalLines.accountId, input.id))

    const debit = Number(lines[0]?.totalDebit || 0)
    const credit = Number(lines[0]?.totalCredit || 0)
    const net = debit - credit

    if (net !== 0) {
      throw new Error(
        `Cannot deactivate account "${existing[0].name}" (${existing[0].code}) because it has an unresolved balance of Rs. ${(Math.abs(net) / 100).toFixed(2)}. Settle all balances before deactivation.`,
      )
    }
  }

  const updateData: Record<string, any> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.description !== undefined) updateData.description = input.description?.trim() || null
  if (input.accountType !== undefined) updateData.accountType = input.accountType || null
  if (input.balanceMustBe !== undefined) updateData.balanceMustBe = input.balanceMustBe || null
  if (input.isFrozen !== undefined) updateData.isFrozen = input.isFrozen
  if (input.isActive !== undefined) updateData.isActive = input.isActive

  await runner
    .update(ledgerAccounts)
    .set(updateData)
    .where(eq(ledgerAccounts.id, input.id))

  return { success: true }
}

export async function deleteAccountQuery(id: string): Promise<{ success: boolean }> {
  // Check children
  const children = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.parentId, id))
    .limit(1)

  if (children.length > 0) {
    throw new Error('Cannot delete an account that has child sub-accounts. Remove or re-assign children first.')
  }

  // Check journal lines
  const lines = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalLines)
    .where(eq(journalLines.accountId, id))

  if (Number(lines[0]?.count || 0) > 0) {
    throw new Error('Cannot delete an account that has posted journal entries. You can freeze or deactivate it instead.')
  }

  await db.delete(ledgerAccounts).where(eq(ledgerAccounts.id, id))
  return { success: true }
}
