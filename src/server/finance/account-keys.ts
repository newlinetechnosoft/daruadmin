/**
 * ACCOUNT_KEYS
 *
 * Semantic constants mapping standard accounting keys to their underlying
 * Chart of Accounts (COA) account IDs in the database.
 *
 * In Phase 0: Defined as constants mapping to seeded IDs (`acc_xxxx`).
 * In Phase 1 (ACC-1.1): Resolved dynamically from `account_defaults` table with fallback to these seeds.
 *
 * Specification: ACCOUNT_GUIDE.md §5.3
 */

export const ACCOUNT_KEYS = {
  // Assets
  CASH_IN_HAND: 'acc_1011',
  BANK_MAIN: 'acc_1012',
  ESEWA_CLEARING: 'acc_1021',
  KHALTI_CLEARING: 'acc_1022',
  RIDER_COD_CASH: 'acc_1031',
  CUSTOMER_RECEIVABLE: 'acc_1041',
  STAFF_RIDER_ADVANCES: 'acc_1042',

  // Liabilities
  DEALER_PAYABLE: 'acc_2011',
  VAT_OUTPUT: 'acc_2021',
  VAT_INPUT: 'acc_2022',
  TDS_PAYABLE: 'acc_2023',
  RIDER_PAYABLE: 'acc_2031',

  // Equity
  OWNER_CAPITAL: 'acc_3010',
  RETAINED_EARNINGS: 'acc_3020',

  // Revenue / Income
  SALES: 'acc_4010',
  DELIVERY_INCOME: 'acc_4020',
  OTHER_INCOME: 'acc_4030',

  // Cost of Goods Sold
  COGS_LIQUOR: 'acc_5011',
  COGS_GROCERY: 'acc_5012',

  // Operating Expenses
  RIDER_EXPENSE: 'acc_5111',
  DISCOUNTS: 'acc_5112',
  GATEWAY_FEES: 'acc_5113',
  ROUND_OFF: 'acc_5114',
  RENT_UTILITIES: 'acc_5120',
  ADMIN_EXPENSE: 'acc_5130',
} as const

export type AccountKey = keyof typeof ACCOUNT_KEYS
export type AccountId = (typeof ACCOUNT_KEYS)[AccountKey]

/**
 * Helper to resolve an AccountKey into its corresponding account ID.
 */
export function getAccountId(key: AccountKey): AccountId {
  return ACCOUNT_KEYS[key]
}

/**
 * Party-controlled accounts that require partyType + partyId on journal lines.
 * Reference: ACCOUNT_GUIDE.md §7 (ACC-0.3)
 */
export const PARTY_CONTROLLED_ACCOUNTS: readonly AccountId[] = [
  ACCOUNT_KEYS.DEALER_PAYABLE,
  ACCOUNT_KEYS.RIDER_COD_CASH,
  ACCOUNT_KEYS.RIDER_PAYABLE,
  ACCOUNT_KEYS.CUSTOMER_RECEIVABLE,
  ACCOUNT_KEYS.STAFF_RIDER_ADVANCES,
] as const
