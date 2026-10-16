import { db } from '#/db'
import { riders, settlements, user } from '#/db/schema'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import type { Rider, Settlement } from '#/server/operations/types'

function mapRiderRecord(r: typeof riders.$inferSelect): Rider {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    email: r.email,
    phone: r.phone,
    vehicle: r.vehicle as 'bike' | 'scooter' | 'car',
    licenseNo: r.licenseNo,
    verified: r.verified,
    available: r.available,
    status: r.status as 'offline' | 'available' | 'busy',
    lat: Number(r.lat ?? 27.7172),
    lng: Number(r.lng ?? 85.324),
    zone: r.zone,
    baseSalary: r.baseSalary,
    perDropRate: r.perDropRate,
    commissionRate: r.commissionRate,
    cashOnHand: r.cashOnHand,
    earnings: r.earnings,
    deliveries: r.deliveries,
    rating: Number(r.rating),
    createdAt: r.createdAt.toISOString(),
  }
}

function mapSettlementRecord(s: typeof settlements.$inferSelect): Settlement {
  return {
    id: s.id,
    riderId: s.riderId,
    riderName: s.riderName,
    voucherNo: s.voucherNo,
    slug: s.slug,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    deliveries: s.deliveries,
    cashCollected: s.cashCollected,
    baseSalaryAmount: s.baseSalaryAmount,
    perDropAmount: s.perDropAmount,
    commissionAmount: s.commissionAmount,
    commission: s.commission,
    grossEarnings: s.grossEarnings,
    advancesDeducted: s.advancesDeducted,
    cashShortageDeducted: s.cashShortageDeducted,
    cashHeldDeducted: s.cashHeldDeducted,
    netPayout: s.netPayout,
    payout: s.payout,
    status: s.status as 'draft' | 'approved' | 'paid',
    paymentMethod: s.paymentMethod,
    paymentReference: s.paymentReference,
    paidAt: s.paidAt ? s.paidAt.toISOString() : null,
    notes: s.notes,
    proofUrls: Array.isArray(s.proofUrls) ? (s.proofUrls as string[]) : [],
    journalEntryId: s.journalEntryId,
    createdAt: s.createdAt.toISOString(),
  }
}

export async function getAllRidersQuery(): Promise<Rider[]> {
  const rows = await db
    .select({
      rider: riders,
    })
    .from(riders)
    .leftJoin(user, eq(riders.userId, user.id))
    .where(or(isNull(riders.userId), eq(user.role, 'rider')))
    .orderBy(desc(riders.createdAt))
  return rows.map((r) => mapRiderRecord(r.rider))
}

export async function getRiderByIdQuery(id: string): Promise<Rider | null> {
  const rows = await db
    .select({
      rider: riders,
    })
    .from(riders)
    .leftJoin(user, eq(riders.userId, user.id))
    .where(
      and(eq(riders.id, id), or(isNull(riders.userId), eq(user.role, 'rider'))),
    )
    .limit(1)
  return rows[0] ? mapRiderRecord(rows[0].rider) : null
}

export async function getRiderByUserIdQuery(
  userId: string,
): Promise<Rider | null> {
  const rows = await db
    .select({
      rider: riders,
    })
    .from(riders)
    .innerJoin(user, eq(riders.userId, user.id))
    .where(and(eq(riders.userId, userId), eq(user.role, 'rider')))
    .limit(1)
  return rows[0] ? mapRiderRecord(rows[0].rider) : null
}

export async function getAllSettlementsQuery(): Promise<Settlement[]> {
  const rows = await db
    .select()
    .from(settlements)
    .orderBy(desc(settlements.createdAt))
  return rows.map(mapSettlementRecord)
}

export async function getSettlementsByRiderIdQuery(
  riderId: string,
): Promise<Settlement[]> {
  const rows = await db
    .select()
    .from(settlements)
    .where(eq(settlements.riderId, riderId))
    .orderBy(desc(settlements.createdAt))
  return rows.map(mapSettlementRecord)
}
