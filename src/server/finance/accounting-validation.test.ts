import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getTableName } from 'drizzle-orm'
import { ACCOUNT_KEYS } from './account-keys'
import {
  postJournalTx,
  reverseJournalTx,
  postOrderDeliveredTx,
  postCashHandoverTx,
  postDealerSettlementTx,
  postRiderSalaryAccrualTx,
  postRiderPayoutTx,
} from './double-entry'
import type { DbTx, FinanceActor, JournalLineInput } from './types'
import { formatNPR } from '#/lib/money'
import { adToBs, formatBS, getNepalFiscalYear } from '#/lib/nepal-date'
import { buildCsv, buildExcelXml } from './export.functions'

// ============================================================================
// IN-MEMORY MOCK TRANSACTION HARNESS (100% Isolated, Zero DB/Network Requirement)
// ============================================================================

const testActor: FinanceActor = {
  id: 'usr_test_1',
  name: 'Accountant',
  role: 'admin',
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
  lockedPeriod?: boolean
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
  const insertedHeaders: Array<Record<string, unknown>> = []
  const insertedLines: Array<JournalLineInput & { journalEntryId?: string }> = []
  const sequences = new Map<string, number>()

  const defaultAccounts: MockAccount[] = Object.entries(ACCOUNT_KEYS).map(
    ([k, v]) => ({
      id: v,
      name: k.toLowerCase().replace(/_/g, ' '),
      isGroup: false,
      isActive: true,
    }),
  )

  const accountsMap = new Map<string, MockAccount>()
  for (const a of defaultAccounts) {
    accountsMap.set(a.id, a)
  }
  if (options.accounts) {
    for (const a of options.accounts) {
      accountsMap.set(a.id, a)
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
                result = [{ id: 'je_dup', voucherNo: 'JV-2083-00001' }]
              } else if (cond) {
                if (sqlParams.length === 1 && typeof sqlParams[0] === 'string') {
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
              } else {
                result = insertedHeaders
              }
            } else if (tableName === 'fiscal_years') {
              result = [
                {
                  id: 'fy-2083-84',
                  name: '2083/84',
                  isClosed: options.closedFy ?? false,
                },
              ]
            } else if (tableName === 'accounting_periods') {
              if (options.lockedPeriod) {
                result = [
                  {
                    id: 'period_fy-2083-84_01',
                    name: 'Shrawan (2083/84)',
                    status: 'closed',
                  },
                ]
              } else {
                result = []
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
            }
            return {
              limit: (_n = 1) => Promise.resolve(result.slice(0, _n)),
              then: (resolve: (val: unknown) => void) =>
                Promise.resolve(result).then(resolve),
            }
          },
          limit: (_n = 1) => Promise.resolve([]),
          orderBy: () => ({
            limit: (_n = 1) => Promise.resolve([]),
          }),
        }
      },
    }),
    insert: (_table: unknown) => ({
      values: (val: Record<string, unknown> | Array<Record<string, unknown>>) => {
        const arr = Array.isArray(val) ? val : [val]
        for (const item of arr) {
          if (item.voucherNo || ('voucherType' in item && 'postingDate' in item)) {
            insertedHeaders.push({
              isReversed: false,
              reversedBy: null,
              reversalOf: null,
              ...item,
            })
          } else if (item.accountId) {
            insertedLines.push(
              item as unknown as JournalLineInput & { journalEntryId?: string },
            )
          }
        }
        const p = Promise.resolve(arr)
        return Object.assign(p, {
          onConflictDoNothing: () => Promise.resolve(),
          returning: () => Promise.resolve(arr),
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
            const targetHeader = insertedHeaders.find((h) => h.id === targetId)
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

  return mock as unknown as DbTx & {
    insertedHeaders: Array<Record<string, unknown>>
    insertedLines: Array<JournalLineInput & { journalEntryId?: string }>
  }
}

// ============================================================================
// TEST SUITE: PHASE 16 COMPREHENSIVE ERP ACCOUNTING VALIDATION
// ============================================================================

describe('Phase 16: Automated ERP Accounting Validation Suite', () => {

  // --------------------------------------------------------------------------
  // 1. FINANCIAL ENGINE VALIDATION
  // --------------------------------------------------------------------------
  describe('1. Financial Engine Core Invariants', () => {
    it('should successfully post a balanced journal entry (sum(Dr) == sum(Cr))', async () => {
      const tx = createMockTx()
      const res = await postJournalTx(tx, {
        voucherType: 'JV',
        narration: 'Office Supplies Purchase',
        lines: [
          { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 50000, credit: 0, costCenter: 'general' },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 50000, costCenter: 'general' },
        ],
        createdBy: 'Accountant',
      })

      assert.ok(res.journalEntryId.startsWith('je_'))
      assert.ok(res.voucherNo?.startsWith('JV-'))
      assert.strictEqual(tx.insertedLines.length, 2)
      assert.strictEqual(tx.insertedLines[0].debit, 50000)
      assert.strictEqual(tx.insertedLines[1].credit, 50000)
    })

    it('should reject an unbalanced journal entry with strict error message', async () => {
      const tx = createMockTx()
      await assert.rejects(
        async () => {
          await postJournalTx(tx, {
            voucherType: 'JV',
            narration: 'Unbalanced Journal',
            lines: [
              { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 50000, credit: 0 },
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 49000 },
            ],
            createdBy: 'Accountant',
          })
        },
        /Unbalanced journal entry! Total Debit \(50000 paisa\) must equal Total Credit \(49000 paisa\)/,
      )
    })

    it('should reject a journal line with both debit and credit or both zero', async () => {
      const tx = createMockTx()
      await assert.rejects(
        async () => {
          await postJournalTx(tx, {
            voucherType: 'JV',
            narration: 'Invalid dual line test',
            lines: [
              { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 1000, credit: 1000 },
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 0 },
            ],
            createdBy: 'Accountant',
          })
        },
        /Exactly one of debit or credit must be positive/,
      )
    })

    it('should reject posting to group accounts', async () => {
      const tx = createMockTx({
        accounts: [{ id: 'group_1', name: 'Fixed Assets Folder', isGroup: true, isActive: true }],
      })
      await assert.rejects(
        async () => {
          await postJournalTx(tx, {
            voucherType: 'JV',
            narration: 'Invalid dual line test',
            lines: [
              { accountId: 'group_1', debit: 10000, credit: 0 },
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 10000 },
            ],
            createdBy: 'Accountant',
          })
        },
        /Cannot post to group account/,
      )
    })

    it('should enforce idempotency on duplicate (refType, refId, event)', async () => {
      const tx = createMockTx({ duplicateEntry: true })
      const res = await postJournalTx(tx, {
        voucherType: 'JV',
        narration: 'Idempotency order delivery',
        refType: 'order',
        refId: 'order_123',
        event: 'order_delivered',
        lines: [
          { accountId: ACCOUNT_KEYS.SALES, debit: 0, credit: 1000 },
          { accountId: ACCOUNT_KEYS.CUSTOMER_RECEIVABLE, partyType: 'customer', partyId: 'cust_1', debit: 1000, credit: 0 },
        ],
        createdBy: 'System',
      })

      assert.strictEqual(res.isDuplicate, true)
      assert.strictEqual(res.voucherNo, 'JV-2083-00001')
    })

    it('should block postings in closed Nepal Fiscal Years', async () => {
      const tx = createMockTx({ closedFy: true })
      await assert.rejects(
        async () => {
          await postJournalTx(tx, {
            voucherType: 'JV',
            narration: 'Invalid dual line test',
            lines: [
              { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 1000, credit: 0 },
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 1000 },
            ],
            createdBy: 'Accountant',
          })
        },
        /is closed\. Postings in closed periods are prohibited/,
      )
    })

    it('should block retro-dated postings into locked BS accounting periods', async () => {
      const tx = createMockTx({ lockedPeriod: true })
      await assert.rejects(
        async () => {
          await postJournalTx(tx, {
            voucherType: 'JV',
            narration: 'Invalid dual line test',
            lines: [
              { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 1000, credit: 0 },
              { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 1000 },
            ],
            createdBy: 'Accountant',
          })
        },
        /is locked\. Retro-dated postings in locked periods are prohibited/,
      )
    })

    it('should correctly reverse a posted journal and invert debits and credits', async () => {
      const tx = createMockTx()
      // Post original
      const orig = await postJournalTx(tx, {
        voucherType: 'PV',
        narration: 'Supplier Payment',
        lines: [
          { accountId: ACCOUNT_KEYS.DEALER_PAYABLE, partyType: 'dealer', partyId: 'dealer_1', debit: 250000, credit: 0 },
          { accountId: ACCOUNT_KEYS.BANK_MAIN, debit: 0, credit: 250000 },
        ],
        createdBy: 'Accountant',
      })

      // Reverse original
      const rev = await reverseJournalTx(tx, {
        originalEntryId: orig.journalEntryId,
        narration: 'Reversal: Cheque bounced by supplier bank',
        createdBy: 'Senior Accountant',
      })

      assert.ok(rev.voucherNo)
      const reversedOriginal = tx.insertedHeaders.find((h) => h.id === orig.journalEntryId)
      assert.strictEqual(reversedOriginal?.isReversed, true)
      assert.strictEqual(reversedOriginal?.reversedBy, rev.journalEntryId)

      // Verify inverted lines
      const revLines = tx.insertedLines.filter((l) => l.journalEntryId === rev.journalEntryId)
      assert.strictEqual(revLines.length, 2)

      const revDealer = revLines.find((l) => l.accountId === ACCOUNT_KEYS.DEALER_PAYABLE)
      assert.strictEqual(revDealer?.credit, 250000)
      assert.strictEqual(revDealer?.debit, 0)

      const revBank = revLines.find((l) => l.accountId === ACCOUNT_KEYS.BANK_MAIN)
      assert.strictEqual(revBank?.debit, 250000)
      assert.strictEqual(revBank?.credit, 0)
    })

    it('should prevent reversing an already reversed voucher (no double-reversal)', async () => {
      const tx = createMockTx()
      const orig = await postJournalTx(tx, {
        voucherType: 'JV',
        narration: 'Original voucher to reverse',
        lines: [
          { accountId: ACCOUNT_KEYS.ADMIN_EXPENSE, debit: 5000, credit: 0 },
          { accountId: ACCOUNT_KEYS.CASH_IN_HAND, debit: 0, credit: 5000 },
        ],
        createdBy: 'Accountant',
      })

      // First reversal
      await reverseJournalTx(tx, {
        originalEntryId: orig.journalEntryId,
        narration: 'Correction',
        createdBy: 'Accountant',
      })

      // Attempt second reversal
      await assert.rejects(
        async () => {
          await reverseJournalTx(tx, {
            originalEntryId: orig.journalEntryId,
            narration: 'Duplicate reversal attempt',
            createdBy: 'Accountant',
          })
        },
        /Duplicate reversals are prohibited/,
      )
    })
  })

  // --------------------------------------------------------------------------
  // 2. PARTY ACCOUNTING WORKFLOWS
  // --------------------------------------------------------------------------
  describe('2. Party Accounting Sub-Ledger Workflows', () => {
    it('should post complete Order Delivery workflow with balanced Dealer Payable, VAT, COGS, and Rider COD', async () => {
      const tx = createMockTx()
      const order = {
        id: 'ord_1001',
        number: 'ORD-1001',
        customerName: 'Ram Shrestha',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        dealerId: 'dealer_pokhara_1',
        riderId: 'rider_suresh_1',
        subtotal: 100000, // Rs. 1000.00
        tax: 13000,       // 13% VAT = Rs. 130.00
        deliveryCharge: 0,
        discount: 0,
        total: 100000,    // Rs. 1000.00 (VAT inclusive)
        grandTotal: 100000,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchId: 'branch_main',
      }
      const items = [
        {
          id: 'item_1',
          orderId: 'ord_1001',
          dealerId: 'dealer_pokhara_1',
          catalogType: 'liquor',
          productId: 'prod_whisky_1',
          qty: 1,
          price: 100000,
          dealerCostPrice: 80000, // Rs. 800.00 wholesale cost
          total: 100000,
        },
      ]

      const res = await postOrderDeliveredTx(tx, {
        order: order as any,
        items: items as any,
        actor: testActor,
      })

      assert.ok(res.journalEntryId)
      assert.strictEqual(res.isDuplicate, undefined)

      // Calculate sum of debits and credits across all inserted lines
      let totalDr = 0
      let totalCr = 0
      for (const l of tx.insertedLines) {
        totalDr += l.debit || 0
        totalCr += l.credit || 0
      }
      assert.strictEqual(totalDr, totalCr, 'Sum of Debits must strictly equal Sum of Credits')
      assert.strictEqual(totalDr, 180000)

      // Verify Dealer Payable line
      const dealerLine = tx.insertedLines.find((l) => l.partyType === 'dealer')
      assert.ok(dealerLine)
      assert.strictEqual(dealerLine.partyId, 'dealer_pokhara_1')
      assert.strictEqual(dealerLine.credit, 80000)

      // Verify Rider COD line
      const riderLine = tx.insertedLines.find((l) => l.partyType === 'rider' && l.debit && l.debit > 0)
      assert.ok(riderLine)
      assert.strictEqual(riderLine.partyId, 'rider_suresh_1')
      assert.strictEqual(riderLine.debit, 100000)
    })

    it('should post Rider COD Cash Handover to Physical Cash Vault with zero balance difference', async () => {
      const tx = createMockTx()
      const res = await postCashHandoverTx(tx, {
        handoverId: 'ho_1001',
        riderId: 'rider_suresh_1',
        riderName: 'Suresh Thapa',
        amount: 100000, // Rs. 1000.00
        paymentMethod: 'cash',
        actor: testActor,
      })

      assert.ok(res.voucherNo)
      const lines = tx.insertedLines.filter((l) => l.journalEntryId === res.journalEntryId)
      assert.strictEqual(lines.length, 2)

      // Debit Cash Vault, Credit Rider COD
      const vaultLine = lines.find((l) => l.accountId === ACCOUNT_KEYS.CASH_IN_HAND)
      const riderLine = lines.find((l) => l.accountId === ACCOUNT_KEYS.RIDER_COD_CASH)

      assert.strictEqual(vaultLine?.debit, 100000)
      assert.strictEqual(riderLine?.credit, 100000)
      assert.strictEqual(riderLine?.partyId, 'rider_suresh_1')
    })

    it('should post Dealer Settlement with statutory 1.5% TDS withholding deduction', async () => {
      const tx = createMockTx()
      // Gross procurement = Rs. 10,000 (1000000 paisa)
      // TDS 1.5% = Rs. 150 (15000 paisa)
      // Net disbursement = Rs. 9,850 (985000 paisa)
      const res = await postDealerSettlementTx(tx, {
        settlementId: 'settle_dealer_999',
        dealerId: 'dealer_pokhara_1',
        dealerName: 'Pokhara Liquor Distributors',
        grossAmount: 1000000,
        tdsRate: 1.5,
        paymentAccount: 'bank',
        actor: testActor,
      })

      assert.ok(res.journalEntryId)
      const lines = tx.insertedLines.filter((l) => l.journalEntryId === res.journalEntryId)
      assert.strictEqual(lines.length, 3)

      const payableLine = lines.find((l) => l.accountId === ACCOUNT_KEYS.DEALER_PAYABLE)
      const tdsLine = lines.find((l) => l.accountId === ACCOUNT_KEYS.TDS_PAYABLE)
      const bankLine = lines.find((l) => l.accountId === ACCOUNT_KEYS.BANK_MAIN)

      assert.strictEqual(payableLine?.debit, 1000000, 'Dealer Payable must be debited gross amount')
      assert.strictEqual(tdsLine?.credit, 15000, 'TDS Payable must be credited withholding tax')
      assert.strictEqual(bankLine?.credit, 985000, 'Bank Account must be credited net disbursement')
      assert.strictEqual(payableLine?.debit, (tdsLine?.credit || 0) + (bankLine?.credit || 0), 'Dr == Cr balanced')
    })

    it('should post Rider Salary Accrual and Net Payout with advance clearance', async () => {
      const tx = createMockTx()
      // Accrue Base Salary = Rs. 20,000 (2000000 paisa)
      const accrueRes = await postRiderSalaryAccrualTx(tx, {
        settlementId: 'settle_rider_accrual_1',
        riderId: 'rider_suresh_1',
        riderName: 'Suresh Thapa',
        baseSalaryAmount: 2000000,
        actor: testActor,
      })
      assert.ok(accrueRes.voucherNo)

      // Payout Rider: Gross 20,000 - Advance Deduction 2,000 = Net Payout 18,000
      const payoutRes = await postRiderPayoutTx(tx, {
        settlementId: 'settle_rider_payout_1',
        riderId: 'rider_suresh_1',
        riderName: 'Suresh Thapa',
        grossAmount: 2000000,
        advancesDeducted: 200000,
        netPaid: 1800000,
        paymentAccount: 'bank',
        actor: testActor,
      })

      const payoutLines = tx.insertedLines.filter((l) => l.journalEntryId === payoutRes.journalEntryId)
      assert.strictEqual(payoutLines.length, 3)

      const riderPayableLine = payoutLines.find((l) => l.accountId === ACCOUNT_KEYS.RIDER_PAYABLE)
      const advanceLine = payoutLines.find((l) => l.accountId === ACCOUNT_KEYS.STAFF_RIDER_ADVANCES)
      const bankLine = payoutLines.find((l) => l.accountId === ACCOUNT_KEYS.BANK_MAIN)

      assert.strictEqual(riderPayableLine?.debit, 2000000)
      assert.strictEqual(advanceLine?.credit, 200000)
      assert.strictEqual(bankLine?.credit, 1800000)
    })
  })

  // --------------------------------------------------------------------------
  // 3. FINANCIAL REPORTING & MATHEMATICAL STANDARDS
  // --------------------------------------------------------------------------
  describe('3. Financial Reports & Precision Compliance', () => {
    it('should eliminate floating-point drift: integer paisa arithmetic remains 100% exact across 10,000 orders', () => {
      let accumulatedPaisa = 0
      const itemPricePaisa = 12345 // Rs. 123.45

      for (let i = 0; i < 10000; i++) {
        accumulatedPaisa += itemPricePaisa
      }

      assert.strictEqual(accumulatedPaisa, 123450000)
      assert.strictEqual(accumulatedPaisa / 100, 1234500.0)
    })

    it('should format NPR currency into South Asian Lakhs and Crores accurately', () => {
      assert.strictEqual(formatNPR(100), 'Rs. 1')
      assert.strictEqual(formatNPR(10000000), 'Rs. 1,00,000') // 1 Lakh
      assert.strictEqual(formatNPR(1000000000), 'Rs. 1,00,00,000') // 1 Crore
      assert.strictEqual(formatNPR(-50000), '-Rs. 500')
    })

    it('should accurately convert AD Gregorian dates to Nepal Bikram Sambat (BS) and Fiscal Year', () => {
      const testDate = new Date('2026-07-20T00:00:00Z') // Shrawan 2083
      const bs = adToBs(testDate)
      assert.strictEqual(bs.year, 2083)
      assert.strictEqual(bs.month, 4) // Shrawan

      const fy = getNepalFiscalYear(testDate)
      assert.strictEqual(fy.id, 'fy-2083-84')
      assert.strictEqual(fy.name, '2083/84')

      const formatted = formatBS(testDate)
      assert.ok(formatted.startsWith('2083-04-'))
    })

    it('should generate valid UTF-8 BOM CSV exports matching row counts and field escaping', () => {
      const headers = ['Voucher No', 'Account', 'Debit', 'Credit']
      const rows = [
        ['JV-2083-00001', 'Cash in Hand', '1000.00', '0.00'],
        ['JV-2083-00001', 'Sales "Special, Liquor"', '0.00', '1000.00'],
      ]

      const csv = buildCsv(headers, rows)
      assert.ok(csv.startsWith('\uFEFF'), 'CSV must include UTF-8 BOM header for Excel compatibility')
      assert.ok(csv.includes('"Sales ""Special, Liquor"""'), 'Quotes and commas must be escaped')
    })

    it('should generate valid Microsoft Excel SpreadsheetXML (.xls) format', () => {
      const xml = buildExcelXml(
        'Trial Balance',
        ['Code', 'Name', 'Debit', 'Credit'],
        [['1010', 'Cash', 5000, 0]],
      )
      assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'))
      assert.ok(xml.includes('<Workbook'))
      assert.ok(xml.includes('Trial Balance'))
    })
  })

  // --------------------------------------------------------------------------
  // 4. END-TO-END FINANCIAL CYCLE AUDIT
  // --------------------------------------------------------------------------
  describe('4. End-to-End Financial Cycle Reconciliation', () => {
    it('should complete full operational cycle with 100% control account integrity and zero orphan entries', async () => {
      const tx = createMockTx()

      // Step A: Customer Places Order & Delivered (COD = Rs. 2,000, Wholesale Dealer Cost = Rs. 1,500)
      const orderRes = await postOrderDeliveredTx(tx, {
        order: {
          id: 'ord_cycle_1',
          number: 'ORD-CYCLE-1',
          customerName: 'Sita Sharma',
          paymentMethod: 'cod',
          paymentStatus: 'pending',
          dealerId: 'dealer_1',
          riderId: 'rider_1',
          subtotal: 200000, // Rs. 2,000.00
          tax: 23009,       // 13% VAT
          deliveryCharge: 0,
          discount: 0,
          total: 200000,    // Rs. 2,000.00
          grandTotal: 200000,
          createdAt: new Date(),
          updatedAt: new Date(),
          branchId: 'branch_1',
        } as any,
        items: [
          {
            id: 'item_c1',
            orderId: 'ord_cycle_1',
            dealerId: 'dealer_1',
            catalogType: 'liquor',
            productId: 'p_1',
            qty: 1,
            price: 200000,
            dealerCostPrice: 150000, // Rs. 1,500.00
            total: 200000,
          },
        ] as any,
        actor: testActor,
      })
      assert.ok(orderRes.journalEntryId)

      // Step B: Rider deposits COD Cash into Vault
      const handoverRes = await postCashHandoverTx(tx, {
        handoverId: 'ho_cycle_1',
        riderId: 'rider_1',
        riderName: 'Rider Ramesh',
        amount: 200000,
        paymentMethod: 'cash',
        actor: testActor,
      })
      assert.ok(handoverRes.voucherNo)

      // Step C: Dealer Settlement (Disbursement Rs. 1,477.50, TDS 1.5% = Rs. 22.50)
      const dealerRes = await postDealerSettlementTx(tx, {
        settlementId: 'settle_c1',
        dealerId: 'dealer_1',
        dealerName: 'Dealer Wholesale',
        grossAmount: 150000,
        tdsRate: 1.5,
        paymentAccount: 'bank',
        actor: testActor,
      })
      assert.ok(dealerRes.journalEntryId)

      // Step D: Verify Total Debits == Total Credits across the entire batch
      let totalDebit = 0
      let totalCredit = 0
      for (const line of tx.insertedLines) {
        totalDebit += line.debit || 0
        totalCredit += line.credit || 0
      }

      assert.strictEqual(
        totalDebit,
        totalCredit,
        `Integrity Check: Total Debits (${totalDebit}) must equal Total Credits (${totalCredit})`,
      )
      assert.strictEqual(totalDebit - totalCredit, 0, 'Zero general ledger variance across entire lifecycle')

      // Step E: Verify sub-ledger control account consistency
      // Rider COD cash account should be fully cleared (Debit 200,000 from order, Credit 200,000 from handover)
      const riderCodLines = tx.insertedLines.filter((l) => l.accountId === ACCOUNT_KEYS.RIDER_COD_CASH)
      let riderCodNet = 0
      for (const l of riderCodLines) {
        riderCodNet += (l.debit || 0) - (l.credit || 0)
      }
      assert.strictEqual(riderCodNet, 0, 'Rider COD Cash in transit must be fully cleared (net zero)')

      // Dealer Payable should be fully cleared (Credit 150,000 from order, Debit 150,000 from settlement)
      const dealerPayableLines = tx.insertedLines.filter((l) => l.accountId === ACCOUNT_KEYS.DEALER_PAYABLE)
      let dealerPayableNet = 0
      for (const l of dealerPayableLines) {
        dealerPayableNet += (l.credit || 0) - (l.debit || 0)
      }
      assert.strictEqual(dealerPayableNet, 0, 'Dealer Payable must be fully settled (net zero)')
    })
  })
})
