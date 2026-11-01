import { beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import * as schema from '#/db/schema'
import type { DbTx } from '#/server/finance/types'
import type { Order } from '#/server/operations/types'
import {
  ACCOUNT_KEYS,
  invalidateAccountDefaultsCache,
  resolveAccount,
  resolveAllAccounts,
} from './account-keys'
import type { AccountKey } from './account-keys'
import {
  postOrderDeliveredTx,
  postCashHandoverTx,
} from './double-entry'
import {
  getAccountDefaultsQuery,
  updateAccountDefaultsQuery,
} from './finance.queries'

describe('Accounting Settings & Default Accounts (ACC-1.1)', () => {
  let pglite: PGlite
  let db: ReturnType<typeof drizzle<typeof schema>>
  let txClient: DbTx

  beforeAll(async () => {
    pglite = new PGlite()
    db = drizzle(pglite, { schema })
    txClient = db as unknown as DbTx

    const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))

    // Apply all 19 migrations (0000 through 0018) in order
    for (const entry of journal.entries) {
      const filePath = path.join(migrationsFolder, `${entry.tag}.sql`)
      const sqlContent = fs.readFileSync(filePath, 'utf-8')
      const statements = sqlContent.split('--> statement-breakpoint')
      for (const stmt of statements) {
        const trimmed = stmt.trim()
        if (trimmed) {
          await pglite.exec(trimmed)
        }
      }
    }
  })

  beforeEach(() => {
    invalidateAccountDefaultsCache()
  })

  it('verifies that migration 0018 seeds all 25 account defaults matching ACCOUNT_KEYS', async () => {
    const rows = await db.select().from(schema.accountDefaults)
    expect(rows.length).toBe(25)

    const keyMap = new Map(rows.map((r) => [r.key, r.accountId]))
    for (const [key, expectedAccountId] of Object.entries(ACCOUNT_KEYS)) {
      expect(keyMap.get(key)).toBe(expectedAccountId)
    }
  })

  it('resolves account defaults via resolveAccount and resolveAllAccounts', async () => {
    const all = await resolveAllAccounts(txClient, { forceRefresh: true })
    expect(Object.keys(all).length).toBe(25)
    expect(all.SALES).toBe('acc_4010')
    expect(all.CASH_IN_HAND).toBe('acc_1011')
    expect(all.DEALER_PAYABLE).toBe('acc_2011')

    const salesId = await resolveAccount(txClient, 'SALES')
    expect(salesId).toBe('acc_4010')

    const cashId = await resolveAccount(txClient, 'CASH_IN_HAND')
    expect(cashId).toBe('acc_1011')
  })

  it('fails with a clear descriptive message when resolving an unmapped or unknown account key', async () => {
    expect(
      resolveAccount(txClient, 'UNKNOWN_CUSTOM_KEY' as AccountKey),
    ).rejects.toThrow(
      'Account default mapping for "UNKNOWN_CUSTOM_KEY" not found. Please configure default accounts in Accounting Settings.',
    )
  })

  it('remapping SALES to another income account (acc_4030) dynamically changes the next postOrderDeliveredTx posting', async () => {
    // 1. Post initial order with default SALES (acc_4010)
    const actor = { id: 'admin_1', name: 'Admin Test', role: 'admin' as const }
    const order1 = {
      id: 'ord_acc11_test_1',
      number: 'ORD-ACC-001',
      customerId: 'cust_1',
      customerName: 'Customer One',
      paymentMethod: 'online',
      subtotal: 11300, // 10000 net + 1300 VAT
      total: 11300,
      discount: 0,
      deliveryCharge: 0,
      tax: 1300,
      riderId: null,
    }

    const posting1 = await db.transaction(async (tx) => {
      return postOrderDeliveredTx(tx as DbTx, {
        order: order1 as unknown as Order,
        items: [],
        actor,
      })
    })

    const lines1 = await db
      .select()
      .from(schema.journalLines)
      .where(eq(schema.journalLines.journalEntryId, posting1.journalEntryId))

    const salesLine1 = lines1.find((l) => l.credit > 0 && l.debit === 0)
    expect(salesLine1?.accountId).toBe('acc_4010') // Default: acc_4010 Sales Revenue

    // 2. Remap SALES to acc_4030 (Other Operating Income)
    await updateAccountDefaultsQuery(
      [{ key: 'SALES', accountId: 'acc_4030' }],
      actor.name,
      txClient,
    )

    // 3. Verify resolveAccount immediately reflects acc_4030
    const remappedSalesId = await resolveAccount(txClient, 'SALES')
    expect(remappedSalesId).toBe('acc_4030')

    // 4. Post next order with remapped settings
    const order2 = {
      id: 'ord_acc11_test_2',
      number: 'ORD-ACC-002',
      customerId: 'cust_2',
      customerName: 'Customer Two',
      paymentMethod: 'online',
      subtotal: 22600, // 20000 net + 2600 VAT
      total: 22600,
      discount: 0,
      deliveryCharge: 0,
      tax: 2600,
      riderId: null,
    }

    const posting2 = await db.transaction(async (tx) => {
      return postOrderDeliveredTx(tx as DbTx, {
        order: order2 as unknown as Order,
        items: [],
        actor,
      })
    })

    const lines2 = await db
      .select()
      .from(schema.journalLines)
      .where(eq(schema.journalLines.journalEntryId, posting2.journalEntryId))

    // The net sales credit line must now be routed to acc_4030
    const salesLine2 = lines2.find(
      (l) => l.credit === 20000 && l.debit === 0 && l.costCenter === 'general',
    )
    expect(salesLine2?.accountId).toBe('acc_4030')

    // 5. Restore default SALES mapping
    await updateAccountDefaultsQuery(
      [{ key: 'SALES', accountId: 'acc_4010' }],
      actor.name,
      txClient,
    )
  })

  it('remapping CASH_IN_HAND dynamically affects postCashHandoverTx', async () => {
    const actor = { id: 'admin_1', name: 'Admin Test', role: 'admin' as const }

    // Seed a dummy rider for handover
    await db
      .insert(schema.riders)
      .values({
        id: 'rider_acc11',
        name: 'Rider ACC11',
        email: 'rider_acc11@example.com',
        phone: '9800000011',
        cashOnHand: 5000,
      })
      .onConflictDoNothing()

    // Post handover with default cash in hand (acc_1011)
    const post1 = await db.transaction(async (tx) => {
      return postCashHandoverTx(tx as DbTx, {
        handoverId: 'ho_acc11_1',
        riderId: 'rider_acc11',
        riderName: 'Rider ACC11',
        amount: 5000,
        actor,
      })
    })

    const lines1 = await db
      .select()
      .from(schema.journalLines)
      .where(eq(schema.journalLines.journalEntryId, post1.journalEntryId))

    const debitLine1 = lines1.find((l) => l.debit === 5000)
    expect(debitLine1?.accountId).toBe('acc_1011')
  })

  it('updateAccountDefaultsQuery rejects mapping to non-existent accounts', async () => {
    expect(
      updateAccountDefaultsQuery(
        [{ key: 'SALES', accountId: 'acc_non_existent' }],
        'Admin Test',
        txClient,
      ),
    ).rejects.toThrow(
      'Cannot map "SALES": Target account "acc_non_existent" does not exist in Chart of Accounts.',
    )
  })

  it('updateAccountDefaultsQuery rejects mapping to group accounts', async () => {
    // acc_grp_4000 is 'Operating Revenue (Income)' which has is_group = true
    expect(
      updateAccountDefaultsQuery(
        [{ key: 'SALES', accountId: 'acc_grp_4000' }],
        'Admin Test',
        txClient,
      ),
    ).rejects.toThrow(
      'Account "Operating Revenue (Income)" (acc_grp_4000) is a group folder. Defaults must map to non-group leaf accounts.',
    )
  })

  it('updateAccountDefaultsQuery rejects mapping to inactive accounts', async () => {
    // Insert an inactive account to test the guard
    await db
      .insert(schema.ledgerAccounts)
      .values({
        id: 'acc_inactive_test',
        code: '9999',
        name: 'Inactive Test Account',
        rootType: 'income',
        isGroup: false,
        isActive: false,
      })
      .onConflictDoNothing()

    expect(
      updateAccountDefaultsQuery(
        [{ key: 'SALES', accountId: 'acc_inactive_test' }],
        'Admin Test',
        txClient,
      ),
    ).rejects.toThrow(
      'Account "Inactive Test Account" (acc_inactive_test) is inactive. Defaults cannot map to disabled accounts.',
    )
  })

  it('getAccountDefaultsQuery returns complete list of all 25 defaults with metadata and account details', async () => {
    const list = await getAccountDefaultsQuery(txClient)
    expect(list.length).toBe(25)

    const salesItem = list.find((i) => i.key === 'SALES')
    expect(salesItem).toBeDefined()
    expect(salesItem?.accountId).toBe('acc_4010')
    expect(salesItem?.accountCode).toBe('4010')
    expect(salesItem?.accountName).toBe('Sales Revenue (Merchandise Net)')
    expect(salesItem?.accountRootType).toBe('income')
    expect(salesItem?.isGroup).toBe(false)
    expect(salesItem?.isActive).toBe(true)
    expect(salesItem?.metadata.label).toBe('Sales Revenue (Merchandise Net)')
  })
})
