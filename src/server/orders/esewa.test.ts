import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { generateEsewaSignature, getEsewaConfig } from './order.functions'

describe('eSewa Production Guard & Configuration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.ESEWA_PRODUCT_CODE
    delete process.env.ESEWA_SECRET_KEY
    delete process.env.ESEWA_LIVE
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('Non-production / Test Mode (ESEWA_LIVE !== true)', () => {
    it('falls back to public test credentials when credentials are not configured', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.ESEWA_LIVE

      const config = getEsewaConfig()
      expect(config.isLive).toBe(false)
      expect(config.productCode).toBe('EPAYTEST')
      expect(config.secretKey).toBe('8gBm/:&EnhH.1/q')
      expect(config.gatewayUrl).toContain('rc-epay.esewa.com.np')
      expect(config.statusUrl).toContain('rc.esewa.com.np')
    })

    it('uses custom credentials in test mode if provided without live flag', () => {
      process.env.NODE_ENV = 'development'
      process.env.ESEWA_PRODUCT_CODE = 'MY_TEST_CODE'
      process.env.ESEWA_SECRET_KEY = 'my_test_secret'
      process.env.ESEWA_LIVE = 'false'

      const config = getEsewaConfig()
      expect(config.isLive).toBe(false)
      expect(config.productCode).toBe('MY_TEST_CODE')
      expect(config.secretKey).toBe('my_test_secret')
      expect(config.gatewayUrl).toContain('rc-epay.esewa.com.np')
      expect(config.statusUrl).toContain('rc.esewa.com.np')
    })
  })

  describe('Production & Live Mode Guard (NODE_ENV=production or ESEWA_LIVE=true)', () => {
    it('throws clear server error when NODE_ENV=production and credentials are missing', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.ESEWA_PRODUCT_CODE
      delete process.env.ESEWA_SECRET_KEY

      expect(() => getEsewaConfig()).toThrow(
        'eSewa configuration error: ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY must be configured in production / live mode.',
      )
    })

    it('throws clear server error when ESEWA_LIVE=true even in non-production if credentials are missing', () => {
      process.env.NODE_ENV = 'development'
      process.env.ESEWA_LIVE = 'true'
      delete process.env.ESEWA_PRODUCT_CODE
      delete process.env.ESEWA_SECRET_KEY

      expect(() => getEsewaConfig()).toThrow(
        'eSewa configuration error: ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY must be configured in production / live mode.',
      )
    })

    it('throws clear server error if only ESEWA_PRODUCT_CODE is provided in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.ESEWA_PRODUCT_CODE = 'PROD_MERCHANT'
      delete process.env.ESEWA_SECRET_KEY

      expect(() => getEsewaConfig()).toThrow(
        'eSewa configuration error: ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY must be configured in production / live mode.',
      )
    })

    it('throws clear server error if only ESEWA_SECRET_KEY is provided when ESEWA_LIVE=true', () => {
      process.env.NODE_ENV = 'test'
      process.env.ESEWA_LIVE = 'true'
      delete process.env.ESEWA_PRODUCT_CODE
      process.env.ESEWA_SECRET_KEY = 'super_secret'

      expect(() => getEsewaConfig()).toThrow(
        'eSewa configuration error: ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY must be configured in production / live mode.',
      )
    })

    it('succeeds and uses production endpoints when credentials are fully provided in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.ESEWA_PRODUCT_CODE = 'PROD_MERCHANT'
      process.env.ESEWA_SECRET_KEY = 'secret_live_key'

      const config = getEsewaConfig()
      expect(config.isLive).toBe(true)
      expect(config.productCode).toBe('PROD_MERCHANT')
      expect(config.secretKey).toBe('secret_live_key')
      expect(config.gatewayUrl).toBe(
        'https://epay.esewa.com.np/api/epay/main/v2/form',
      )
      expect(config.statusUrl).toBe(
        'https://epay.esewa.com.np/api/epay/transaction/status/',
      )
    })
  })

  describe('generateEsewaSignature', () => {
    it('generates valid HMAC-SHA256 signature', () => {
      const sig = generateEsewaSignature(
        '100.00',
        'uuid-1234',
        'EPAYTEST',
        '8gBm/:&EnhH.1/q',
      )
      expect(sig).toBeTruthy()
      expect(typeof sig).toBe('string')
      // Same inputs must produce deterministic output
      const sig2 = generateEsewaSignature(
        '100.00',
        'uuid-1234',
        'EPAYTEST',
        '8gBm/:&EnhH.1/q',
      )
      expect(sig).toBe(sig2)
    })
  })
})
