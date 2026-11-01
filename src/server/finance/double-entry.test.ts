import { describe, expect, it } from 'bun:test'
import { getTableName } from 'drizzle-orm'
import { ACCOUNT_KEYS } from './account-keys'
import {
  postJournalTx,
  reverseJournalTx,
  postOrderDeliveredTx,
  postCashHandoverTx,
  postDealerSettlementTx,
} from './double-entry'
import type { DbTx, JournalLineInput, PartyType } from './types'
import type { Order, OrderItem } from '#/server/operations/types'

describe('Double-Entry Accounting Core (Module 3)', () => {
  interface MockTxRecordedLine extends JournalLineInput {
    journalEntryId?: string
    debit?: number
    credit?: number
    partyId?: string | null
  }

  interface MockAccount {
    id: string
    name: string
    isGroup: boolean
    isActive: boolean
  }

  interface MockTxOptions {
    accounts?: MockAccount[]
    overrideAccounts?: MockAccount[]
    duplicateEntry?: boolean
    closedFy?: boolean
    closedFiscalYearIds?: string[]
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

  // Mock transaction object
  function createMockTx(options: MockTxOptions = {}) {
    const insertedHeaders: Array<Record<string, unknown>> = []
    const insertedLines: MockTxRecordedLine[] = []
    const sequences = new Map<string, number>()

    // Build accounts map with all 25 seeded ACCOUNT_KEYS active & non-group by default
    const defaultAccounts: MockAccount[] = Object.entries(ACCOUNT_KEYS).map(
      ([k, v]) => ({
        id: v,
        name: k.toLowerCase().replace(/_/g, ' '),
        isGroup: false,
        isActive: true,
      }),
    )

    const accountsMap = new Map<string, MockAccount>()
    if (options.overrideAccounts) {
      for (const a of options.overrideAccounts) {
        accountsMap.set(a.id, a)
      }
    } else {
      for (const a of defaultAccounts) {
        accountsMap.set(a.id, a)
      }
      if (options.accounts) {
        for (const a of options.accounts) {
          accountsMap.set(a.id, a)
        }
      }
    }

    const mock = {
      insertedHeaders,
      insertedLines,
      select: (_fields?: unknown) => ({
        from: (table: unknown) => {
          const tableName = getTableName(
            table as Parameters<typeof getTableName>[0],
          )
          return {
            where: (cond?: unknown) => {
              let result: unknown[] = []
              const sqlParams = extractSqlParams(cond)

              if (tableName === 'ledger_accounts') {
                result = Array.from(accountsMap.values())
              } else if (tableName === 'journal_entries') {
                if (options.duplicateEntry) {
                  result = [{ id: 'je_dup', voucherNo: 'JV-2081-00001' }]
                } else if (cond) {
                  if (
                    sqlParams.length === 1 &&
                    typeof sqlParams[0] === 'string'
                  ) {
                    result = insertedHeaders.filter(
                      (h) => h.id === sqlParams[0],
                    )
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
                } else {
                  result = insertedHeaders
                }
              } else if (tableName === 'journal_lines') {
                if (cond) {
                  const targetId =
                    typeof sqlParams[0] === 'string' ? sqlParams[0] : undefined
                  result = targetId
                    ? insertedLines.filter((l) => l.journalEntryId === targetId)
                    : insertedLines
                } else {
                  result = insertedLines
                }
              } else if (tableName === 'fiscal_years') {
                const fyId =
                  typeof sqlParams[0] === 'string' ? sqlParams[0] : ''
                if (
                  options.closedFy ||
                  (options.closedFiscalYearIds &&
                    options.closedFiscalYearIds.includes(fyId))
                ) {
                  result = [
                    { id: fyId || 'fy_test', name: '2081/82', isClosed: true },
                  ]
                } else {
                  result = []
                }
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
        set: (val: Record<string, unknown>) => ({
          where: (cond?: unknown) => {
            const sqlParams = extractSqlParams(cond)
            const targetId =
              typeof sqlParams[0] === 'string' ? sqlParams[0] : undefined
            if (targetId) {
              const targetHeader = insertedHeaders.find(
                (h) => h.id === targetId,
              )
              if (targetHeader) {
                Object.assign(targetHeader, val)
                return Promise.resolve()
              }
            }
            return Promise.resolve()
          },
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

        return Promise.resolve({
          rows: [],
        })
      },
    }

    return mock as unknown as DbTx & typeof mock
  }

  it('rejects unbalanced journal entries (sum of debit != sum of credit)', async () => {
    const tx = createMockTx()

    await expect(
      postJournalTx(tx, {
        narration: 'Unbalanced test',
        createdBy: 'Admin',
        lines: [
          { accountId: 'acc_1011', debit: 100000 },
          { accountId: 'acc_4010', credit: 90000 }, // 10000 paisa gap
        ],
      }),
    ).rejects.toThrow(/Unbalanced journal entry/)
  })

  it('rejects transactions with negative amounts or zero amount', async () => {
    const tx = createMockTx()

    await expect(
      postJournalTx(tx, {
        narration: 'Negative test',
        createdBy: 'Admin',
        lines: [
          { accountId: 'acc_1011', debit: -5000 },
          { accountId: 'acc_4010', credit: -5000 },
        ],
      }),
    ).rejects.toThrow(/Negative amounts are prohibited/)
  })

  it('rejects lines having both debit and credit or neither', async () => {
    const tx = createMockTx()

    await expect(
      postJournalTx(tx, {
        narration: 'Both debit and credit',
        createdBy: 'Admin',
        lines: [
          { accountId: 'acc_1011', debit: 5000, credit: 5000 },
          { accountId: 'acc_4010', credit: 10000 },
        ],
      }),
    ).rejects.toThrow(/Exactly one of debit or credit must be positive/)
  })

  it('rejects unknown accounts not present in Chart of Accounts (ACC-0.3)', async () => {
    const tx = createMockTx()

    await expect(
      postJournalTx(tx, {
        narration: 'Unknown account test',
        createdBy: 'Admin',
        lines: [
          { accountId: 'acc_unknown_9999', debit: 5000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 5000 },
        ],
      }),
    ).rejects.toThrow(
      /Account "acc_unknown_9999" does not exist in Chart of Accounts/,
    )
  })

  it('rejects posting to group accounts (ACC-0.3)', async () => {
    const tx = createMockTx({
      accounts: [
        {
          id: 'acc_grp_1000',
          name: 'Current Assets',
          isGroup: true,
          isActive: true,
        },
      ],
    })

    await expect(
      postJournalTx(tx, {
        narration: 'Group account test',
        createdBy: 'Admin',
        lines: [
          { accountId: 'acc_grp_1000', debit: 5000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 5000 },
        ],
      }),
    ).rejects.toThrow(
      /Cannot post to group account "Current Assets" \(acc_grp_1000\)/,
    )
  })

  it('rejects posting to inactive accounts (ACC-0.3)', async () => {
    const tx = createMockTx({
      accounts: [
        {
          id: 'acc_inactive_99',
          name: 'Old Closed Bank',
          isGroup: false,
          isActive: false,
        },
      ],
    })

    await expect(
      postJournalTx(tx, {
        narration: 'Inactive account test',
        createdBy: 'Admin',
        lines: [
          { accountId: 'acc_inactive_99', debit: 5000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 5000 },
        ],
      }),
    ).rejects.toThrow(
      /Cannot post to inactive account "Old Closed Bank" \(acc_inactive_99\)/,
    )
  })

  it('rejects invalid partyType not in allowed set (ACC-0.3)', async () => {
    const tx = createMockTx()

    await expect(
      postJournalTx(tx, {
        narration: 'Invalid partyType test',
        createdBy: 'Admin',
        lines: [
          {
            accountId: ACCOUNT_KEYS.SALES,
            debit: 5000,
            partyType: 'vendor' as unknown as PartyType,
            partyId: 'v_01',
          },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 5000 },
        ],
      }),
    ).rejects.toThrow(/Invalid partyType "vendor"/)
  })

  describe('Party-controlled accounts validation (ACC-0.3)', () => {
    const partyControlledCases = [
      { key: 'DEALER_PAYABLE', accountId: ACCOUNT_KEYS.DEALER_PAYABLE },
      { key: 'RIDER_COD_CASH', accountId: ACCOUNT_KEYS.RIDER_COD_CASH },
      { key: 'RIDER_PAYABLE', accountId: ACCOUNT_KEYS.RIDER_PAYABLE },
      {
        key: 'CUSTOMER_RECEIVABLE',
        accountId: ACCOUNT_KEYS.CUSTOMER_RECEIVABLE,
      },
      {
        key: 'STAFF_RIDER_ADVANCES',
        accountId: ACCOUNT_KEYS.STAFF_RIDER_ADVANCES,
      },
    ]

    for (const { key, accountId } of partyControlledCases) {
      it(`rejects ${key} (${accountId}) when partyType or partyId are missing`, async () => {
        const tx = createMockTx()

        await expect(
          postJournalTx(tx, {
            narration: `Missing party on ${key}`,
            createdBy: 'Admin',
            lines: [
              { accountId, debit: 10000 }, // Missing partyType & partyId
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 10000 },
            ],
          }),
        ).rejects.toThrow(
          new RegExp(
            `Account "${accountId}" is a party-controlled account and requires both partyType and partyId`,
          ),
        )
      })

      it(`rejects ${key} (${accountId}) when partyId is blank whitespace`, async () => {
        const tx = createMockTx()

        await expect(
          postJournalTx(tx, {
            narration: `Blank partyId on ${key}`,
            createdBy: 'Admin',
            lines: [
              {
                accountId,
                debit: 10000,
                partyType: 'rider',
                partyId: '   ',
              },
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 10000 },
            ],
          }),
        ).rejects.toThrow(
          new RegExp(
            `Account "${accountId}" is a party-controlled account and requires both partyType and partyId`,
          ),
        )
      })
    }
  })

  it('correctly posts and balances an Order Delivered COD event with 13% VAT & Dealer Sourcing', async () => {
    const tx = createMockTx()

    const mockOrder: Order = {
      id: 'ord_test_01',
      number: 'MZ-10005',
      customerId: 'usr_01',
      customerName: 'Aayush Sharma',
      customerEmail: 'aayush@example.com',
      customerPhone: '9841234567',
      address: 'Traffic Chowk',
      city: 'Butwal',
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      subtotal: 339000, // 3,390 Rs. (VAT inclusive) -> Net: 3,000 Rs. (300,000), VAT 13%: 390 Rs. (39,000)
      deliveryCharge: 15000, // 150 Rs.
      discount: 0,
      tax: 39000,
      total: 354000, // 3,540 Rs.
      riderId: 'rider_01',
      trackingCode: 'TRK10005',
      notes: '',
      couponCode: null,
      events: [],
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const mockItems: OrderItem[] = [
      {
        id: 'oi_01',
        catalogType: 'liquor',
        productId: 'prod_liq_01',
        variantId: 'var_liq_01',
        name: 'Old Durbar 750ml',
        variantName: '750ml',
        sku: 'OD-750',
        qty: 1,
        unitPrice: 339000,
        lineTotal: 339000,
        dealerId: 'dealer_butwal_01',
        dealerCostPrice: 280000, // 2,800 Rs. cost from dealer
        sourcingStatus: 'picked_up',
        isSettled: false,
      },
    ]

    const result = await postOrderDeliveredTx(tx, {
      order: mockOrder,
      items: mockItems,
      actor: { id: 'usr_01', name: 'Rider Ramesh', role: 'rider' },
    })

    expect(result.voucherNo).toBeDefined()
    expect(tx.insertedHeaders.length).toBe(1)
    expect(tx.insertedLines.length).toBeGreaterThanOrEqual(4)

    const totalDebit = tx.insertedLines.reduce(
      (s: number, l) => s + (l.debit ?? 0),
      0,
    )
    const totalCredit = tx.insertedLines.reduce(
      (s: number, l) => s + (l.credit ?? 0),
      0,
    )

    // Verify perfectly balanced
    expect(totalDebit).toBe(totalCredit)

    // Check specific lines:
    // 1. Dr. Rider COD Cash: 354000
    const riderCashLine = tx.insertedLines.find(
      (l) => l.accountId === 'acc_1031',
    )
    expect(riderCashLine?.debit).toBe(354000)
    expect(riderCashLine?.partyId).toBe('rider_01')

    // 2. Cr. Sales Revenue: 300000
    const salesLine = tx.insertedLines.find((l) => l.accountId === 'acc_4010')
    expect(salesLine?.credit).toBe(300000)

    // 3. Cr. VAT Output Payable: 39000
    const vatLine = tx.insertedLines.find((l) => l.accountId === 'acc_2021')
    expect(vatLine?.credit).toBe(39000)

    // 4. Cr. Delivery Fee Income: 15000
    const deliveryLine = tx.insertedLines.find(
      (l) => l.accountId === 'acc_4020',
    )
    expect(deliveryLine?.credit).toBe(15000)

    // 5. Dr. COGS Liquor: 280000
    const cogsLine = tx.insertedLines.find((l) => l.accountId === 'acc_5011')
    expect(cogsLine?.debit).toBe(280000)

    // 6. Cr. Dealer Procurement Payable: 280000
    const dealerLine = tx.insertedLines.find((l) => l.accountId === 'acc_2011')
    expect(dealerLine?.credit).toBe(280000)
    expect(dealerLine?.partyId).toBe('dealer_butwal_01')
  })

  it('correctly posts and balances Rider Cash Handover', async () => {
    const tx = createMockTx()

    const result = await postCashHandoverTx(tx, {
      handoverId: 'rch_test_01',
      riderId: 'rider_01',
      riderName: 'Ramesh Thapa',
      amount: 1500000, // 15,000 Rs.
      actor: { id: 'usr_mgr', name: 'Manager Kiran', role: 'manager' },
    })

    expect(result.voucherNo).toContain('RV-')
    expect(tx.insertedLines.length).toBe(2)

    const cashDebit = tx.insertedLines.find((l) => l.accountId === 'acc_1011')
    const riderCredit = tx.insertedLines.find((l) => l.accountId === 'acc_1031')

    expect(cashDebit?.debit).toBe(1500000)
    expect(riderCredit?.credit).toBe(1500000)
    expect(riderCredit?.partyId).toBe('rider_01')
  })

  it('correctly posts and balances Dealer Settlement Payment with TDS withholding', async () => {
    const tx = createMockTx()

    const result = await postDealerSettlementTx(tx, {
      settlementId: 'stl_test_01',
      dealerId: 'dealer_01',
      dealerName: 'Lumbini Beverage Dist',
      grossAmount: 1000000, // 10,000 Rs.
      tdsRate: 1.5, // 1.5% TDS = 150 Rs. (15000 paisa)
      paymentAccount: 'bank',
      actor: { id: 'usr_adm', name: 'Admin', role: 'admin' },
    })

    expect(result.voucherNo).toContain('PV-')
    expect(tx.insertedLines.length).toBe(3)

    const grossDebit = tx.insertedLines.find((l) => l.accountId === 'acc_2011')
    const bankCredit = tx.insertedLines.find((l) => l.accountId === 'acc_1012')
    const tdsCredit = tx.insertedLines.find((l) => l.accountId === 'acc_2023')

    expect(grossDebit?.debit).toBe(1000000)
    expect(bankCredit?.credit).toBe(985000) // 9,850 Rs. net
    expect(tdsCredit?.credit).toBe(15000) // 150 Rs. TDS
    expect(grossDebit?.debit).toBe(
      (bankCredit?.credit ?? 0) + (tdsCredit?.credit ?? 0),
    )
  })

  it('correctly posts and balances an Order Delivered event with Rider Compensation Accrual', async () => {
    const tx = createMockTx()

    const mockOrder: Order = {
      id: 'ord_rider_pay_01',
      number: 'MZ-10088',
      customerId: 'usr_02',
      customerName: 'Suman Shrestha',
      customerEmail: 'suman@example.com',
      customerPhone: '9851000000',
      address: 'Milanchowk',
      city: 'Butwal',
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      subtotal: 200000, // 2,000 Rs.
      deliveryCharge: 15000, // 150 Rs.
      discount: 0,
      tax: 23009, // 13% VAT
      total: 215000,
      riderId: 'rider_01',
      trackingCode: 'TRK10088',
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
        name: 'Khukri Rum 750ml',
        variantName: '750ml',
        sku: 'KR-750',
        qty: 1,
        unitPrice: 200000,
        lineTotal: 200000,
        dealerId: 'dealer_01',
        dealerCostPrice: 170000, // 1,700 Rs.
        sourcingStatus: 'picked_up',
        isSettled: false,
      },
    ]

    // Rider: per_drop = Rs. 50 (5,000 paisa), commission = 10% of 150 Rs. delivery charge (1,500 paisa)
    // Total rider pay = 5,000 + 1,500 = 6,500 paisa (Rs. 65)
    const result = await postOrderDeliveredTx(tx, {
      order: mockOrder,
      items: mockItems,
      actor: { id: 'rider_01', name: 'Rider Ramesh', role: 'rider' },
      rider: {
        id: 'rider_01',
        name: 'Rider Ramesh',
        perDropRate: 5000, // Rs. 50
        commissionRate: 10, // 10%
      },
    })

    expect(result.voucherNo).toBeDefined()

    const totalDebit = tx.insertedLines.reduce(
      (s: number, l) => s + (l.debit ?? 0),
      0,
    )
    const totalCredit = tx.insertedLines.reduce(
      (s: number, l) => s + (l.credit ?? 0),
      0,
    )
    expect(totalDebit).toBe(totalCredit)

    // Check Rider Expense (acc_5111) and Rider Payable (acc_2031)
    const riderExpense = tx.insertedLines.find(
      (l) => l.accountId === 'acc_5111',
    )
    const riderPayable = tx.insertedLines.find(
      (l) => l.accountId === 'acc_2031',
    )

    expect(riderExpense?.debit).toBe(6500)
    expect(riderExpense?.partyId).toBe('rider_01')
    expect(riderPayable?.credit).toBe(6500)
    expect(riderPayable?.partyId).toBe('rider_01')
  })

  describe('Reversal Hardening Core (ACC-0.4 / G2)', () => {
    it('successfully reverses a manual voucher, links reversalOf and reversedBy, and leaves net zero per account', async () => {
      const tx = createMockTx()

      // 1. Post original manual journal voucher
      const original = await postJournalTx(tx, {
        voucherType: 'JV',
        postingDate: new Date('2024-10-15T10:00:00Z'),
        narration: 'Manual office supplies purchase',
        createdBy: 'Admin Kiran',
        lines: [
          { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 50000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 50000 },
        ],
      })

      expect(original.voucherNo).toBeDefined()
      expect(tx.insertedHeaders.length).toBe(1)
      expect(tx.insertedHeaders[0].isReversed).toBe(false)
      expect(tx.insertedHeaders[0].reversedBy).toBeNull()

      // 2. Reverse the voucher
      const reversal = await reverseJournalTx(tx, {
        originalEntryId: original.journalEntryId,
        narration: 'Reversal: Incorrect vendor charged',
        createdBy: 'Admin Kiran',
      })

      expect(reversal.voucherNo).toBeDefined()
      expect(reversal.voucherNo).not.toBe(original.voucherNo)
      expect(tx.insertedHeaders.length).toBe(2)

      // Verify linking:
      const origHeader = tx.insertedHeaders.find(
        (h) => h.id === original.journalEntryId,
      )
      const revHeader = tx.insertedHeaders.find(
        (h) => h.id === reversal.journalEntryId,
      )

      expect(origHeader?.isReversed).toBe(true)
      expect(origHeader?.reversedBy).toBe(reversal.journalEntryId)
      expect(revHeader?.reversalOf).toBe(original.journalEntryId)
      expect(revHeader?.refType).toBe('journal_reversal')
      expect(revHeader?.refId).toBe(original.journalEntryId)

      // Verify net balance = 0 across both accounts
      const allLines = tx.insertedLines
      const adminLines = allLines.filter(
        (l) => l.accountId === ACCOUNT_KEYS.ADMIN_EXPENSE,
      )
      const cashLines = allLines.filter(
        (l) => l.accountId === ACCOUNT_KEYS.CASH_IN_HAND,
      )

      expect(adminLines.length).toBe(2)
      expect(cashLines.length).toBe(2)

      const netAdmin = adminLines.reduce(
        (acc, l) => acc + (l.debit ?? 0) - (l.credit ?? 0),
        0,
      )
      const netCash = cashLines.reduce(
        (acc, l) => acc + (l.debit ?? 0) - (l.credit ?? 0),
        0,
      )

      expect(netAdmin).toBe(0)
      expect(netCash).toBe(0)
    })

    it('rejects a second reversal on an entry already reversed (ACC-0.4)', async () => {
      const tx = createMockTx()

      const original = await postJournalTx(tx, {
        voucherType: 'JV',
        narration: 'Initial transaction',
        createdBy: 'Admin Kiran',
        lines: [
          { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 25000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 25000 },
        ],
      })

      // First reversal succeeds
      await reverseJournalTx(tx, {
        originalEntryId: original.journalEntryId,
        narration: 'Reversal: First cancellation',
        createdBy: 'Admin Kiran',
      })

      // Second reversal must throw with clear error
      await expect(
        reverseJournalTx(tx, {
          originalEntryId: original.journalEntryId,
          narration: 'Reversal: Second attempt should fail',
          createdBy: 'Admin Kiran',
        }),
      ).rejects.toThrow(
        /has already been reversed.*Duplicate reversals are prohibited/,
      )
    })

    it('rejects attempting to reverse a reversal voucher (ACC-0.4)', async () => {
      const tx = createMockTx()

      const original = await postJournalTx(tx, {
        voucherType: 'JV',
        narration: 'Initial transaction',
        createdBy: 'Admin Kiran',
        lines: [
          { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 30000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 30000 },
        ],
      })

      const reversal = await reverseJournalTx(tx, {
        originalEntryId: original.journalEntryId,
        narration: 'Reversal: Cancel',
        createdBy: 'Admin Kiran',
      })

      // Attempting to reverse the reversal entry itself must throw
      await expect(
        reverseJournalTx(tx, {
          originalEntryId: reversal.journalEntryId,
          narration: 'Reversal: Reversing a reversal should fail',
          createdBy: 'Admin Kiran',
        }),
      ).rejects.toThrow(/because it is already a reversal of/)
    })

    it('reversal date policy: uses original posting date when original fiscal year is open (§5.4)', async () => {
      const tx = createMockTx()
      const originalDate = new Date('2024-09-01T10:00:00Z')

      const original = await postJournalTx(tx, {
        voucherType: 'JV',
        postingDate: originalDate,
        narration: 'Transaction in open period',
        createdBy: 'Admin Kiran',
        lines: [
          { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 15000 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, credit: 15000 },
        ],
      })

      const reversal = await reverseJournalTx(tx, {
        originalEntryId: original.journalEntryId,
        narration: 'Reversal: Retain open date',
        createdBy: 'Admin Kiran',
      })

      const revHeader = tx.insertedHeaders.find(
        (h) => h.id === reversal.journalEntryId,
      )
      expect(new Date(revHeader?.postingDate as Date).toISOString()).toBe(
        originalDate.toISOString(),
      )
    })

    it('reversal date policy: uses current date when original fiscal year is closed (§5.4)', async () => {
      const originalDate = new Date('2023-08-01T10:00:00Z')
      const beforeReversal = new Date()

      const tx = createMockTx({
        closedFiscalYearIds: ['fy-2080-81'],
      })

      // Pre-seed an original entry posted in a now-closed fiscal year
      const origId = 'je_closed_fy_test'
      tx.insertedHeaders.push({
        id: origId,
        voucherNo: 'JV-2080-00042',
        voucherType: 'JV',
        fiscalYearId: 'fy-2080-81',
        postingDate: originalDate,
        narration: 'Old entry from closed FY',
        refType: null,
        refId: null,
        event: null,
        postingStatus: 'submitted',
        isReversed: false,
        reversedBy: null,
        reversalOf: null,
        createdBy: 'Admin',
      })
      tx.insertedLines.push(
        {
          accountId: ACCOUNT_KEYS.ADMIN_EXPENSE,
          debit: 12000,
          credit: 0,
          journalEntryId: origId,
        },
        {
          accountId: ACCOUNT_KEYS.CASH_IN_HAND,
          debit: 0,
          credit: 12000,
          journalEntryId: origId,
        },
      )

      const reversal = await reverseJournalTx(tx, {
        originalEntryId: origId,
        narration: 'Reversal into current open period',
        createdBy: 'Admin Kiran',
      })

      const revHeader = tx.insertedHeaders.find(
        (h) => h.id === reversal.journalEntryId,
      )
      const reversalDate = new Date(revHeader?.postingDate as Date)
      expect(reversalDate.getTime()).toBeGreaterThanOrEqual(
        beforeReversal.getTime() - 1000,
      )
    })
  })
})
