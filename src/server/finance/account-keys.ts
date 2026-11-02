import type { DbTx } from '#/server/finance/types'
import { accountDefaults } from '#/db/schema/finance'
import type { db } from '#/db'

/**
 * ACCOUNT_KEYS
 *
 * Semantic constants mapping standard accounting keys to their underlying
 * Chart of Accounts (COA) account IDs in the database.
 *
 * In Phase 0: Defined as constants mapping to seeded IDs (`acc_xxxx`).
 * In Phase 1 (ACC-1.1): Resolved dynamically from `account_defaults` table with fallback to these seeds.
 *
 * Specification: ACCOUNT_GUIDE.md §5.3 & ACC-1.1
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
  COGS_FOOD: 'acc_5012',

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
export type RootType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export interface AccountKeyMetadata {
  key: AccountKey
  label: string
  description: string
  rootType: RootType
  defaultAccountId: AccountId
}

export const ACCOUNT_KEY_METADATA: Record<AccountKey, AccountKeyMetadata> = {
  // Assets
  CASH_IN_HAND: {
    key: 'CASH_IN_HAND',
    label: 'Cash in Hand',
    description:
      'Physical cash vault or register for store operations and rider COD handovers',
    rootType: 'asset',
    defaultAccountId: 'acc_1011',
  },
  BANK_MAIN: {
    key: 'BANK_MAIN',
    label: 'Main Operating Bank Account',
    description:
      'Primary commercial operating bank account used for dealer disbursements and payroll',
    rootType: 'asset',
    defaultAccountId: 'acc_1012',
  },
  ESEWA_CLEARING: {
    key: 'ESEWA_CLEARING',
    label: 'eSewa Clearing Account',
    description:
      'Digital wallet clearing account for customer online prepayments through eSewa',
    rootType: 'asset',
    defaultAccountId: 'acc_1021',
  },
  KHALTI_CLEARING: {
    key: 'KHALTI_CLEARING',
    label: 'Khalti Clearing Account',
    description:
      'Digital wallet clearing account for customer online prepayments through Khalti',
    rootType: 'asset',
    defaultAccountId: 'acc_1022',
  },
  RIDER_COD_CASH: {
    key: 'RIDER_COD_CASH',
    label: 'Rider Undeposited COD Cash',
    description:
      'Cash collected by couriers for COD deliveries pending manager handover',
    rootType: 'asset',
    defaultAccountId: 'acc_1031',
  },
  CUSTOMER_RECEIVABLE: {
    key: 'CUSTOMER_RECEIVABLE',
    label: 'Customer Trade Receivables',
    description:
      'Receivables owed by customer corporate accounts or credit purchases',
    rootType: 'asset',
    defaultAccountId: 'acc_1041',
  },
  STAFF_RIDER_ADVANCES: {
    key: 'STAFF_RIDER_ADVANCES',
    label: 'Staff & Rider Advances',
    description:
      'Short-term salary advances or emergency loans disbursed to riders and staff',
    rootType: 'asset',
    defaultAccountId: 'acc_1042',
  },

  // Liabilities
  DEALER_PAYABLE: {
    key: 'DEALER_PAYABLE',
    label: 'Dealer Procurement Payable',
    description:
      'Procurement liability owed to partner merchant dealers for sourced inventory',
    rootType: 'liability',
    defaultAccountId: 'acc_2011',
  },
  VAT_OUTPUT: {
    key: 'VAT_OUTPUT',
    label: 'VAT Output Payable (13%)',
    description:
      '13% Value Added Tax collected on sales owed to Inland Revenue Department (IRD)',
    rootType: 'liability',
    defaultAccountId: 'acc_2021',
  },
  VAT_INPUT: {
    key: 'VAT_INPUT',
    label: 'VAT Input Credit / Receivable (13%)',
    description:
      'Input VAT paid on purchases with tax invoices, eligible for tax credit setoff',
    rootType: 'liability',
    defaultAccountId: 'acc_2022',
  },
  TDS_PAYABLE: {
    key: 'TDS_PAYABLE',
    label: 'TDS Withholding Tax Payable',
    description:
      'Withholding tax deducted on dealer disbursements owed to Inland Revenue Department',
    rootType: 'liability',
    defaultAccountId: 'acc_2023',
  },
  RIDER_PAYABLE: {
    key: 'RIDER_PAYABLE',
    label: 'Rider Salary & Commission Payable',
    description:
      'Accrued compensation, drop fees, and commissions owed to delivery riders',
    rootType: 'liability',
    defaultAccountId: 'acc_2031',
  },

  // Equity
  OWNER_CAPITAL: {
    key: 'OWNER_CAPITAL',
    label: 'Owner Capital',
    description: 'Capital equity invested by founders and business owners',
    rootType: 'equity',
    defaultAccountId: 'acc_3010',
  },
  RETAINED_EARNINGS: {
    key: 'RETAINED_EARNINGS',
    label: 'Retained Earnings',
    description:
      'Accumulated net profit or loss carried forward from previous fiscal periods',
    rootType: 'equity',
    defaultAccountId: 'acc_3020',
  },

  // Revenue / Income
  SALES: {
    key: 'SALES',
    label: 'Sales Revenue (Merchandise Net)',
    description:
      'Primary operating revenue earned from sales of merchandise net of VAT',
    rootType: 'income',
    defaultAccountId: 'acc_4010',
  },
  DELIVERY_INCOME: {
    key: 'DELIVERY_INCOME',
    label: 'Delivery Fee Income',
    description:
      'Operating income earned from delivery and logistics fees charged to customers',
    rootType: 'income',
    defaultAccountId: 'acc_4020',
  },
  OTHER_INCOME: {
    key: 'OTHER_INCOME',
    label: 'Other Operating Income',
    description:
      'Ancillary business revenue, vendor promotional rebates, and commissions',
    rootType: 'income',
    defaultAccountId: 'acc_4030',
  },

  // Cost of Goods Sold
  COGS_LIQUOR: {
    key: 'COGS_LIQUOR',
    label: 'COGS - Liquor Purchases',
    description:
      'Direct cost of sourcing alcoholic beverages from dealers for delivered orders',
    rootType: 'expense',
    defaultAccountId: 'acc_5011',
  },
  COGS_FOOD: {
    key: 'COGS_FOOD',
    label: 'COGS - Food Purchases',
    description:
      'Direct cost of sourcing food and snack items from dealers for delivered orders',
    rootType: 'expense',
    defaultAccountId: 'acc_5012',
  },

  // Operating Expenses
  RIDER_EXPENSE: {
    key: 'RIDER_EXPENSE',
    label: 'Rider Delivery Payout & Commission',
    description:
      'Fulfillment labor expense for rider delivery drop fees and incentive commissions',
    rootType: 'expense',
    defaultAccountId: 'acc_5111',
  },
  DISCOUNTS: {
    key: 'DISCOUNTS',
    label: 'Discounts & Coupons Allowed',
    description:
      'Contra-revenue promotional expense for discount codes and coupons applied to orders',
    rootType: 'expense',
    defaultAccountId: 'acc_5112',
  },
  GATEWAY_FEES: {
    key: 'GATEWAY_FEES',
    label: 'Payment Gateway Commission',
    description:
      'Transaction processing fees charged by payment gateways (eSewa, Khalti, cards)',
    rootType: 'expense',
    defaultAccountId: 'acc_5113',
  },
  ROUND_OFF: {
    key: 'ROUND_OFF',
    label: 'Paisa Round-off Difference',
    description:
      'Expense or adjustment line for fractional paisa rounding discrepancies',
    rootType: 'expense',
    defaultAccountId: 'acc_5114',
  },
  RENT_UTILITIES: {
    key: 'RENT_UTILITIES',
    label: 'Office Rent & Utilities',
    description:
      'Operating expenses for store facilities, warehouse lease, electricity, and internet',
    rootType: 'expense',
    defaultAccountId: 'acc_5120',
  },
  ADMIN_EXPENSE: {
    key: 'ADMIN_EXPENSE',
    label: 'General Administrative Expense',
    description:
      'General management overhead, professional fees, software subscriptions, and supplies',
    rootType: 'expense',
    defaultAccountId: 'acc_5130',
  },
}

/**
 * Helper to get fallback account ID for an AccountKey.
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

let cachedDefaults: Record<AccountKey, string> | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60_000 // 1 minute in-memory cache

/**
 * Invalidates the in-memory cache for resolved account defaults.
 * Must be invoked whenever `account_defaults` mappings are updated.
 */
export function invalidateAccountDefaultsCache(): void {
  cachedDefaults = null
  cacheTimestamp = 0
}

/**
 * Resolves all 25 semantic account keys to their underlying Chart of Accounts IDs.
 * Reads from `account_defaults` table (cached in memory for performance) and falls back
 * to standard seed constants in `ACCOUNT_KEYS`.
 */
export async function resolveAllAccounts(
  tx: DbTx | typeof db,
  options?: { forceRefresh?: boolean },
): Promise<Record<AccountKey, string>> {
  const now = Date.now()
  if (
    !options?.forceRefresh &&
    cachedDefaults &&
    now - cacheTimestamp < CACHE_TTL_MS
  ) {
    return { ...cachedDefaults }
  }

  const resolved: Record<AccountKey, string> = { ...ACCOUNT_KEYS }

  try {
    const rows = await tx
      .select({
        key: accountDefaults.key,
        accountId: accountDefaults.accountId,
      })
      .from(accountDefaults)

    for (const row of rows) {
      if (row.key in resolved) {
        resolved[row.key as AccountKey] = row.accountId
      }
    }

    cachedDefaults = resolved
    cacheTimestamp = now
  } catch (_err) {
    // If table doesn't exist yet (e.g., in unit tests before migrations), fallback safely
    cachedDefaults = resolved
    cacheTimestamp = now
  }

  return { ...resolved }
}

/**
 * Resolves a single semantic AccountKey to its corresponding account ID.
 * Reads from DB `account_defaults` with fallback to `ACCOUNT_KEYS`.
 * Throws a clear, descriptive error if the mapping cannot be resolved.
 */
export async function resolveAccount(
  tx: DbTx | typeof db,
  key: AccountKey | string,
  options?: { forceRefresh?: boolean },
): Promise<string> {
  const map = await resolveAllAccounts(tx, options)
  const id = (map as Record<string, string>)[key]
  if (!id) {
    throw new Error(
      `Account default mapping for "${key}" not found. Please configure default accounts in Accounting Settings.`,
    )
  }
  return id
}
