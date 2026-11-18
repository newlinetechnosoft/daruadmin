import 'dotenv/config'
import { dbTx } from './index'
import { sql, count } from 'drizzle-orm'
import {
  // Master / Catalog tables (PRESERVED)
  user,
  dealers,
  liquorProducts,
  foodProducts,
  ledgerAccounts,
  riders,
  coupons,

  // Transaction tables (PURGED)
  journalLines,
  voucherAttachments,
  periodClosingVouchers,
  bankTransactions,
  expenses,
  dealerSettlements,
  legacyLedgerArchive,
  ledgerEntries,
  journalEntries,
  voucherSequences,
  payments,
  orderStatusHistory,
  orderItems,
  orders,
  settlements,
  riderCashHandovers,
  riderShifts,
  stockMovements,
  complaints,
  couponRedemptions,
  recycleBin,
  notifications,
  auditLogs,
} from './schema'

async function resetTransactions() {
  console.log('='.repeat(70))
  console.log('     RESET ACCOUNTING & PURGE TRANSACTIONS (PRESERVING MASTERS)    ')
  console.log('='.repeat(70))

  // 1. Audit Master Data to ensure we PRESERVE them
  const [
    userCountRes,
    dealerCountRes,
    liquorCountRes,
    foodCountRes,
    ledgerAccCountRes,
    riderCountRes,
  ] = await Promise.all([
    dbTx.select({ c: count() }).from(user),
    dbTx.select({ c: count() }).from(dealers),
    dbTx.select({ c: count() }).from(liquorProducts),
    dbTx.select({ c: count() }).from(foodProducts),
    dbTx.select({ c: count() }).from(ledgerAccounts),
    dbTx.select({ c: count() }).from(riders),
  ])

  console.log('\n[PRESERVED MASTER DATA AUDIT (BEFORE RESET)]')
  console.log(`- Users:            ${userCountRes[0]?.c ?? 0} (PRESERVED)`)
  console.log(`- Dealers:          ${dealerCountRes[0]?.c ?? 0} (PRESERVED)`)
  console.log(`- Liquor Products:  ${liquorCountRes[0]?.c ?? 0} (PRESERVED)`)
  console.log(`- Food Products:    ${foodCountRes[0]?.c ?? 0} (PRESERVED)`)
  console.log(`- Chart of Accounts:${ledgerAccCountRes[0]?.c ?? 0} (PRESERVED)`)
  console.log(`- Riders:           ${riderCountRes[0]?.c ?? 0} (PRESERVED)`)

  // 2. Audit Existing Transaction Data
  const [
    jeCountRes,
    jlCountRes,
    orderCountRes,
    settlementCountRes,
    shiftCountRes,
  ] = await Promise.all([
    dbTx.select({ c: count() }).from(journalEntries),
    dbTx.select({ c: count() }).from(journalLines),
    dbTx.select({ c: count() }).from(orders),
    dbTx.select({ c: count() }).from(settlements),
    dbTx.select({ c: count() }).from(riderShifts),
  ])

  console.log('\n[TRANSACTION DATA TO BE PURGED]')
  console.log(`- Journal Entries:  ${jeCountRes[0]?.c ?? 0} rows`)
  console.log(`- Journal Lines:    ${jlCountRes[0]?.c ?? 0} rows`)
  console.log(`- Orders:           ${orderCountRes[0]?.c ?? 0} rows`)
  console.log(`- Settlements:      ${settlementCountRes[0]?.c ?? 0} rows`)
  console.log(`- Rider Shifts:     ${shiftCountRes[0]?.c ?? 0} rows`)

  // 3. Temporarily disable DB immutability triggers for administrative reset
  console.log('\n[DISABLING DB IMMUTABILITY TRIGGERS FOR RESET...]')
  await dbTx.execute(sql`ALTER TABLE journal_lines DISABLE TRIGGER prevent_journal_lines_mutation_trigger;`)
  await dbTx.execute(sql`ALTER TABLE journal_lines DISABLE TRIGGER check_journal_entry_balanced_trigger;`)
  await dbTx.execute(sql`ALTER TABLE journal_entries DISABLE TRIGGER prevent_journal_entries_mutation_trigger;`)
  await dbTx.execute(sql`ALTER TABLE journal_entries DISABLE TRIGGER check_journal_entry_header_balanced_trigger;`)
  console.log('✔ Accounting triggers temporarily disabled.')

  // 4. Execute Deletion & Reset in a Single Transaction
  try {
    console.log('\n[EXECUTING TRANSACTION PURGE & ACCOUNTING RESET...]')
    await dbTx.transaction(async (tx) => {
      // A. Delete dependent lines & attachments first
      await tx.delete(periodClosingVouchers)
      await tx.delete(bankTransactions)
      await tx.delete(voucherAttachments)
      await tx.delete(journalLines)
      await tx.delete(expenses)
      await tx.delete(dealerSettlements)
      await tx.delete(legacyLedgerArchive)
      await tx.delete(ledgerEntries)

      // B. Delete Journal Entry headers
      await tx.delete(journalEntries)

      // C. Delete Order transactions and payments
      await tx.delete(payments)
      await tx.delete(orderStatusHistory)
      await tx.delete(orderItems)
      await tx.delete(orders)

      // D. Delete Rider operational transactions
      await tx.delete(settlements)
      await tx.delete(riderCashHandovers)
      await tx.delete(riderShifts)

      // E. Delete other transactional logs
      await tx.delete(stockMovements)
      await tx.delete(complaints)
      await tx.delete(couponRedemptions)
      await tx.delete(recycleBin)
      await tx.delete(notifications)

      // F. Clear old transactional audit logs
      await tx.delete(auditLogs)

      // G. Reset Counters & Balances
      // 1. Reset voucher sequences so next vouchers start from 00001
      await tx.update(voucherSequences).set({
        lastNo: 0,
        updatedAt: new Date(),
      })

      // 2. Reset rider operational counters
      await tx.update(riders).set({
        cashOnHand: 0,
        earnings: 0,
        deliveries: 0,
        updatedAt: new Date(),
      })

      // 3. Reset bank account current balances to opening balance
      await tx.execute(sql`
        UPDATE bank_accounts
        SET current_balance = opening_balance,
            updated_at = NOW()
      `)

      // 4. Reset accounting periods to open
      await tx.execute(sql`
        UPDATE accounting_periods
        SET status = 'open',
            closed_at = NULL,
            closed_by = NULL
      `)

      // 5. Ensure fiscal years are open
      await tx.execute(sql`
        UPDATE fiscal_years
        SET is_closed = false
      `)

      // 6. Reset coupons used count
      await tx.update(coupons).set({
        used: 0,
      })

      // 7. Insert audit record for the clean reset
      await tx.insert(auditLogs).values({
        id: `aud_${Date.now().toString(36)}`,
        actor: 'System Admin',
        module: 'finance',
        action: 'reset_accounting_transactions',
        detail:
          'All bulk transaction and accounting records reset to beginning state. Preserved all items, users, and dealers.',
        createdAt: new Date(),
      })

      console.log('✔ All transaction tables purged successfully.')
      console.log('✔ Voucher sequences reset to 0 (vouchers will start from 00001).')
      console.log('✔ Rider balances & metrics reset to 0.')
      console.log('✔ Bank accounts & accounting periods reset.')
    })
  } finally {
    // 5. Always re-enable all 4 triggers so system integrity remains 100% active
    console.log('\n[RE-ENABLING DB IMMUTABILITY & BALANCING TRIGGERS...]')
    await dbTx.execute(sql`ALTER TABLE journal_lines ENABLE TRIGGER prevent_journal_lines_mutation_trigger;`)
    await dbTx.execute(sql`ALTER TABLE journal_lines ENABLE TRIGGER check_journal_entry_balanced_trigger;`)
    await dbTx.execute(sql`ALTER TABLE journal_entries ENABLE TRIGGER prevent_journal_entries_mutation_trigger;`)
    await dbTx.execute(sql`ALTER TABLE journal_entries ENABLE TRIGGER check_journal_entry_header_balanced_trigger;`)
    console.log('✔ All accounting integrity triggers re-enabled and active.')
  }

  // 6. Verification Check
  const [
    postUsers,
    postDealers,
    postLiquor,
    postFood,
    postLedgerAccounts,
    postJe,
    postJl,
    postOrders,
    postSettlements,
    postShifts,
    postRiders,
    postVoucherSeq,
  ] = await Promise.all([
    dbTx.select({ c: count() }).from(user),
    dbTx.select({ c: count() }).from(dealers),
    dbTx.select({ c: count() }).from(liquorProducts),
    dbTx.select({ c: count() }).from(foodProducts),
    dbTx.select({ c: count() }).from(ledgerAccounts),
    dbTx.select({ c: count() }).from(journalEntries),
    dbTx.select({ c: count() }).from(journalLines),
    dbTx.select({ c: count() }).from(orders),
    dbTx.select({ c: count() }).from(settlements),
    dbTx.select({ c: count() }).from(riderShifts),
    dbTx.select().from(riders),
    dbTx.select().from(voucherSequences),
  ])

  console.log('\n' + '='.repeat(70))
  console.log('                 VERIFICATION AFTER RESET                 ')
  console.log('='.repeat(70))
  console.log(`- Users:            ${postUsers[0]?.c} (INTACT - UNTOUCHED)`)
  console.log(`- Dealers:          ${postDealers[0]?.c} (INTACT - UNTOUCHED)`)
  console.log(`- Liquor Products:  ${postLiquor[0]?.c} (INTACT - UNTOUCHED)`)
  console.log(`- Food Products:    ${postFood[0]?.c} (INTACT - UNTOUCHED)`)
  console.log(`- Chart of Accounts:${postLedgerAccounts[0]?.c} (INTACT - UNTOUCHED)`)
  console.log(`- Journal Entries:  ${postJe[0]?.c} (CLEARED TO 0)`)
  console.log(`- Journal Lines:    ${postJl[0]?.c} (CLEARED TO 0)`)
  console.log(`- Orders:           ${postOrders[0]?.c} (CLEARED TO 0)`)
  console.log(`- Settlements:      ${postSettlements[0]?.c} (CLEARED TO 0)`)
  console.log(`- Rider Shifts:     ${postShifts[0]?.c} (CLEARED TO 0)`)

  const ridersWithBalances = postRiders.filter(
    (r) => r.cashOnHand !== 0 || r.earnings !== 0 || r.deliveries !== 0,
  )
  console.log(
    `- Riders with non-zero metrics: ${ridersWithBalances.length} (ALL RESET TO 0)`,
  )

  const activeVoucherSeq = postVoucherSeq.filter((v) => v.lastNo !== 0)
  console.log(
    `- Voucher sequences non-zero: ${activeVoucherSeq.length} (ALL RESET TO 0)`,
  )

  console.log('='.repeat(70))
  console.log('ACCOUNTING AND TRANSACTIONS SUCCESSFULLY RESET TO BEGINNING.')
  console.log('='.repeat(70))
}

resetTransactions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Reset failed:', err)
    process.exit(1)
  })
