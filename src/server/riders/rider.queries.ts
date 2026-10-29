import { moveToRecycleBin } from '#/server/recycle-bin/recycle-bin.queries'
import { db } from '#/db'
import { orders, riders, riderShifts, settlements, user } from '#/db/schema'
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm'
import type { Rider, RiderShift, Settlement } from '#/server/operations/types'

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
    lat: Number(r.lat ?? 27.7006),
    lng: Number(r.lng ?? 83.4484),
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

function mapShiftRecord(
  s: typeof riderShifts.$inferSelect,
  riderName?: string,
): RiderShift {
  return {
    id: s.id,
    riderId: s.riderId,
    riderName: riderName,
    status: s.status as 'active' | 'completed',
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    durationMinutes: s.durationMinutes,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export async function getAllRiderShiftsQuery(
  riderId?: string,
  limit = 100,
): Promise<RiderShift[]> {
  if (riderId) {
    const rows = await db
      .select({
        shift: riderShifts,
        riderName: riders.name,
      })
      .from(riderShifts)
      .leftJoin(riders, eq(riderShifts.riderId, riders.id))
      .where(eq(riderShifts.riderId, riderId))
      .orderBy(desc(riderShifts.startedAt))
      .limit(limit)
    return rows.map((r) => mapShiftRecord(r.shift, r.riderName || undefined))
  }

  const rows = await db
    .select({
      shift: riderShifts,
      riderName: riders.name,
    })
    .from(riderShifts)
    .leftJoin(riders, eq(riderShifts.riderId, riders.id))
    .orderBy(desc(riderShifts.startedAt))
    .limit(limit)
  return rows.map((r) => mapShiftRecord(r.shift, r.riderName || undefined))
}

export async function getActiveRiderShiftQuery(
  riderId: string,
): Promise<RiderShift | null> {
  const rows = await db
    .select()
    .from(riderShifts)
    .where(
      and(eq(riderShifts.riderId, riderId), eq(riderShifts.status, 'active')),
    )
    .orderBy(desc(riderShifts.startedAt))
    .limit(1)

  return rows[0] ? mapShiftRecord(rows[0]) : null
}

export async function getRiderAttendanceStatsQuery(
  riderId: string,
  startDate?: Date,
  endDate?: Date,
) {
  const conditions = [eq(riderShifts.riderId, riderId)]
  if (startDate) {
    conditions.push(gte(riderShifts.startedAt, startDate))
  }
  if (endDate) {
    conditions.push(lte(riderShifts.startedAt, endDate))
  }

  const shifts = await db
    .select()
    .from(riderShifts)
    .where(and(...conditions))

  const totalShifts = shifts.length
  const totalMinutes = shifts.reduce((acc, s) => acc + s.durationMinutes, 0)
  const activeShift = shifts.find((s) => s.status === 'active')

  return {
    totalShifts,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    hasActiveShift: Boolean(activeShift),
    activeShiftSince: activeShift ? activeShift.startedAt.toISOString() : null,
  }
}

export async function deleteRiderQuery(
  id: string,
): Promise<{ success: boolean; id: string }> {
  const existing = await db
    .select()
    .from(riders)
    .where(eq(riders.id, id))
    .limit(1)

  if (!existing[0]) {
    throw new Error('Rider not found')
  }

  const rider = existing[0]

  if (rider.cashOnHand > 0) {
    throw new Error(
      `Cannot delete courier with outstanding cash on hand (Rs. ${(rider.cashOnHand / 100).toFixed(2)}). Please settle COD cash remittance before deleting.`,
    )
  }

  const activeOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.riderId, id),
        or(
          eq(orders.status, 'rider_assigned'),
          eq(orders.status, 'picked_up'),
          eq(orders.status, 'out_for_delivery'),
        ),
      ),
    )

  if (activeOrders.length > 0) {
    throw new Error(
      `Cannot delete courier with ${activeOrders.length} active delivery in progress. Reassign or complete deliveries before deleting.`,
    )
  }

  // Detach riderId from historical orders so order records remain intact
  await db
    .update(orders)
    .set({ riderId: null })
    .where(eq(orders.riderId, id))

  // If rider had a linked user account, revoke rider role
  if (rider.userId) {
    await db
      .update(user)
      .set({ role: 'customer' })
      .where(eq(user.id, rider.userId))
  }

  // Move to recycle bin before deleting
  await moveToRecycleBin({
    entityType: 'rider',
    entityId: rider.id,
    name: rider.name,
    description: `${rider.phone} • ${rider.zone}`,
    data: { rider },
  })

  // Delete the rider record (cascades shifts, cash handovers, settlements)
  await db.delete(riders).where(eq(riders.id, id))

  return { success: true, id }
}
