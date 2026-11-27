import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isOrderConfirmed, getOrderInvoiceNumber } from './order-status.ts'

describe('Order Confirmation & Tax Invoice Generation Rules', () => {
  describe('isOrderConfirmed', () => {
    it('identifies pending orders as not confirmed (no invoice generation)', () => {
      assert.strictEqual(isOrderConfirmed('pending'), false)
    })

    it('identifies cancelled orders as not confirmed / voided', () => {
      assert.strictEqual(isOrderConfirmed('cancelled'), false)
    })

    it('identifies confirmed order statuses as confirmed', () => {
      assert.strictEqual(isOrderConfirmed('confirmed'), true)
      assert.strictEqual(isOrderConfirmed('dealer_assigned'), true)
      assert.strictEqual(isOrderConfirmed('rider_assigned'), true)
      assert.strictEqual(isOrderConfirmed('picked_up'), true)
      assert.strictEqual(isOrderConfirmed('out_for_delivery'), true)
      assert.strictEqual(isOrderConfirmed('delivered'), true)
    })
  })

  describe('getOrderInvoiceNumber', () => {
    it('returns null for pending orders: invoice number is NOT generated until confirmed', () => {
      const pendingOrder = {
        number: 'MZ-10042',
        status: 'pending',
      }
      const invoiceNo = getOrderInvoiceNumber(pendingOrder)
      assert.strictEqual(invoiceNo, null)
    })

    it('returns null for cancelled orders: no tax invoice is generated or issued', () => {
      const cancelledOrder = {
        number: 'MZ-10043',
        status: 'cancelled',
      }
      const invoiceNo = getOrderInvoiceNumber(cancelledOrder)
      assert.strictEqual(invoiceNo, null)
    })

    it('generates official invoice number after admin or manager confirms order', () => {
      const confirmedOrder = {
        number: 'MZ-10042',
        status: 'confirmed',
      }
      const invoiceNo = getOrderInvoiceNumber(confirmedOrder)
      assert.strictEqual(invoiceNo, 'MEZ-INV-10042')
    })

    it('generates official invoice number with custom prefix from settings', () => {
      const confirmedOrder = {
        number: 'ORD-98765',
        status: 'confirmed',
      }
      const invoiceNo = getOrderInvoiceNumber(confirmedOrder, 'MZ-')
      assert.strictEqual(invoiceNo, 'MZ-98765')
    })

    it('preserves invoice number across subsequent operational stages after confirmation', () => {
      const operationalStatuses = [
        'confirmed',
        'dealer_assigned',
        'rider_assigned',
        'picked_up',
        'out_for_delivery',
        'delivered',
      ]

      for (const status of operationalStatuses) {
        const order = { number: 'MZ-10099', status }
        assert.strictEqual(
          getOrderInvoiceNumber(order, 'MEZ-INV-'),
          'MEZ-INV-10099',
          `Invoice should be generated for status: ${status}`,
        )
      }
    })
  })
})
