import { describe, expect, it } from 'bun:test'
import {
  postJournalTx,
  postOrderDeliveredTx,
  postCashHandoverTx,
  postDealerSettlementTx,
} from './double-entry'
import type { Order, OrderItem } from '#/server/operations/types'

describe('Double-Entry Accounting Core (Module 3)', () => {
  // Mock transaction object
  function createMockTx() {
    const insertedHeaders: any[] = []
    const insertedLines: any[] = []
    let seqNo = 0

    return {
      insertedHeaders,
      insertedLines,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }),
      insert: (_table: any) => ({
        values: (val: any) => {
          if (val.voucherNo) {
            insertedHeaders.push(val)
          } else if (val.accountId) {
            insertedLines.push(val)
          }
          const p = Promise.resolve() as any
          p.onConflictDoNothing = () => Promise.resolve()
          return p
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
      execute: () => {
        seqNo++
        return Promise.resolve({
          rows: [],
        })
      },
    }
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
      (s: number, l: any) => s + l.debit,
      0,
    )
    const totalCredit = tx.insertedLines.reduce(
      (s: number, l: any) => s + l.credit,
      0,
    )

    // Verify perfectly balanced
    expect(totalDebit).toBe(totalCredit)

    // Check specific lines:
    // 1. Dr. Rider COD Cash: 354000
    const riderCashLine = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_1031',
    )
    expect(riderCashLine?.debit).toBe(354000)
    expect(riderCashLine?.partyId).toBe('rider_01')

    // 2. Cr. Sales Revenue: 300000
    const salesLine = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_4010',
    )
    expect(salesLine?.credit).toBe(300000)

    // 3. Cr. VAT Output Payable: 39000
    const vatLine = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_2021',
    )
    expect(vatLine?.credit).toBe(39000)

    // 4. Cr. Delivery Fee Income: 15000
    const deliveryLine = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_4020',
    )
    expect(deliveryLine?.credit).toBe(15000)

    // 5. Dr. COGS Liquor: 280000
    const cogsLine = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_5011',
    )
    expect(cogsLine?.debit).toBe(280000)

    // 6. Cr. Dealer Procurement Payable: 280000
    const dealerLine = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_2011',
    )
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

    const cashDebit = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_1011',
    )
    const riderCredit = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_1031',
    )

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

    const grossDebit = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_2011',
    )
    const bankCredit = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_1012',
    )
    const tdsCredit = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_2023',
    )

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
      (s: number, l: any) => s + l.debit,
      0,
    )
    const totalCredit = tx.insertedLines.reduce(
      (s: number, l: any) => s + l.credit,
      0,
    )
    expect(totalDebit).toBe(totalCredit)

    // Check Rider Expense (acc_5111) and Rider Payable (acc_2031)
    const riderExpense = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_5111',
    )
    const riderPayable = tx.insertedLines.find(
      (l: any) => l.accountId === 'acc_2031',
    )

    expect(riderExpense?.debit).toBe(6500)
    expect(riderExpense?.partyId).toBe('rider_01')
    expect(riderPayable?.credit).toBe(6500)
    expect(riderPayable?.partyId).toBe('rider_01')
  })
})
