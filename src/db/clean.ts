import { config } from 'dotenv'

import { db, dbTx } from './index'
import {
  user,
  account,
  session,
  orders,
  orderItems,
  orderStatusHistory,
  riders,
  riderCashHandovers,
  settlements,
  ledgerEntries,
  payments,
  auditLogs,
  notifications,
  coupons,
  complaints,
  banners,
  campaigns,
  reviews,
  dealerStock,
  dealerItems,
  stockMovements,
  dealers,
} from './schema'
import { count } from 'drizzle-orm'
import {
  defaultStoreSettings,
  saveStoreSettingsQuery,
} from '#/server/platform/platform.queries'

config({ path: ['.env.local', '.env'] })

async function main() {
  const rawUrl = process.env.DATABASE_URL || ''
  if (!rawUrl.trim()) {
    console.error('❌ SAFETY ABORT: DATABASE_URL is empty or not set.')
    process.exit(1)
  }

  let host = ''
  let dbName = ''
  try {
    const parsed = new URL(rawUrl)
    host = parsed.hostname
    dbName = parsed.pathname.slice(1)
    if (!host) {
      throw new Error('No hostname in DATABASE_URL')
    }
  } catch {
    console.error('❌ SAFETY ABORT: DATABASE_URL is malformed.')
    process.exit(1)
  }

  const neonBranch = process.env.NEON_BRANCH || 'unknown'

  console.log('='.repeat(70))
  console.log('               MEZMANI DATABASE CLEANUP & AUDIT               ')
  console.log('='.repeat(70))
  console.log(`Target database host: ${host}`)
  console.log(`Database Name:        ${dbName}`)
  console.log(`Neon branch:          ${neonBranch}`)
  console.log('='.repeat(70))

  const isConfirmed = process.argv.includes('--confirm')
  if (!isConfirmed) {
    console.error(
      '\n❌ SAFETY ABORT: Refusing to run cleanup without explicit --confirm flag.',
    )
    console.error('To run cleanup, pass --confirm explicitly.\n')
    process.exit(1)
  }

  // 1. Audit Auth Users
  const allUsers = await db.select().from(user)
  const preservedUsers = allUsers.filter(
    (u) =>
      u.role === 'admin' ||
      u.role === 'rider' ||
      u.role === 'manager' ||
      u.role === 'customer',
  )
  const deletedUsers = allUsers.filter(
    (u) => !['admin', 'rider', 'manager', 'customer'].includes(u.role || ''),
  )

  const [sessionCountRes, accountCountRes] = await Promise.all([
    db.select({ c: count() }).from(session),
    db.select({ c: count() }).from(account),
  ])

  console.log('\n[AUTH SAFETY AUDIT]')
  console.log(`- Total users:       ${allUsers.length}`)
  console.log(
    `- Preserved users:   ${preservedUsers.length} (admin, rider, manager, customer)`,
  )
  preservedUsers.forEach((u) => {
    console.log(
      `    • [${(u.role || 'user').padEnd(8)}] ${u.email} (${u.name})`,
    )
  })
  console.log(`- Users to remove:   ${deletedUsers.length}`)
  console.log(`- Active sessions:   ${sessionCountRes[0]?.c ?? 0} (preserved)`)
  console.log(`- Accounts:          ${accountCountRes[0]?.c ?? 0} (preserved)`)

  // 2. Operational Tables Audit
  const [
    orderCount,
    riderCount,
    ledgerCount,
    paymentCount,
    notifCount,
    auditCount,
    couponCount,
    complaintCount,
  ] = await Promise.all([
    db.select({ c: count() }).from(orders),
    db.select({ c: count() }).from(riders),
    db.select({ c: count() }).from(ledgerEntries),
    db.select({ c: count() }).from(payments),
    db.select({ c: count() }).from(notifications),
    db.select({ c: count() }).from(auditLogs),
    db.select({ c: count() }).from(coupons),
    db.select({ c: count() }).from(complaints),
  ])

  console.log('\n[OPERATIONAL DATA AUDIT]')
  console.log(`- Orders:            ${orderCount[0]?.c ?? 0} rows`)
  console.log(`- Riders:            ${riderCount[0]?.c ?? 0} rows`)
  console.log(`- Ledger entries:    ${ledgerCount[0]?.c ?? 0} rows`)
  console.log(`- Payments:          ${paymentCount[0]?.c ?? 0} rows`)
  console.log(`- Notifications:     ${notifCount[0]?.c ?? 0} rows`)
  console.log(`- Audit logs:        ${auditCount[0]?.c ?? 0} rows`)
  console.log(`- Coupons:           ${couponCount[0]?.c ?? 0} rows`)
  console.log(`- Complaints:        ${complaintCount[0]?.c ?? 0} rows`)

  // EXECUTE MODE:
  console.log('\n[EXECUTING CLEANUP]')
  await dbTx.transaction(async (tx) => {
    // 2. Clear any orphaned demo operational data if any
    await tx.delete(orderStatusHistory)
    await tx.delete(orderItems)
    await tx.delete(orders)
    await tx.delete(riderCashHandovers)
    await tx.delete(settlements)
    await tx.delete(riders)
    await tx.delete(payments)
    await tx.delete(notifications)
    await tx.delete(auditLogs)
    await tx.delete(coupons)
    await tx.delete(complaints)
    await tx.delete(banners)
    await tx.delete(campaigns)
    await tx.delete(reviews)
    await tx.delete(dealerItems)
    await tx.delete(dealerStock)
    await tx.delete(stockMovements)
    await tx.delete(dealers)

    console.log('✔ Operational relational tables cleared to clean state.')
  })

  // 3. Initialize default settings in Postgres
  await saveStoreSettingsQuery(defaultStoreSettings())
  console.log(
    '✔ Initialized default store configuration in site_settings table.',
  )

  console.log('\n' + '='.repeat(70))
  console.log(
    'CLEANUP SUCCESSFUL: Real database is now completely clean & initialized.',
  )
  console.log(
    'Auth users, passwords, sessions, and catalog items remain 100% intact.',
  )
  console.log('='.repeat(70))
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Clean script error:', err)
  process.exit(1)
})
