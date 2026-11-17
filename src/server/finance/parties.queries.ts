import { db } from '#/db'
import {
  dealers,
  journalEntries,
  journalLines,
  ledgerAccounts,
  riders,
  user,
} from '#/db/schema'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { resolveAccount } from './account-keys'
import type { PartyType } from './types'

export interface PartySummaryRow {
  partyId: string
  partyName: string
  partyType: PartyType
  partyCode?: string | null
  phone?: string | null
  city?: string | null
  controlAccountCode: string
  controlAccountName: string
  totalDebit: number // paisa
  totalCredit: number // paisa
  currentBalance: number // paisa
  balanceDirection: 'Dr' | 'Cr'
  lastActivityDate: string | null
}

export async function getPartiesSummaryQuery(params: {
  partyType: PartyType
  search?: string
  limit?: number
  offset?: number
}): Promise<PartySummaryRow[]> {
  const { partyType } = params

  // 1. Resolve party control account
  let controlAccountKey = 'DEALER_PAYABLE'
  if (partyType === 'rider') controlAccountKey = 'RIDER_PAYABLE'
  else if (partyType === 'customer') controlAccountKey = 'CUSTOMER_RECEIVABLE'
  else if (partyType === 'supplier') controlAccountKey = 'DEALER_PAYABLE'
  else if (partyType === 'employee') controlAccountKey = 'STAFF_RIDER_ADVANCES'

  const controlAccountId = await resolveAccount(db, controlAccountKey)
  const controlAccount = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, controlAccountId))
    .limit(1)

  const isDebitNormal =
    controlAccount[0]?.rootType === 'asset' ||
    controlAccount[0]?.rootType === 'expense'

  // 2. Fetch party entities
  interface RawParty {
    id: string
    name: string
    code?: string | null
    phone?: string | null
    city?: string | null
  }
  let parties: RawParty[] = []

  if (partyType === 'dealer' || partyType === 'supplier') {
    const rows = await db.select().from(dealers).orderBy(asc(dealers.name))
    parties = rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.pan || null,
      phone: r.contact,
      city: r.city,
    }))
  } else if (partyType === 'rider') {
    const rows = await db.select().from(riders).orderBy(asc(riders.name))
    parties = rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.licenseNo || null,
      phone: r.phone,
      city: r.zone,
    }))
  } else if (partyType === 'customer') {
    // Customers from users table with role 'customer'
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        phone: user.phone,
      })
      .from(user)
      .where(eq(user.role, 'customer'))
      .orderBy(asc(user.name))
    parties = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
    }))
  } else if (partyType === 'employee') {
    // Staff/Managers/Admins from users table
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        phone: user.phone,
      })
      .from(user)
      .where(
        sql`${user.role} IN ('admin', 'manager', 'editor', 'operator')`,
      )
      .orderBy(asc(user.name))
    parties = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
    }))
  }

  // 3. Filter by search if provided
  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase()
    parties = parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)),
    )
  }

  if (parties.length === 0) return []

  const partyIds = parties.map((p) => p.id)

  // 4. Query journal lines aggregate per party for this partyType
  const lines = await db
    .select({
      partyId: journalLines.partyId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      lastActivityDate: sql<Date>`MAX(${journalEntries.postingDate})`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.partyType, partyType),
        eq(journalEntries.postingStatus, 'submitted'),
        inArray(journalLines.partyId, partyIds),
      ),
    )
    .groupBy(journalLines.partyId)

  const lineMap = new Map<
    string,
    { totalDebit: number; totalCredit: number; lastActivityDate: Date | null }
  >()
  for (const l of lines) {
    if (l.partyId) {
      lineMap.set(l.partyId, {
        totalDebit: Number(l.totalDebit),
        totalCredit: Number(l.totalCredit),
        lastActivityDate: l.lastActivityDate ? new Date(l.lastActivityDate) : null,
      })
    }
  }

  return parties.map((p) => {
    const agg = lineMap.get(p.id) || {
      totalDebit: 0,
      totalCredit: 0,
      lastActivityDate: null,
    }

    const net = isDebitNormal
      ? agg.totalDebit - agg.totalCredit
      : agg.totalCredit - agg.totalDebit

    const direction: 'Dr' | 'Cr' =
      net >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : isDebitNormal ? 'Cr' : 'Dr'

    return {
      partyId: p.id,
      partyName: p.name,
      partyType,
      partyCode: p.code,
      phone: p.phone,
      city: p.city,
      controlAccountCode: controlAccount[0]?.code || '',
      controlAccountName: controlAccount[0]?.name || '',
      totalDebit: agg.totalDebit,
      totalCredit: agg.totalCredit,
      currentBalance: Math.abs(net),
      balanceDirection: direction,
      lastActivityDate: agg.lastActivityDate
        ? agg.lastActivityDate.toISOString()
        : null,
    }
  })
}
