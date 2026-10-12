import { db } from '#/db'
import { ledgerEntries, payments } from '#/db/schema'
import { desc, eq } from 'drizzle-orm'
import type { LedgerEntry, PaymentTxn } from '#/server/operations/types'

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

export async function getAllLedgerEntriesQuery(): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.createdAt))
  return rows.map(mapLedgerRecord)
}

export async function getAllPaymentsQuery(): Promise<PaymentTxn[]> {
  const rows = await db
    .select()
    .from(payments)
    .orderBy(desc(payments.createdAt))
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
