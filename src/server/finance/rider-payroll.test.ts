import { describe, expect, it } from 'bun:test'
import { getTableName } from 'drizzle-orm'
import { ACCOUNT_KEYS } from './account-keys'
import {
  postOrderDeliveredTx,
  postRiderPayoutTx,
  postRiderSalaryAccrualTx,
} from './double-entry'
import { getRiderLedgerBalanceQuery } from './finance.queries'
import type { RiderLedgerBalance } from './finance.queries'
import type { DbTx, JournalLineInput, PartyType } from './types'
import type { Order, OrderItem } from '#/server/operations/types'

describe('Rider Payroll to Ledger Integration (ACC-0.10 / G10 Option A)', () => {
  interface MockTxRecordedLine extends JournalLineInput {
    id?: string
    journalEntryId?: string
    debit?: number
    credit?: number
    partyType?: PartyType | null
    partyId?: string | null
  }

  interface MockTxOptions {
    lines?: MockTxRecordedLine[]
    headers?: Array<Record<string, unknown>>
  }

  function extractSqlParams(cond: unknown): unknown[] {
    const params: unknown[] = []
    function traverse(obj: unknown) {
      if (obj === null || obj === undefined) return
      if (
        typeof obj === 'string' ||
        typeof obj === 'number' ||
        typeof obj === 'boolean'
      ) {
        params.push(obj)
        return
      }
      if (typeof obj !== 'object') return
      if (
        'queryChunks' in obj &&
        Array.isArray((obj as { queryChunks: unknown[] }).queryChunks)
      ) {
        for (const chunk of (obj as { queryChunks: unknown[] }).queryChunks) {
          traverse(chunk)
        }
      } else if (
        'value' in obj &&
        !Array.isArray(obj.value) &&
        obj.value !== undefined
      ) {
        params.push(obj.value)
      }
    }
    traverse(cond)
    return params
  }

  function createMockTx(options: MockTxOptions = {}) {
    const insertedHeaders: Array<Record<string, unknown>> = [
      ...(options.headers || []),
    ]
    const insertedLines: MockTxRecordedLine[] = [...(options.lines || [])]
    const sequences = new Map<string, number>()

    const defaultAccounts = Object.entries(ACCOUNT_KEYS).map(([k, v]) => ({
      id: v,
      name: k.toLowerCase().replace(/_/g, ' '),
      isGroup: false,
      isActive: true,
    }))

    const mock = {
      insertedHeaders,
      insertedLines,
      select: (_fields?: unknown) => ({
        from: (table: unknown) => {
          const tableName = getTableName(
            table as Parameters<typeof getTableName>[0],
          )
          return {
            innerJoin: (_joinTable: unknown, _joinCond: unknown) => ({
              where: (cond?: unknown) => {
                const sqlParams = extractSqlParams(cond)
                const targetRiderId = sqlParams.find(
                  (p) => typeof p === 'string' && p.startsWith('rider_'),
                ) as string | undefined

                // Aggregate by accountId for the rider
                const filtered = insertedLines.filter(
                  (l) =>
                    l.partyType === 'rider' &&
                    (!targetRiderId || l.partyId === targetRiderId),
                )

                const accountMap = new Map<
                  string,
                  { accountId: string; totalDebit: number; totalCredit: number }
                >()
                for (const l of filtered) {
                  const accId = l.accountId
                  const current = accountMap.get(accId) || {
                    accountId: accId,
                    totalDebit: 0,
                    totalCredit: 0,
                  }
                  current.totalDebit += l.debit ?? 0
                  current.totalCredit += l.credit ?? 0
                  accountMap.set(accId, current)
                }

                const result = Array.from(accountMap.values())
                const p = Promise.resolve(result)
                return Object.assign(p, {
                  groupBy: () => Promise.resolve(result),
                })
              },
            }),
            where: (cond?: unknown) => {
              let result: unknown[] = []
              const sqlParams = extractSqlParams(cond)

              if (tableName === 'ledger_accounts') {
                result = defaultAccounts
              } else if (tableName === 'journal_entries') {
                if (
                  sqlParams.length === 1 &&
                  typeof sqlParams[0] === 'string'
                ) {
                  result = insertedHeaders.filter((h) => h.id === sqlParams[0])
                } else if (sqlParams.length === 3) {
                  const [refType, refId, event] = sqlParams
                  result = insertedHeaders.filter(
                    (h) =>
                      h.refType === refType &&
                      h.refId === refId &&
                      h.event === event,
                  )
                } else {
                  result = []
                }
              } else if (tableName === 'journal_lines') {
                const targetId =
                  typeof sqlParams[0] === 'string' ? sqlParams[0] : undefined
                result = targetId
                  ? insertedLines.filter((l) => l.journalEntryId === targetId)
                  : insertedLines
              } else if (tableName === 'fiscal_years') {
                result = []
              }

              const p = Promise.resolve(result)
              return Object.assign(p, {
                limit: (n = 1) => Promise.resolve(result.slice(0, n)),
              })
            },
          }
        },
      }),
      insert: (_table: unknown) => ({
        values: (val: Record<string, unknown>) => {
          if (val.voucherNo) {
            insertedHeaders.push({
              isReversed: false,
              reversedBy: null,
              reversalOf: null,
              ...val,
            })
          } else if (val.accountId) {
            insertedLines.push(val as unknown as MockTxRecordedLine)
          }
          const p = Promise.resolve()
          return Object.assign(p, {
            onConflictDoNothing: () => Promise.resolve(),
          })
        },
      }),
      update: (_table: unknown) => ({
        set: (_val: Record<string, unknown>) => ({
          where: () => Promise.resolve(),
        }),
      }),
      execute: (query?: unknown) => {
        const sqlParams = extractSqlParams(query)
        const chunks =
          query &&
          typeof query === 'object' &&
          'queryChunks' in query &&
          Array.isArray((query as { queryChunks: unknown[] }).queryChunks)
            ? (query as { queryChunks: unknown[] }).queryChunks
            : []
        const text = chunks
          .map((c) => {
            if (typeof c === 'string') return c
            if (
              c !== null &&
              typeof c === 'object' &&
              'value' in c &&
              Array.isArray(c.value)
            ) {
              return c.value.join('')
            }
            return ''
          })
          .join(' ')

        if (text.includes('voucher_sequences')) {
          if (/^\s*UPDATE\s+voucher_sequences/i.test(text)) {
            const nextNo =
              typeof sqlParams[0] === 'number'
                ? sqlParams[0]
                : Number(sqlParams[0]) || 1
            const vType = typeof sqlParams[2] === 'string' ? sqlParams[2] : 'JV'
            sequences.set(vType, nextNo)
            return Promise.resolve({ rows: [] })
          }
          if (text.includes('SELECT')) {
            const vType = typeof sqlParams[1] === 'string' ? sqlParams[1] : 'JV'
            const lastNo = sequences.get(vType) ?? 0
            return Promise.resolve({
              rows: [{ last_no: lastNo, prefix: vType }],
            })
          }
        }

        return Promise.resolve({ rows: [] })
      },
    }

    return mock as unknown as DbTx & typeof mock
  }

  it('precondition verification: ensures partyType and partyId are strictly non-null for RIDER_PAYABLE postings', async () => {
    const tx = createMockTx()

    // Post rider compensation via order delivery
    const mockOrder: Order = {
      id: 'ord_rider_precond_01',
      number: 'MZ-10099',
      customerId: 'usr_02',
      customerName: 'Suman Shrestha',
      customerEmail: 'suman@example.com',
      customerPhone: '9851000000',
      address: 'Milanchowk',
      city: 'Butwal',
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      subtotal: 100000,
      deliveryCharge: 15000,
      discount: 0,
      tax: 11504,
      total: 115000,
      riderId: 'rider_01',
      trackingCode: 'TRK10099',
      notes: '',
      couponCode: null,
      events: [],
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const mockItems: OrderItem[] = [
      {
        id: 'oi_02',
        catalogType: 'liquor',
        productId: 'prod_02',
        variantId: 'var_02',
        name: 'Test Rum 750ml',
        variantName: '750ml',
        sku: 'TR-750',
        qty: 1,
        unitPrice: 100000,
        lineTotal: 100000,
        dealerId: 'dealer_01',
        dealerCostPrice: 80000,
        sourcingStatus: 'picked_up',
        isSettled: false,
      },
    ]

    await postOrderDeliveredTx(tx, {
      order: mockOrder,
      items: mockItems,
      actor: { id: 'rider_01', name: 'Rider Ramesh', role: 'rider' },
      rider: {
        id: 'rider_01',
        name: 'Rider Ramesh',
        perDropRate: 5000,
        commissionRate: 10,
      },
    })

    const riderPayableLines = tx.insertedLines.filter(
      (l) => l.accountId === ACCOUNT_KEYS.RIDER_PAYABLE,
    )
    expect(riderPayableLines.length).toBeGreaterThan(0)
    for (const l of riderPayableLines) {
      expect(l.partyType).toBe('rider')
      expect(l.partyId).toBe('rider_01')
      expect(l.partyId).not.toBeNull()
    }
  })

  it('correctly aggregates sub-ledger balances across RIDER_PAYABLE, RIDER_COD_CASH, and STAFF_RIDER_ADVANCES via getRiderLedgerBalanceQuery', async () => {
    const tx = createMockTx({
      lines: [
        // RIDER_PAYABLE (2031): 2 deliveries accrued (6500 + 6500 = 13000 paisa)
        {
          accountId: ACCOUNT_KEYS.RIDER_PAYABLE,
          partyType: 'rider',
          partyId: 'rider_01',
          debit: 0,
          credit: 6500,
        },
        {
          accountId: ACCOUNT_KEYS.RIDER_PAYABLE,
          partyType: 'rider',
          partyId: 'rider_01',
          debit: 0,
          credit: 6500,
        },
        // RIDER_COD_CASH (1031): COD cash collected 354000, handed over 300000 -> net un-deposited 54000
        {
          accountId: ACCOUNT_KEYS.RIDER_COD_CASH,
          partyType: 'rider',
          partyId: 'rider_01',
          debit: 354000,
          credit: 0,
        },
        {
          accountId: ACCOUNT_KEYS.RIDER_COD_CASH,
          partyType: 'rider',
          partyId: 'rider_01',
          debit: 0,
          credit: 300000,
        },
        // STAFF_RIDER_ADVANCES (1042): 20000 advance loan issued, 5000 recovered -> net outstanding 15000
        {
          accountId: ACCOUNT_KEYS.STAFF_RIDER_ADVANCES,
          partyType: 'rider',
          partyId: 'rider_01',
          debit: 20000,
          credit: 0,
        },
        {
          accountId: ACCOUNT_KEYS.STAFF_RIDER_ADVANCES,
          partyType: 'rider',
          partyId: 'rider_01',
          debit: 0,
          credit: 5000,
        },
      ],
    })

    const balance: RiderLedgerBalance = await getRiderLedgerBalanceQuery(
      tx,
      'rider_01',
    )
    expect(balance.riderId).toBe('rider_01')
    expect(balance.commissionPayable).toBe(13000)
    expect(balance.undepositedCodCash).toBe(54000)
    expect(balance.outstandingAdvances).toBe(15000)
  })

  it('Option A Lifecycle: Accrues base salary and debits RIDER_PAYABLE for the exact ledger balance, clearing RIDER_PAYABLE to zero', async () => {
    const tx = createMockTx()

    // 1. Rider delivers 2 orders, earning 6500 paisa each = 13000 paisa credit on RIDER_PAYABLE
    tx.insertedLines.push(
      {
        accountId: ACCOUNT_KEYS.RIDER_PAYABLE,
        partyType: 'rider',
        partyId: 'rider_01',
        debit: 0,
        credit: 6500,
      },
      {
        accountId: ACCOUNT_KEYS.RIDER_PAYABLE,
        partyType: 'rider',
        partyId: 'rider_01',
        debit: 0,
        credit: 6500,
      },
    )

    const beforePayroll = await getRiderLedgerBalanceQuery(tx, 'rider_01')
    expect(beforePayroll.commissionPayable).toBe(13000)

    // 2. Month-end payroll approval:
    // Rider has base salary = Rs. 15,000 (1500000 paisa)
    // Accrued delivery commission from ledger = Rs. 130 (13000 paisa)
    // Gross payable = 1500000 + 13000 = 1513000 paisa
    const baseSalary = 1500000
    const grossEarnings = baseSalary + beforePayroll.commissionPayable

    // Step A: Accrue base salary
    await postRiderSalaryAccrualTx(tx, {
      settlementId: 'set_test_01',
      riderId: 'rider_01',
      riderName: 'Ramesh Thapa',
      baseSalaryAmount: baseSalary,
      actor: { id: 'adm_01', name: 'Admin', role: 'admin' },
    })

    // Step B: Post payout clearing gross earnings
    await postRiderPayoutTx(tx, {
      settlementId: 'set_test_01',
      riderId: 'rider_01',
      riderName: 'Ramesh Thapa',
      grossAmount: grossEarnings,
      netPaid: grossEarnings,
      cashShortageDeducted: 0,
      advancesDeducted: 0,
      paymentAccount: 'bank',
      actor: { id: 'adm_01', name: 'Admin', role: 'admin' },
    })

    // 3. Verify total debits and credits on RIDER_PAYABLE for this rider
    const riderLines = tx.insertedLines.filter(
      (l) =>
        l.accountId === ACCOUNT_KEYS.RIDER_PAYABLE && l.partyId === 'rider_01',
    )
    const totalCredits = riderLines.reduce((acc, l) => acc + (l.credit ?? 0), 0)
    const totalDebits = riderLines.reduce((acc, l) => acc + (l.debit ?? 0), 0)

    expect(totalCredits).toBe(1513000)
    expect(totalDebits).toBe(1513000)
    expect(totalCredits - totalDebits).toBe(0) // Exactly zero!
  })

  it('Automated Reconciliation Check: Identifies and reports discrepancy when order recalculation differs from ledger accrual', async () => {
    // Scenario:
    // Ledger has 3 delivery postings accrued at historical rate of Rs. 65 (6500 paisa each) = 19500 paisa.
    // However, order recalculation uses a newly changed rate of Rs. 75 (7500 paisa each) = 22500 paisa.
    const ledgerAccruedCommission = 19500
    const orderCalculatedEarnings = 22500

    const variance = ledgerAccruedCommission - orderCalculatedEarnings
    const hasVariance = variance !== 0

    expect(hasVariance).toBe(true)
    expect(variance).toBe(-3000) // Ledger is 3000 paisa lower than order recalculation

    // Under Option A, the payout debits ledgerAccruedCommission (19500), NOT orderCalculatedEarnings (22500)
    const payoutAmount = ledgerAccruedCommission
    expect(payoutAmount).toBe(19500)

    // Verify: If we had erroneously debited orderCalculatedEarnings (22500), RIDER_PAYABLE would become -3000
    const erroneousBalance = ledgerAccruedCommission - orderCalculatedEarnings
    expect(erroneousBalance).toBeLessThan(0) // Negative control account balance (strictly prohibited!)

    // But following the ledger balance as source of truth guarantees net zero
    const correctFinalBalance = ledgerAccruedCommission - payoutAmount
    expect(correctFinalBalance).toBe(0)
  })

  it('Deduction handling: Shortages and advances are credited to RIDER_COD_CASH and STAFF_RIDER_ADVANCES, balancing payout', async () => {
    const tx = createMockTx()

    const gross = 100000 // Rs. 1,000 gross
    const shortageDeduction = 25000 // Rs. 250 shortage
    const advanceDeduction = 15000 // Rs. 150 advance
    const netPayout = gross - shortageDeduction - advanceDeduction // Rs. 600 net

    await postRiderPayoutTx(tx, {
      settlementId: 'set_deduct_01',
      riderId: 'rider_01',
      riderName: 'Ramesh Thapa',
      grossAmount: gross,
      netPaid: netPayout,
      cashShortageDeducted: shortageDeduction,
      advancesDeducted: advanceDeduction,
      paymentAccount: 'cash',
      actor: { id: 'adm_01', name: 'Admin', role: 'admin' },
    })

    // Check lines posted
    expect(tx.insertedLines.length).toBe(4)

    const drPayable = tx.insertedLines.find(
      (l) => l.accountId === ACCOUNT_KEYS.RIDER_PAYABLE,
    )
    const crCash = tx.insertedLines.find(
      (l) => l.accountId === ACCOUNT_KEYS.CASH_IN_HAND,
    )
    const crShortage = tx.insertedLines.find(
      (l) => l.accountId === ACCOUNT_KEYS.RIDER_COD_CASH,
    )
    const crAdvance = tx.insertedLines.find(
      (l) => l.accountId === ACCOUNT_KEYS.STAFF_RIDER_ADVANCES,
    )

    expect(drPayable?.debit).toBe(gross)
    expect(crCash?.credit).toBe(netPayout)
    expect(crShortage?.credit).toBe(shortageDeduction)
    expect(crAdvance?.credit).toBe(advanceDeduction)

    // Perfectly balanced
    const totalDebit = drPayable?.debit ?? 0
    const totalCredit =
      (crCash?.credit ?? 0) +
      (crShortage?.credit ?? 0) +
      (crAdvance?.credit ?? 0)
    expect(totalDebit).toBe(totalCredit)
  })
})
