import { describe, expect, it } from 'bun:test'
import { calculateOrderMargins } from './order.queries'
import type { Order } from '#/server/operations/types'

describe('Order Sourcing, Margin & Logistics Intelligence', () => {
  const dummyOrder: Order = {
    id: 'ord_test_01',
    number: 'ORD-10055',
    customerId: 'usr_c1',
    customerName: 'Aarav Sharma',
    customerEmail: 'aarav@example.com',
    customerPhone: '+9779812345678',
    address: 'Golpark, Butwal',
    city: 'Butwal',
    landmark: 'Near petrol pump',
    lat: 27.705,
    lng: 83.45,
    status: 'confirmed',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    subtotal: 500000, // Rs. 5,000 (500,000 paisa)
    deliveryCharge: 0,
    discount: 50000, // Rs. 500 discount
    tax: 51770,
    total: 450000, // Rs. 4,500 total
    riderId: null,
    trackingCode: 'TRK998877',
    notes: '',
    items: [
      {
        id: 'oi_1',
        catalogType: 'liquor',
        productId: 'p_rum',
        variantId: 'v_rum_750',
        name: 'Khukri XXX Rum',
        variantName: '750ml',
        sku: 'RUM-750',
        qty: 2,
        unitPrice: 150000, // Rs. 1,500 each
        lineTotal: 300000, // Rs. 3,000
        dealerId: 'dlr_1',
        dealerCostPrice: 120000, // Rs. 1,200 dealer cost (Rs. 300 margin per bottle)
        actualDealerCostPrice: null,
        sourcingStatus: 'assigned',
      },
      {
        id: 'oi_2',
        catalogType: 'grocery',
        productId: 'p_chips',
        variantId: 'v_chips_100',
        name: 'Lays Magic Masala',
        variantName: '100g',
        sku: 'CHIPS-100',
        qty: 4,
        unitPrice: 50000, // Rs. 500 each
        lineTotal: 200000, // Rs. 2,000
        dealerId: 'dlr_2',
        dealerCostPrice: 35000, // Rs. 350 dealer cost (Rs. 150 margin per packet)
        actualDealerCostPrice: null,
        sourcingStatus: 'assigned',
      },
    ],
    events: [],
    couponCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  it('calculates item-level profit and gross margin percentage correctly', () => {
    const margins = calculateOrderMargins(dummyOrder)

    expect(margins.items.length).toBe(2)

    // Item 1: Khukri Rum
    // 2 * Rs. 1,500 = Rs. 3,000. Dealer cost: 2 * Rs. 1,200 = Rs. 2,400. Profit: Rs. 600 (60,000 paisa).
    // Margin % = (600 / 3000) * 100 = 20.0%
    const item1 = margins.items[0]
    expect(item1.totalDealerCost).toBe(240000)
    expect(item1.grossProfit).toBe(60000)
    expect(item1.marginPercent).toBe(20.0)

    // Item 2: Lays Chips
    // 4 * Rs. 500 = Rs. 2,000. Dealer cost: 4 * Rs. 350 = Rs. 1,400. Profit: Rs. 600 (60,000 paisa).
    // Margin % = (600 / 2000) * 100 = 30.0%
    const item2 = margins.items[1]
    expect(item2.totalDealerCost).toBe(140000)
    expect(item2.grossProfit).toBe(60000)
    expect(item2.marginPercent).toBe(30.0)
  })

  it('calculates order-level net revenue, total dealer cost, gross profit, and overall margin %', () => {
    const margins = calculateOrderMargins(dummyOrder)

    // Total dealer cost: 240,000 + 140,000 = 380,000 paisa (Rs. 3,800)
    expect(margins.totalDealerCost).toBe(380000)

    // Net merchandise revenue = Subtotal (500,000) - Discount (50,000) = 450,000 paisa (Rs. 4,500)
    expect(margins.netMerchandiseRevenue).toBe(450000)

    // Order gross profit = 450,000 - 380,000 = 70,000 paisa (Rs. 700)
    expect(margins.grossProfit).toBe(70000)

    // Margin % = (70,000 / 450,000) * 100 ≈ 15.6%
    expect(margins.marginPercent).toBeCloseTo(15.6, 1)
  })

  it('handles orders with zero dealer costs or missing costs gracefully without division by zero', () => {
    const zeroCostOrder: Order = {
      ...dummyOrder,
      items: [
        {
          ...dummyOrder.items[0],
          dealerCostPrice: null,
          lineTotal: 0,
        },
      ],
      subtotal: 0,
      discount: 0,
      total: 0,
    }

    const margins = calculateOrderMargins(zeroCostOrder)
    expect(margins.totalDealerCost).toBe(0)
    expect(margins.grossProfit).toBe(0)
    expect(margins.marginPercent).toBe(0)
    expect(margins.items[0].marginPercent).toBe(0)
  })
})
