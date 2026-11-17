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
  'chart-of-accounts',
  'branches',
  'ledger',
  'vouchers',
  'party-accounts',
  'dealer-ledger',
  'rider-ledger',
  'customer-ledger',
  'supplier-ledger',
  'employee-ledger',
  'bank-cash',
  'expenses',
  'reconciliation',
  'financial-reports',
  'export-center',
  'period-close',
  'audit-trail',
  'settings',
  'transactions',
  'sales-account',
  'salary-account',
  'account-defaults',
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
  { value: 'CN', label: 'Credit Note (CN)' },
  { value: 'DN', label: 'Debit Note (DN)' },
  { value: 'OB', label: 'Opening Balance (OB)' },
  { value: 'PC', label: 'Period Closing (PC)' },
] as const

export const PARTY_TYPE_OPTIONS = [
  { value: 'all', label: 'All Parties' },
  { value: 'dealer', label: 'Dealers' },
  { value: 'rider', label: 'Riders' },
  { value: 'customer', label: 'Customers' },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'employee', label: 'Employees' },
] as const

export function partyReportTab(partyType: string | null | undefined): AccountsTab {
  if (partyType === 'dealer') return 'dealer-ledger'
  if (partyType === 'rider') return 'rider-ledger'
  if (partyType === 'customer') return 'customer-ledger'
  if (partyType === 'supplier') return 'supplier-ledger'
  if (partyType === 'employee') return 'employee-ledger'
  return 'ledger'
}

export function normalizeAccountsTab(tab: string | undefined): AccountsTab {
  if (!tab) return 'overview'
  if ((ACCOUNT_TABS as readonly string[]).includes(tab)) {
    return tab as AccountsTab
  }
  return 'overview'
}
