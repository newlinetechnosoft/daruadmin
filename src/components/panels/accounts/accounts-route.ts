import { getRouteApi } from '@tanstack/react-router'

/**
 * Shared route handle for the accounts module.
 *
 * Keeping the tab union and route API in one place means the panel, tabs and
 * drill-down links all agree on valid search params.
 */
export const accountsRouteApi = getRouteApi('/admin/accounts')

export const ACCOUNT_TABS = [
  'overview',
  'ledger',
  'transactions',
  'dealer-ledger',
  'rider-ledger',
  'sales-account',
  'salary-account',
  'chart-of-accounts',
  'financial-reports',
  'account-defaults',
  'settings',
] as const

export type AccountsTab = (typeof ACCOUNT_TABS)[number]

export const ROOT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Account Types' },
  { value: 'asset', label: 'Assets' },
  { value: 'liability', label: 'Liabilities' },
  { value: 'equity', label: 'Equity' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
] as const

export const VOUCHER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Voucher Types' },
  { value: 'JV', label: 'Journal Voucher (JV)' },
  { value: 'PV', label: 'Payment Voucher (PV)' },
  { value: 'RV', label: 'Receipt Voucher (RV)' },
  { value: 'CV', label: 'Contra Voucher (CV)' },
  { value: 'SV', label: 'Sales Voucher (SV)' },
] as const

export const PARTY_TYPE_OPTIONS = [
  { value: 'all', label: 'All Parties' },
  { value: 'dealer', label: 'Dealers' },
  { value: 'rider', label: 'Riders' },
  { value: 'customer', label: 'Customers' },
  { value: 'supplier', label: 'Suppliers' },
] as const

export function partyReportTab(partyType: string | null | undefined) {
  if (partyType === 'dealer') return 'dealer-ledger' as const
  if (partyType === 'rider') return 'rider-ledger' as const
  return 'ledger' as const
}

export function normalizeAccountsTab(tab: string | undefined): AccountsTab {
  if (tab === 'settings') return 'account-defaults'
  if (tab && (ACCOUNT_TABS as readonly string[]).includes(tab)) {
    return tab as AccountsTab
  }
  return 'overview'
}
