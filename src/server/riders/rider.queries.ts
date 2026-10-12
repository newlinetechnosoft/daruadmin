import { db } from '#/db'
import { riders, settlements } from '#/db/schema'
import { desc, eq } from 'drizzle-orm'
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
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    deliveries: s.deliveries,
    cashCollected: s.cashCollected,
    commission: s.commission,
    payout: s.payout,
    status: s.status as 'draft' | 'approved' | 'paid',
    createdAt: s.createdAt.toISOString(),
  }
}

export async function getAllRidersQuery(): Promise<Rider[]> {
  const rows = await db.select().from(riders).orderBy(desc(riders.createdAt))
  return rows.map(mapRiderRecord)
}

export async function getRiderByIdQuery(id: string): Promise<Rider | null> {
  const rows = await db.select().from(riders).where(eq(riders.id, id)).limit(1)
  return rows[0] ? mapRiderRecord(rows[0]) : null
}

export async function getRiderByUserIdQuery(
  userId: string,
): Promise<Rider | null> {
  const rows = await db
    .select()
    .from(riders)
    .where(eq(riders.userId, userId))
    .limit(1)
  return rows[0] ? mapRiderRecord(rows[0]) : null
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
