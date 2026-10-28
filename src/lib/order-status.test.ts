import { describe, it, expect } from 'bun:test'
import {
  validateOrderTransition,
  getAvailableOrderTransitions,
  OrderTransitionError,
} from './order-status'
import type { Order } from '#/server/operations/types'

type MockOrder = Pick<
  Order,
  | 'id'
  | 'status'
  | 'customerId'
  | 'riderId'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'isLegacy'
  | 'deliveryOtp'
> & {
  items: Array<{
    id: string
    dealerId: string | null
    catalogType: 'liquor' | 'grocery'
  }>
}

function createOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  return {
    id: 'ord_test_01',
    status: 'pending',
    customerId: 'cust_01',
    riderId: null,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    isLegacy: false,
    deliveryOtp: '4821',
    items: [
      { id: 'item_1', dealerId: 'dlr_01', catalogType: 'liquor' },
      { id: 'item_2', dealerId: 'dlr_02', catalogType: 'grocery' },
    ],
    ...overrides,
  }
}

const adminUser = { id: 'admin_1', role: 'admin' as const, name: 'Admin User' }
const managerUser = {
  id: 'mgr_1',
  role: 'manager' as const,
  name: 'Manager User',
}
const riderUser = { id: 'rider_1', role: 'rider' as const, name: 'Rider Ram' }
const otherRider = {
  id: 'rider_2',
  role: 'rider' as const,
  name: 'Rider Shyam',
}
const customerUser = {
  id: 'cust_01',
  role: 'customer' as const,
  name: 'Customer Hari',
}
const otherCustomer = {
  id: 'cust_02',
  role: 'customer' as const,
  name: 'Customer Gita',
}

describe('Order State Machine (Module 1)', () => {
  describe('Happy Path Full Lifecycle', () => {
    it('traverses the full valid lifecycle from pending to delivered', () => {
      let order = createOrder({ status: 'pending' })

      // 1. Manager confirms order
      expect(validateOrderTransition(order, 'confirmed', managerUser)).toEqual({
        ok: true,
        noop: false,
      })
      order = { ...order, status: 'confirmed' }

      // 2. Manager assigns dealers
      expect(
        validateOrderTransition(order, 'dealer_assigned', managerUser),
      ).toEqual({
        ok: true,
        noop: false,
      })
      order = { ...order, status: 'dealer_assigned' }

      // 3. Manager assigns rider
      expect(
        validateOrderTransition(order, 'rider_assigned', managerUser, {
          riderId: 'rider_1',
        }),
      ).toEqual({ ok: true, noop: false })
      order = { ...order, status: 'rider_assigned', riderId: 'rider_1' }

      // 4. Rider marks picked up at dealer
      expect(validateOrderTransition(order, 'picked_up', riderUser)).toEqual({
        ok: true,
        noop: false,
      })
      order = { ...order, status: 'picked_up' }

      // 5. Rider departs out for delivery
      expect(
        validateOrderTransition(order, 'out_for_delivery', riderUser),
      ).toEqual({
        ok: true,
        noop: false,
      })
      order = { ...order, status: 'out_for_delivery' }

      // 6. Rider marks delivered with age verification (liquor)
      expect(
        validateOrderTransition(order, 'delivered', riderUser, {
          ageVerifiedAtDelivery: true,
        }),
      ).toEqual({ ok: true, noop: false })
      order = { ...order, status: 'delivered' }

      // 7. Terminal check: delivered cannot transition to anything
      expect(() =>
        validateOrderTransition(order, 'returned', adminUser),
      ).toThrow(OrderTransitionError)
      expect(() =>
        validateOrderTransition(order, 'cancelled', adminUser),
      ).toThrow(OrderTransitionError)
    })
  })

  describe('Delivery Failure and Reschedule / Return', () => {
    it('allows rider to mark delivery failed with reason and reschedule', () => {
      let order = createOrder({
        status: 'out_for_delivery',
        riderId: 'rider_1',
      })

      // Must provide failure reason
      expect(() =>
        validateOrderTransition(order, 'delivery_failed', riderUser, {
          deliveryFailureReason: '',
        }),
      ).toThrow(OrderTransitionError)

      expect(
        validateOrderTransition(order, 'delivery_failed', riderUser, {
          deliveryFailureReason: 'Customer phone unreachable',
        }),
      ).toEqual({ ok: true, noop: false })
      order = { ...order, status: 'delivery_failed' }

      // Reschedule delivery
      expect(
        validateOrderTransition(order, 'out_for_delivery', managerUser),
      ).toEqual({
        ok: true,
        noop: false,
      })

      // Or return goods to dealer
      expect(validateOrderTransition(order, 'returned', managerUser)).toEqual({
        ok: true,
        noop: false,
      })
    })

    it('allows marking delivery failed directly from picked_up if customer unreachable', () => {
      const order = createOrder({
        status: 'picked_up',
        riderId: 'rider_1',
      })
      expect(
        validateOrderTransition(order, 'delivery_failed', riderUser, {
          deliveryFailureReason: 'Customer cancelled by phone before departure',
        }),
      ).toEqual({ ok: true, noop: false })
    })
  })

  describe('Cancellation Rules by Role', () => {
    it('allows customer to cancel own order while pending or confirmed', () => {
      const pendingOrder = createOrder({
        status: 'pending',
        customerId: 'cust_01',
      })
      expect(
        validateOrderTransition(pendingOrder, 'cancelled', customerUser),
      ).toEqual({
        ok: true,
        noop: false,
      })

      const confirmedOrder = createOrder({
        status: 'confirmed',
        customerId: 'cust_01',
      })
      expect(
        validateOrderTransition(confirmedOrder, 'cancelled', customerUser),
      ).toEqual({
        ok: true,
        noop: false,
      })
    })

    it('rejects customer cancellation of another customers order', () => {
      const pendingOrder = createOrder({
        status: 'pending',
        customerId: 'cust_01',
      })
      expect(() =>
        validateOrderTransition(pendingOrder, 'cancelled', otherCustomer),
      ).toThrow(OrderTransitionError)
    })

    it('rejects customer cancellation once dealer is assigned', () => {
      const assignedOrder = createOrder({
        status: 'dealer_assigned',
        customerId: 'cust_01',
      })
      expect(() =>
        validateOrderTransition(assignedOrder, 'cancelled', customerUser),
      ).toThrow(OrderTransitionError)
    })

    it('allows manager to cancel up to rider_assigned', () => {
      const order = createOrder({
        status: 'rider_assigned',
        riderId: 'rider_1',
      })
      expect(validateOrderTransition(order, 'cancelled', managerUser)).toEqual({
        ok: true,
        noop: false,
      })
    })

    it('rejects manager cancellation after picked_up; allows admin ONLY with explicit reason', () => {
      const order = createOrder({ status: 'picked_up', riderId: 'rider_1' })

      // Manager cannot cancel
      expect(() =>
        validateOrderTransition(order, 'cancelled', managerUser),
      ).toThrow(OrderTransitionError)

      // Admin without reason cannot cancel
      expect(() =>
        validateOrderTransition(order, 'cancelled', adminUser, {
          cancellationReason: '',
        }),
      ).toThrow(OrderTransitionError)

      // Admin with reason CAN cancel
      expect(
        validateOrderTransition(order, 'cancelled', adminUser, {
          cancellationReason:
            'Accidental duplicate dispatch verified by manager',
        }),
      ).toEqual({ ok: true, noop: false })
    })
  })

  describe('Ownership and Role Security', () => {
    it('rejects rider action on an order assigned to another rider', () => {
      const order = createOrder({
        status: 'rider_assigned',
        riderId: 'rider_1',
      })
      expect(() =>
        validateOrderTransition(order, 'picked_up', otherRider),
      ).toThrow(OrderTransitionError)
    })

    it('rejects customers confirming or assigning orders', () => {
      const order = createOrder({ status: 'pending' })
      expect(() =>
        validateOrderTransition(order, 'confirmed', customerUser),
      ).toThrow(OrderTransitionError)
    })
  })

  describe('Dealer Assignment & Legacy Exemption', () => {
    it('rejects dealer_assigned if any item has no dealer assigned', () => {
      const order = createOrder({
        status: 'confirmed',
        items: [
          { id: 'i1', dealerId: 'dlr_1', catalogType: 'liquor' },
          { id: 'i2', dealerId: null, catalogType: 'grocery' },
        ],
      })
      expect(() =>
        validateOrderTransition(order, 'dealer_assigned', managerUser),
      ).toThrow(OrderTransitionError)
    })

    it('allows legacy orders to bypass dealer_assigned directly to rider_assigned', () => {
      const legacyOrder = createOrder({
        status: 'confirmed',
        isLegacy: true,
        items: [{ id: 'i1', dealerId: null, catalogType: 'liquor' }],
      })
      expect(
        validateOrderTransition(legacyOrder, 'rider_assigned', managerUser, {
          riderId: 'rider_1',
        }),
      ).toEqual({ ok: true, noop: false })
    })
  })

  describe('Online eSewa Unpaid Restrictions', () => {
    it('blocks unpaid eSewa orders from moving past pending without admin override', () => {
      const unpaidOrder = createOrder({
        status: 'pending',
        paymentMethod: 'esewa',
        paymentStatus: 'pending',
      })

      // Manager cannot confirm
      expect(() =>
        validateOrderTransition(unpaidOrder, 'confirmed', managerUser),
      ).toThrow(OrderTransitionError)

      // Admin without reason cannot confirm
      expect(() =>
        validateOrderTransition(unpaidOrder, 'confirmed', adminUser),
      ).toThrow(OrderTransitionError)

      // Admin with override reason CAN confirm
      expect(
        validateOrderTransition(unpaidOrder, 'confirmed', adminUser, {
          adminPaymentOverrideReason: 'Manual bank slip verified via WhatsApp',
        }),
      ).toEqual({ ok: true, noop: false })
    })
  })

  describe('Idempotency', () => {
    it('returns noop: true when transitioning to the current status', () => {
      const order = createOrder({ status: 'confirmed' })
      expect(validateOrderTransition(order, 'confirmed', managerUser)).toEqual({
        ok: true,
        noop: true,
      })
    })
  })

  describe('Rider COD Cash Limit & Manager Override', () => {
    it('blocks assigning new COD order when rider has reached or exceeded the cash limit', () => {
      const codOrder = createOrder({
        status: 'dealer_assigned',
        paymentMethod: 'cod',
        riderId: null,
      })

      // Rider has Rs. 21,000 on hand, limit is Rs. 20,000 (2,000,000 paisa)
      expect(() =>
        validateOrderTransition(codOrder, 'rider_assigned', managerUser, {
          riderId: 'rider_01',
          riderCashOnHand: 2100000,
          riderCodLimit: 2000000,
        }),
      ).toThrow(OrderTransitionError)
    })

    it('allows assigning online-paid orders (e.g. eSewa) even if rider cash limit is exceeded', () => {
      const onlineOrder = createOrder({
        status: 'dealer_assigned',
        paymentMethod: 'esewa',
        paymentStatus: 'paid',
        riderId: null,
      })

      expect(
        validateOrderTransition(onlineOrder, 'rider_assigned', managerUser, {
          riderId: 'rider_01',
          riderCashOnHand: 2500000,
          riderCodLimit: 2000000,
        }),
      ).toEqual({ ok: true, noop: false })
    })

    it('allows manager or admin to assign COD order with explicit override reason when limit is exceeded', () => {
      const codOrder = createOrder({
        status: 'dealer_assigned',
        paymentMethod: 'cod',
        riderId: null,
      })

      expect(
        validateOrderTransition(codOrder, 'rider_assigned', managerUser, {
          riderId: 'rider_01',
          riderCashOnHand: 2200000,
          riderCodLimit: 2000000,
          overrideRiderCashLimit: true,
          riderCashOverrideReason:
            'Rush hour dispatch authorized by duty manager',
        }),
      ).toEqual({ ok: true, noop: false })
    })
  })

  describe('Proof of Delivery & Customer OTP Verification', () => {
    it('accepts delivery transition when customer OTP matches', () => {
      const order = createOrder({
        status: 'out_for_delivery',
        riderId: 'rider_1',
        deliveryOtp: '4821',
      })

      const res = validateOrderTransition(order, 'delivered', riderUser, {
        ageVerifiedAtDelivery: true,
        deliveryOtp: '4821',
      })
      expect(res).toEqual({ ok: true, noop: false })
    })

    it('rejects delivery transition when customer OTP does not match', () => {
      const order = createOrder({
        status: 'out_for_delivery',
        riderId: 'rider_1',
        deliveryOtp: '4821',
      })

      expect(() =>
        validateOrderTransition(order, 'delivered', riderUser, {
          ageVerifiedAtDelivery: true,
          deliveryOtp: '9999',
        }),
      ).toThrow(OrderTransitionError)
    })

    it('allows delivery transition with photo proof', () => {
      const order = createOrder({
        status: 'out_for_delivery',
        riderId: 'rider_1',
        deliveryOtp: '4821',
      })

      const res = validateOrderTransition(order, 'delivered', riderUser, {
        ageVerifiedAtDelivery: true,
        proofPhotoUrl: 'https://storage.mezmani.com/delivery-proof/test.jpg',
      })
      expect(res).toEqual({ ok: true, noop: false })
    })
  })

  describe('getAvailableOrderTransitions', () => {
    it('returns correct candidate list for pending order as customer', () => {
      const order = createOrder({ status: 'pending', customerId: 'cust_01' })
      const transitions = getAvailableOrderTransitions(order, customerUser)
      expect(transitions).toEqual(['cancelled'])
    })

    it('returns confirmed and cancelled for pending order as manager', () => {
      const order = createOrder({ status: 'pending' })
      const transitions = getAvailableOrderTransitions(order, managerUser)
      expect(transitions).toContain('confirmed')
      expect(transitions).toContain('cancelled')
    })
  })
})
