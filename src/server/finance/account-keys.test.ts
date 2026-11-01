import { describe, expect, it } from 'bun:test'
import {
  ACCOUNT_KEYS,
  PARTY_CONTROLLED_ACCOUNTS,
  getAccountId,
} from './account-keys'
import type { AccountKey } from './account-keys'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Account Keys Mapping (ACC-0.6)', () => {
  it('maps all semantic keys to valid account ID strings', () => {
    const keys = Object.keys(ACCOUNT_KEYS) as AccountKey[]
    expect(keys.length).toBe(25)

    for (const key of keys) {
      const id = ACCOUNT_KEYS[key]
      expect(typeof id).toBe('string')
      expect(id.startsWith('acc_')).toBe(true)
      expect(getAccountId(key)).toBe(id)
    }
  })

  it('contains unique account IDs for all 25 keys', () => {
    const values = Object.values(ACCOUNT_KEYS)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(25)
  })

  it('matches accounts seeded in drizzle/0007_double_entry_accounting.sql', () => {
    const sqlPath = resolve(
      process.cwd(),
      'drizzle/0007_double_entry_accounting.sql',
    )
    const sqlContent = readFileSync(sqlPath, 'utf-8')

    for (const accountId of Object.values(ACCOUNT_KEYS)) {
      expect(sqlContent).toContain(`'${accountId}'`)
    }
  })

  it('defines the 5 party-controlled accounts required by ACC-0.3', () => {
    expect(PARTY_CONTROLLED_ACCOUNTS).toHaveLength(5)
    expect(PARTY_CONTROLLED_ACCOUNTS).toContain(ACCOUNT_KEYS.DEALER_PAYABLE)
    expect(PARTY_CONTROLLED_ACCOUNTS).toContain(ACCOUNT_KEYS.RIDER_COD_CASH)
    expect(PARTY_CONTROLLED_ACCOUNTS).toContain(ACCOUNT_KEYS.RIDER_PAYABLE)
    expect(PARTY_CONTROLLED_ACCOUNTS).toContain(
      ACCOUNT_KEYS.CUSTOMER_RECEIVABLE,
    )
    expect(PARTY_CONTROLLED_ACCOUNTS).toContain(
      ACCOUNT_KEYS.STAFF_RIDER_ADVANCES,
    )
  })
})
