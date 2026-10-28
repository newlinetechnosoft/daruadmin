import { describe, expect, it } from 'bun:test'
import type {
  TopProductMetric,
  SlowMoverMetric,
  MostUnavailableMetric,
  DealerSubstitutionMetric,
} from './sourcing-intelligence.queries'

describe('Product Velocity & Sourcing Intelligence Metrics', () => {
  describe('Top Products Metrics', () => {
    it('accurately ranks products by gross revenue and computes margin percentage', () => {
      const prods: TopProductMetric[] = [
        {
          productId: 'p_beer',
          name: 'Gorkha Strong 650ml',
          catalogType: 'liquor',
          unitsSold: 20,
          ordersCount: 10,
          grossRevenue: 700000, // Rs. 7,000
          totalDealerCost: 560000, // Rs. 5,600
          grossProfit: 140000, // Rs. 1,400
          marginPercent: 20.0,
          avgSellingPrice: 35000, // Rs. 350
        },
        {
          productId: 'p_whisky',
          name: 'Old Durbar 750ml',
          catalogType: 'liquor',
          unitsSold: 10,
          ordersCount: 8,
          grossRevenue: 2800000, // Rs. 28,000
          totalDealerCost: 2240000, // Rs. 22,400
          grossProfit: 560000, // Rs. 5,600
          marginPercent: 20.0,
          avgSellingPrice: 280000, // Rs. 2,800
        },
      ]

      prods.sort((a, b) => b.grossRevenue - a.grossRevenue)

      expect(prods[0].name).toBe('Old Durbar 750ml')
      expect(prods[0].grossProfit).toBe(560000)
      expect(prods[0].marginPercent).toBe(20.0)
      expect(prods[1].name).toBe('Gorkha Strong 650ml')
    })
  })

  describe('Slow Movers & Dead Stock Risk', () => {
    it('distinguishes between zero sales (dead stock risk) and slow moving items', () => {
      const items: SlowMoverMetric[] = [
        {
          productId: 'p_tonic',
          name: 'Himalayan Tonic Water',
          catalogType: 'grocery',
          categoryName: 'Mixers',
          unitsSold: 0,
          grossRevenue: 0,
          lastOrderDate: null,
          daysSinceLastOrder: null,
          dealerCarryingCount: 3,
          basePrice: 12000,
          status: 'zero_sales',
        },
        {
          productId: 'p_gin',
          name: 'Snowman Gin 750ml',
          catalogType: 'liquor',
          categoryName: 'Gin',
          unitsSold: 1,
          grossRevenue: 250000,
          lastOrderDate: '2026-09-01T00:00:00Z',
          daysSinceLastOrder: 45,
          dealerCarryingCount: 2,
          basePrice: 250000,
          status: 'slow_mover',
        },
      ]

      expect(items[0].status).toBe('zero_sales')
      expect(items[0].daysSinceLastOrder).toBeNull()
      expect(items[1].status).toBe('slow_mover')
      expect(items[1].daysSinceLastOrder).toBe(45)
    })
  })

  describe('Most-Unavailable Items Analysis', () => {
    it('calculates unavailability rate accurately from requested and unavailable counts', () => {
      const unavailableItems: MostUnavailableMetric[] = [
        {
          productId: 'p_khukri_spiced',
          name: 'Khukri Spiced Rum 750ml',
          catalogType: 'liquor',
          totalRequested: 20,
          unavailableCount: 5,
          fulfilledCount: 15,
          unavailabilityRatePercent: Math.round((5 / 20) * 100),
          affectedDealerNames: ['Milan Chowk Wines', 'Traffic Chowk Liquors'],
        },
        {
          productId: 'p_tuborg',
          name: 'Tuborg Can 500ml',
          catalogType: 'liquor',
          totalRequested: 10,
          unavailableCount: 8,
          fulfilledCount: 2,
          unavailabilityRatePercent: Math.round((8 / 10) * 100),
          affectedDealerNames: ['Golpark Cold Store'],
        },
      ]

      expect(unavailableItems[0].unavailabilityRatePercent).toBe(25)
      expect(unavailableItems[1].unavailabilityRatePercent).toBe(80)
      expect(unavailableItems[0].affectedDealerNames.length).toBe(2)
    })
  })

  describe('Dealer Substitution Rate & Severity Grading', () => {
    it('computes dealer substitution rate and assigns correct severity alerts', () => {
      const dealers: DealerSubstitutionMetric[] = [
        {
          dealerId: 'dlr_1',
          dealerName: 'Reliable Spirits Hub',
          contact: '+9779811111111',
          city: 'Butwal',
          totalAssigned: 50,
          fulfilled: 49,
          substituted: 1,
          substitutionRatePercent: Math.round((1 / 50) * 100), // 2%
          fulfilmentRatePercent: 98,
          severity: 'low',
        },
        {
          dealerId: 'dlr_2',
          dealerName: 'Chowk Liquor Center',
          contact: '+9779822222222',
          city: 'Tilottama',
          totalAssigned: 20,
          fulfilled: 18,
          substituted: 2,
          substitutionRatePercent: Math.round((2 / 20) * 100), // 10%
          fulfilmentRatePercent: 90,
          severity: 'moderate',
        },
        {
          dealerId: 'dlr_3',
          dealerName: 'Unstable Drinks Store',
          contact: '+9779833333333',
          city: 'Siddharthanagar',
          totalAssigned: 25,
          fulfilled: 18,
          substituted: 7,
          substitutionRatePercent: Math.round((7 / 25) * 100), // 28%
          fulfilmentRatePercent: 72,
          severity: 'high',
        },
      ]

      expect(dealers[0].severity).toBe('low')
      expect(dealers[0].substitutionRatePercent).toBe(2)
      expect(dealers[1].severity).toBe('moderate')
      expect(dealers[1].substitutionRatePercent).toBe(10)
      expect(dealers[2].severity).toBe('high')
      expect(dealers[2].substitutionRatePercent).toBe(28)

      // Network Aggregation
      const totalAssigned = dealers.reduce((s, d) => s + d.totalAssigned, 0)
      const totalSubstituted = dealers.reduce((s, d) => s + d.substituted, 0)
      const networkRate = Math.round((totalSubstituted / totalAssigned) * 100)

      expect(totalAssigned).toBe(95)
      expect(totalSubstituted).toBe(10)
      expect(networkRate).toBe(11) // 10/95 ~ 11%
    })
  })
})
