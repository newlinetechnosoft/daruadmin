import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { db, dbTx } from '#/db'
import {
  riders,
  riderShifts,
  riderCashHandovers,
  orderItems,
  orderStatusHistory,
} from '#/db/schema'
import { eq } from 'drizzle-orm'
import { nid } from '#/server/orders/order.transitions'
import type { Order } from '#/server/operations/types'
import {
  getRiderByUserIdQuery,
  getAllRidersQuery,
  getActiveRiderShiftQuery,
  getRiderAttendanceStatsQuery,
  getSettlementsByRiderIdQuery,
  getAllRiderShiftsQuery,
} from '#/server/riders/rider.queries'
import {
  getAllOrdersQuery,
  getOrderByIdQuery,
} from '#/server/orders/order.queries'
import { transitionOrderTx } from '#/server/orders/order.transitions'
import { postCashHandoverTx } from '#/server/finance/double-entry'
import { logAudit } from '#/server/auth/permissions'
import type { SessionUser } from '#/server/auth/permissions'
import { presignPut, getPublicUrl } from '#/lib/storage'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

async function authenticateRider(request: Request) {
  let headers = request.headers
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ') && !request.headers.get('cookie')) {
    const token = authHeader.slice(7).trim()
    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('cookie', `better-auth.session_token=${token}`)
    headers = reqHeaders
  }

  const session = await auth.api.getSession({
    headers,
  })

  if (!session?.user) {
    return { error: 'Unauthorized: Please sign in', status: 401 }
  }

  const rawUser = session.user as typeof session.user & {
    role?: string
    isActive?: boolean
    banned?: boolean
  }

  if (rawUser.isActive === false || rawUser.banned) {
    return { error: 'Forbidden: Account is suspended', status: 403 }
  }

  if (rawUser.role !== 'rider' && rawUser.role !== 'admin' && rawUser.role !== 'manager') {
    return { error: 'Forbidden: Rider access required', status: 403 }
  }

  let rider = await getRiderByUserIdQuery(rawUser.id)
  if (!rider && rawUser.email) {
    const allRiders = await getAllRidersQuery()
    rider = allRiders.find((r) => r.email.toLowerCase() === rawUser.email.toLowerCase()) ?? null
  }

  if (!rider) {
    return {
      error: 'Rider profile not found for this account. Please contact operations admin.',
      status: 404,
    }
  }

  const sessionUser: SessionUser = {
    id: rawUser.id,
    name: rawUser.name || rider.name,
    email: rawUser.email || rider.email,
    role: rawUser.role || 'rider',
    isActive: true,
    banned: false,
    phone: rawUser.phone || rider.phone,
    phoneVerified: Boolean(rawUser.phoneVerified),
  }

  return { user: sessionUser, rider }
}

export const Route = createFileRoute('/api/rider/$')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        })
      },

      GET: async ({ request, params }) => {
        const subPath = params._splat || ''
        const authResult = await authenticateRider(request)
        if ('error' in authResult) {
          return jsonResponse({ error: authResult.error }, authResult.status)
        }

        const { rider, user } = authResult

        try {
          if (subPath === 'portal' || subPath === '') {
            const orderList = await getAllOrdersQuery()
            const assignedOrders = orderList.filter(
              (o: Order) => o.riderId === rider.id,
            )
            const activeOrders = assignedOrders.filter((o: Order) =>
              [
                'assigned',
                'rider_assigned',
                'picked_up',
                'out_for_delivery',
              ].includes(o.status),
            )
            const completedOrders = assignedOrders.filter(
              (o: Order) => o.status === 'delivered',
            )

            const [activeShift, attendanceStats, riderSettlements] = await Promise.all([
              getActiveRiderShiftQuery(rider.id),
              getRiderAttendanceStatsQuery(rider.id),
              getSettlementsByRiderIdQuery(rider.id),
            ])

            return jsonResponse({
              rider,
              orders: assignedOrders,
              activeOrders,
              completedOrders,
              activeShift,
              attendanceStats,
              settlements: riderSettlements,
              stats: {
                totalAssigned: assignedOrders.length,
                activeCount: activeOrders.length,
                completedCount: completedOrders.length,
                cashOnHand: rider.cashOnHand,
                earnings: rider.earnings,
                deliveries: rider.deliveries,
                rating: rider.rating,
              },
            })
          }

          if (subPath === 'me') {
            return jsonResponse({ rider, user })
          }

          if (subPath === 'shifts') {
            const url = new URL(request.url)
            const limit = parseInt(url.searchParams.get('limit') || '50', 10)
            const shifts = await getAllRiderShiftsQuery(rider.id, limit)
            return jsonResponse({ shifts })
          }

          if (subPath === 'attendance') {
            const stats = await getRiderAttendanceStatsQuery(rider.id)
            return jsonResponse({ stats })
          }

          return jsonResponse({ error: `Not found: /api/rider/${subPath}` }, 404)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Server error'
          return jsonResponse({ error: msg }, 500)
        }
      },

      POST: async ({ request, params }) => {
        const subPath = params._splat || ''
        const authResult = await authenticateRider(request)
        if ('error' in authResult) {
          return jsonResponse({ error: authResult.error }, authResult.status)
        }

        const { rider, user } = authResult
        let body: any = {}
        try {
          body = await request.json()
        } catch {
          body = {}
        }

        try {
          // 1. UPDATE DELIVERY ORDER STATUS
          if (subPath === 'status') {
            const {
              orderId,
              status,
              deliveryFailureReason,
              ageVerifiedAtDelivery,
              deliveryOtp,
              proofPhotoUrl,
              notes,
            } = body

            if (!orderId || !status) {
              return jsonResponse({ error: 'Missing orderId or status' }, 400)
            }

            const validStatuses = ['picked_up', 'out_for_delivery', 'delivered', 'delivery_failed']
            if (!validStatuses.includes(status)) {
              return jsonResponse(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                400,
              )
            }

            const order = await getOrderByIdQuery(orderId)
            if (!order) return jsonResponse({ error: 'Order not found' }, 404)

            if (order.riderId !== rider.id && user.role !== 'admin' && user.role !== 'manager') {
              return jsonResponse({ error: 'Forbidden: You are not assigned to this delivery' }, 403)
            }

            await dbTx.transaction(async (tx) => {
              await transitionOrderTx(tx, {
                orderId,
                toStatus: status,
                user: {
                  id: user.id,
                  name: rider.name,
                  role: 'rider',
                },
                options: {
                  note: notes,
                  deliveryFailureReason,
                  ageVerifiedAtDelivery: Boolean(ageVerifiedAtDelivery),
                  deliveryOtp,
                  proofPhotoUrl,
                },
              })
            })

            return jsonResponse({ success: true, orderId, status })
          }

          // 2. TOGGLE AVAILABILITY (ONLINE / OFFLINE)
          if (subPath === 'availability') {
            const available = Boolean(body.available)
            const now = new Date()

            await db
              .update(riders)
              .set({
                available,
                status: available ? 'available' : 'offline',
                updatedAt: now,
              })
              .where(eq(riders.id, rider.id))

            if (available) {
              const activeShift = await getActiveRiderShiftQuery(rider.id)
              if (!activeShift) {
                await db.insert(riderShifts).values({
                  id: nid('shf'),
                  riderId: rider.id,
                  status: 'active',
                  startedAt: now,
                  durationMinutes: 0,
                })
              }
            } else {
              const activeShift = await getActiveRiderShiftQuery(rider.id)
              if (activeShift) {
                const start = new Date(activeShift.startedAt)
                const durationMinutes = Math.max(
                  0,
                  Math.round((now.getTime() - start.getTime()) / (1000 * 60)),
                )
                await db
                  .update(riderShifts)
                  .set({
                    status: 'completed',
                    endedAt: now,
                    durationMinutes,
                    updatedAt: now,
                  })
                  .where(eq(riderShifts.id, activeShift.id))
              }
            }

            return jsonResponse({
              success: true,
              available,
              status: available ? 'available' : 'offline',
            })
          }

          // 3. LIVE GPS TELEMETRY & STATUS UPDATE
          if (subPath === 'live') {
            const updates: Record<string, any> = { updatedAt: new Date() }
            if (body.lat !== undefined) updates.lat = String(body.lat)
            if (body.lng !== undefined) updates.lng = String(body.lng)
            if (body.status !== undefined) {
              if (['offline', 'available', 'busy'].includes(body.status)) {
                updates.status = body.status
              }
            }

            await db.update(riders).set(updates).where(eq(riders.id, rider.id))
            return jsonResponse({ success: true, riderId: rider.id, updates })
          }

          // 4. CASH DEPOSIT / HANDOVER
          if (subPath === 'cash-deposit') {
            const amount = typeof body.amount === 'number' ? Math.round(body.amount) : 0
            if (amount <= 0) {
              return jsonResponse({ error: 'Deposit amount must be greater than 0' }, 400)
            }
            if (rider.cashOnHand < amount) {
              return jsonResponse(
                { error: `Deposit amount exceeds cash on hand (Rs. ${(rider.cashOnHand / 100).toFixed(2)})` },
                400,
              )
            }

            const now = new Date()
            const handoverId = nid('rch')

            await dbTx.transaction(async (tx) => {
              await tx
                .update(riders)
                .set({
                  cashOnHand: rider.cashOnHand - amount,
                  updatedAt: now,
                })
                .where(eq(riders.id, rider.id))

              await tx.insert(riderCashHandovers).values({
                id: handoverId,
                riderId: rider.id,
                amount,
                status: 'verified',
                notes: body.note || 'Cash deposit from mobile rider app',
              })

              await postCashHandoverTx(tx, {
                handoverId,
                riderId: rider.id,
                riderName: rider.name,
                amount,
                actor: user,
              })
            })

            await logAudit(
              rider.name,
              'finance',
              'create',
              `Rider ${rider.name} submitted cash handover Rs. ${(amount / 100).toFixed(2)} via mobile API`,
            )

            return jsonResponse({
              success: true,
              handoverId,
              depositedAmount: amount,
              remainingCashOnHand: rider.cashOnHand - amount,
            })
          }

          // 5. RECORD DEALER PICKUP BILL
          if (subPath === 'pickup-bill') {
            const { orderId, orderItemId, actualDealerCostPrice, dealerBillPhotoUrl } = body
            if (!orderId || !orderItemId) {
              return jsonResponse({ error: 'Missing orderId or orderItemId' }, 400)
            }

            const order = await getOrderByIdQuery(orderId)
            if (!order) return jsonResponse({ error: 'Order not found' }, 404)

            if (order.riderId !== rider.id && user.role !== 'admin' && user.role !== 'manager') {
              return jsonResponse({ error: 'Forbidden: You are not assigned to this delivery' }, 403)
            }

            const item = order.items.find((it: any) => it.id === orderItemId)
            if (!item) return jsonResponse({ error: 'Order item not found' }, 404)

            await dbTx.transaction(async (tx) => {
              await tx
                .update(orderItems)
                .set({
                  sourcingStatus: 'picked_up',
                  actualDealerCostPrice: actualDealerCostPrice ?? item.dealerCostPrice ?? null,
                  dealerBillPhotoUrl: dealerBillPhotoUrl || null,
                })
                .where(eq(orderItems.id, orderItemId))

              await tx.insert(orderStatusHistory).values({
                id: nid('ev'),
                orderId,
                fromStatus: order.status,
                toStatus: order.status,
                status: order.status,
                note: `Item "${item.name}" picked up from dealer. Bill recorded via mobile API.`,
                actor: rider.name,
                actorId: user.id,
                actorRole: 'rider',
              })
            })

            return jsonResponse({ success: true, orderId, orderItemId })
          }

          // 6. PRESIGNED UPLOAD FOR DELIVERY PROOF & BILL PHOTOS
          if (subPath === 'upload-proof') {
            const filename = body.filename || 'proof.jpg'
            const contentType = body.contentType || 'image/jpeg'
            const ext = filename.split('.').pop() || 'jpg'
            const key = `delivery-proof/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const uploadUrl = await presignPut(key, contentType)
            const publicUrl = getPublicUrl(key)

            return jsonResponse({ uploadUrl, publicUrl, key })
          }

          return jsonResponse({ error: `Not found: /api/rider/${subPath}` }, 404)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Server error'
          return jsonResponse({ error: msg }, 500)
        }
      },
    },
  },
})
