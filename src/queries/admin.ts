import {
  getSuperAdminBulkOverviewFn,
  getAdminPanelNoticesFn,
  getSuperAdminSupportSettingsFn,
  getSuperAdminSystemSettingsFn,
  getSuperAdminWebsiteSettingsFn,
  getSuperAdminFeatureFlagsFn,
  getSuperAdminPricingRulesFn,
  getSuperAdminTelemetryFn,
  getSuperAdminAuditLogsFn,
  getPublicStoreOperatingStatusFn,
} from '#/server/superadmin/superadmin.functions'
import { getRecycleBinFn } from '#/server/recycle-bin/recycle-bin.functions'
import { getPublicActivePaymentGatewaysFn } from '#/server/orders/order.functions'
import { queryOptions } from '@tanstack/react-query'
import {
  getAdminChromeFn,
  getAuditFn,
  getCustomersOpsFn,
  getDashboardFn,
  getInventoryOpsFn,
  getLedgerFn,
  getMarketingFn,
  getAdminLandingNoticesFn,
  getMyAccessFn,
  getOrdersFn,
  getPaymentsFn,
  getReportsOpsFn,
  getProductVelocityAndSourcingIntelligenceFn,
  getRidersFn,
  getSettingsFn,
  getShippingFn,
  getStaffOpsFn,
  getPublicDeliverySettingsFn,
  getAdminCampaignsFn,
  getCampaignDeliveriesFn,
  getAudienceEstimateFn,
} from '#/server/operations/operations.functions'
import {
  getAdminFoodProductsFn,
  getAdminGroceryProductsFn,
  getAdminDdcProductsFn,
  getAdminLiquorProductsFn,
  getAdminUsersFn,
  getAllTaxonomyFn,
  getAdminBrandsFn,
} from '#/server/catalog/catalog.functions'
import {
  getAdminDealersFn,
  getDealerByIdFn,
} from '#/server/inventory/inventory.functions'
import {
  getAccountDefaultsFn,
  getCostCentersFn,
  getDealerPayablesSummaryFn,
  getGeneralLedgerFn,
  getJournalEntryByIdFn,
  getJournalTransactionsFn,
  getPartyStatementFn,
  getRiderAccountsSummaryFn,
} from '#/server/finance/finance.functions'
import { getChartOfAccountsTreeFn } from '#/server/finance/coa.functions'
import {
  getBranchesFn,
  getBranchProfitabilityFn,
} from '#/server/finance/branches.functions'
import {
  getBankAccountsFn,
  getBankReconciliationSummaryFn,
  getBankTransactionsFn,
  getCashAccountsFn,
  getCashClosingHistoryFn,
  getCashFlowTrackingFn,
  getUnmatchedBankJournalLinesFn,
} from '#/server/finance/banking.functions'
import {
  getExpenseCategoriesFn,
  getExpenseDetailsFn,
  getExpensesFn,
} from '#/server/finance/expenses.functions'
import { getPartyAccountsSummaryFn } from '#/server/finance/parties.functions'
import {
  getTrialBalanceReportFn,
  getProfitAndLossReportFn,
  getBalanceSheetReportFn,
  getCashFlowStatementReportFn,
  getTaxSummaryReportFn,
  getSubLedgerIntegrityAuditFn,
  getDayBookReportFn,
  getAgingReportFn,
} from '#/server/finance/reports.functions'
import {
  getVoucherAttachmentsFn,
  getVoucherDetailsFn,
  getVouchersListFn,
} from '#/server/finance/vouchers.functions'
import {
  getAccountingPeriodsFn,
  getPeriodClosingHistoryFn,
  verifyFiscalYearPreCloseFn,
} from '#/server/finance/periods.functions'
import {
  getExportAuditLogsFn,
  getFinancialAuditLogsFn,
  getReversalHistoryFn,
  getVoucherApprovalLogsFn,
} from '#/server/finance/audit.functions'
import { getAccountingDashboardFn } from '#/server/finance/dashboard.functions'
import { getAccountingConfigurationFn } from '#/server/finance/settings.functions'

export const adminQueries = {
  access: () =>
    queryOptions({
      queryKey: ['auth', 'my-access'],
      queryFn: () => getMyAccessFn(),
      staleTime: 1000 * 30, // 30s cache prevents repeating network roundtrips on route navigation
    }),

  chrome: () =>
    queryOptions({
      queryKey: ['admin', 'chrome'],
      queryFn: () => getAdminChromeFn(),
      staleTime: 1000 * 30, // 30s
    }),

  dashboard: (data: { range?: string; from?: string; to?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'dashboard', data],
      queryFn: () => getDashboardFn({ data: data as any }),
      staleTime: 1000 * 60, // 1 min
    }),

  orders: () =>
    queryOptions({
      queryKey: ['admin', 'orders'],
      queryFn: () => getOrdersFn(),
      staleTime: 1000 * 30,
    }),

  ledger: () =>
    queryOptions({
      queryKey: ['admin', 'ledger'],
      queryFn: () => getLedgerFn(),
      staleTime: 1000 * 60,
    }),

  accountDefaults: () =>
    queryOptions({
      queryKey: ['admin', 'account-defaults'],
      queryFn: () => getAccountDefaultsFn(),
      staleTime: 1000 * 60,
    }),

  generalLedger: (
    data: {
      accountId?: string
      accountCode?: string
      accountRootType?: string
      accountType?: string
      partyType?: string
      partyId?: string
      voucherType?: string
      refType?: string
      refId?: string
      costCenterId?: string
      fromDate?: string
      toDate?: string
      search?: string
      limit?: number
      offset?: number
    } = {},
  ) =>
    queryOptions({
      queryKey: ['admin', 'general-ledger', data],
      queryFn: () => getGeneralLedgerFn({ data }),
      staleTime: 1000 * 30,
    }),

  partyStatement: (data: {
    partyType: 'dealer' | 'rider' | 'customer' | 'supplier' | 'employee'
    partyId: string
    fromDate?: string
    toDate?: string
    accountId?: string
    limit?: number
  }) =>
    queryOptions({
      queryKey: [
        'admin',
        'party-statement',
        data.partyType,
        data.partyId,
        data,
      ],
      queryFn: () => getPartyStatementFn({ data }),
      staleTime: 1000 * 30,
    }),

  journalEntryById: (id: string) =>
    queryOptions({
      queryKey: ['admin', 'journal-entry', id],
      queryFn: () => getJournalEntryByIdFn({ data: { id } }),
      staleTime: 1000 * 60,
      enabled: !!id,
    }),

  costCenters: () =>
    queryOptions({
      queryKey: ['admin', 'cost-centers'],
      queryFn: () => getCostCentersFn(),
      staleTime: 1000 * 60 * 5,
    }),

  journalTransactions: (
    data: {
      voucherType?: string
      refType?: string
      partyType?: string
      partyId?: string
      fromDate?: string
      toDate?: string
      search?: string
      limit?: number
      offset?: number
    } = {},
  ) =>
    queryOptions({
      queryKey: ['admin', 'journal-transactions', data],
      queryFn: () => getJournalTransactionsFn({ data }),
      staleTime: 1000 * 30,
    }),

  dealerPayablesSummary: () =>
    queryOptions({
      queryKey: ['admin', 'dealer-payables-summary'],
      queryFn: () => getDealerPayablesSummaryFn(),
      staleTime: 1000 * 60,
    }),

  riderAccountsSummary: () =>
    queryOptions({
      queryKey: ['admin', 'rider-accounts-summary'],
      queryFn: () => getRiderAccountsSummaryFn(),
      staleTime: 1000 * 60,
    }),

  coaTree: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'coa-tree'],
      queryFn: () => getChartOfAccountsTreeFn(),
      staleTime: 1000 * 60 * 5,
    }),

  branches: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'branches'],
      queryFn: () => getBranchesFn(),
      staleTime: 1000 * 60 * 5,
    }),

  branchProfitability: (data: { branchId?: string; fromDate?: string; toDate?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'branch-profitability', data],
      queryFn: () => getBranchProfitabilityFn({ data }),
      staleTime: 1000 * 60,
    }),

  bankAccounts: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'bank-accounts'],
      queryFn: () => getBankAccountsFn(),
      staleTime: 1000 * 30,
    }),

  cashAccounts: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'cash-accounts'],
      queryFn: () => getCashAccountsFn(),
      staleTime: 1000 * 30,
    }),

  unmatchedBankJournalLines: (bankAccountId: string) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'unmatched-bank-lines', bankAccountId],
      queryFn: () => getUnmatchedBankJournalLinesFn({ data: { bankAccountId } }),
      staleTime: 1000 * 15,
    }),

  bankReconciliationSummary: (bankAccountId: string) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'bank-reconciliation-summary', bankAccountId],
      queryFn: () => getBankReconciliationSummaryFn({ data: { bankAccountId } }),
      staleTime: 1000 * 15,
    }),

  cashFlowTracking: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'cash-flow-tracking'],
      queryFn: () => getCashFlowTrackingFn(),
      staleTime: 1000 * 30,
    }),

  cashClosingHistory: (data: { branchId?: string; limit?: number } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'cash-closings', data],
      queryFn: () => getCashClosingHistoryFn({ data }),
      staleTime: 1000 * 30,
    }),

  bankTransactions: (data: { bankAccountId?: string; status?: 'unmatched' | 'matched' | 'ignored'; limit?: number } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'bank-transactions', data],
      queryFn: () => getBankTransactionsFn({ data }),
      staleTime: 1000 * 30,
    }),

  expenseCategories: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'expense-categories'],
      queryFn: () => getExpenseCategoriesFn(),
      staleTime: 1000 * 60 * 5,
    }),

  expenses: (
    data: {
      branchId?: string
      categoryId?: string
      categoryAccountId?: string
      status?: string
      search?: string
      fromDate?: string
      toDate?: string
      limit?: number
      offset?: number
    } = {},
  ) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'expenses', data],
      queryFn: () => getExpensesFn({ data }),
      staleTime: 1000 * 30,
    }),

  expenseDetails: (expenseId: string) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'expense-details', expenseId],
      queryFn: () => getExpenseDetailsFn({ data: { expenseId } }),
      staleTime: 1000 * 30,
      enabled: !!expenseId,
    }),

  partyAccountsSummary: (data: { partyType: 'dealer' | 'rider' | 'customer' | 'supplier' | 'employee'; search?: string } = { partyType: 'dealer' }) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'party-accounts', data],
      queryFn: () => getPartyAccountsSummaryFn({ data }),
      staleTime: 1000 * 30,
    }),

  vouchersList: (data: { voucherType?: string; status?: 'draft' | 'submitted' | 'approved' | 'cancelled'; branchId?: string; fromDate?: string; toDate?: string; search?: string; limit?: number; offset?: number } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'vouchers-list', data],
      queryFn: () => getVouchersListFn({ data }),
      staleTime: 1000 * 30,
    }),

  voucherDetails: (journalEntryId: string) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'voucher-details', journalEntryId],
      queryFn: () => getVoucherDetailsFn({ data: { journalEntryId } }),
      staleTime: 1000 * 30,
    }),

  voucherAttachments: (journalEntryId: string) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'voucher-attachments', journalEntryId],
      queryFn: () => getVoucherAttachmentsFn({ data: { journalEntryId } }),
      staleTime: 1000 * 30,
    }),

  accountingPeriods: (data: { fiscalYear?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'accounting-periods', data],
      queryFn: () => getAccountingPeriodsFn({ data }),
      staleTime: 1000 * 60,
    }),

  accountingConfig: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'accounting-config'],
      queryFn: () => getAccountingConfigurationFn(),
      staleTime: 1000 * 60,
    }),

  periodClosingHistory: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'period-closing-history'],
      queryFn: () => getPeriodClosingHistoryFn(),
      staleTime: 1000 * 60,
    }),

  fiscalYearPreClose: (fiscalYearId: string) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'fiscal-year-pre-close', fiscalYearId],
      queryFn: () => verifyFiscalYearPreCloseFn({ data: { fiscalYearId } }),
      staleTime: 1000 * 30,
    }),

  financialAuditLogs: (params?: {
    fromDate?: string
    toDate?: string
    action?: string
    actor?: string
    search?: string
    limit?: number
    offset?: number
  }) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'audit-logs', params],
      queryFn: () => getFinancialAuditLogsFn({ data: params }),
      staleTime: 1000 * 30,
    }),

  voucherApprovalLogs: (limit?: number) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'voucher-approval-logs', limit],
      queryFn: () => getVoucherApprovalLogsFn({ data: { limit } }),
      staleTime: 1000 * 30,
    }),

  reversalAuditHistory: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reversal-audit-history'],
      queryFn: () => getReversalHistoryFn(),
      staleTime: 1000 * 60,
    }),

  exportAuditLogs: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'export-audit-logs'],
      queryFn: () => getExportAuditLogsFn(),
      staleTime: 1000 * 60,
    }),

  trialBalanceReport: (data: { fromDate?: string; toDate?: string; branchId?: string; costCenterId?: string; includeZero?: boolean } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'trial-balance', data],
      queryFn: () => getTrialBalanceReportFn({ data }),
      staleTime: 1000 * 60,
    }),

  profitLossReport: (data: { fromDate?: string; toDate?: string; branchId?: string; costCenterId?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'profit-loss', data],
      queryFn: () => getProfitAndLossReportFn({ data }),
      staleTime: 1000 * 60,
    }),

  balanceSheetReport: (data: { asOfDate?: string; branchId?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'balance-sheet', data],
      queryFn: () => getBalanceSheetReportFn({ data }),
      staleTime: 1000 * 60,
    }),

  cashFlowReport: (data: { fromDate?: string; toDate?: string; branchId?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'cash-flow', data],
      queryFn: () => getCashFlowStatementReportFn({ data }),
      staleTime: 1000 * 60,
    }),

  taxSummaryReport: (data: { fromDate?: string; toDate?: string; branchId?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'tax-summary', data],
      queryFn: () => getTaxSummaryReportFn({ data }),
      staleTime: 1000 * 60,
    }),

  subledgerIntegrity: () =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'subledger-integrity'],
      queryFn: () => getSubLedgerIntegrityAuditFn(),
      staleTime: 1000 * 60,
    }),

  dayBookReport: (data: { date?: string; branchId?: string; voucherType?: string; limit?: number; offset?: number } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'day-book', data],
      queryFn: () => getDayBookReportFn({ data }),
      staleTime: 1000 * 30,
    }),

  agingReport: (data: { type?: 'receivable' | 'payable'; asOfDate?: string; branchId?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'reports', 'aging', data],
      queryFn: () => getAgingReportFn({ data }),
      staleTime: 1000 * 60,
    }),

  accountingDashboard: (data: { branchId?: string; fromDate?: string; toDate?: string } = {}) =>
    queryOptions({
      queryKey: ['admin', 'finance', 'dashboard', data],
      queryFn: () => getAccountingDashboardFn({ data }),
      staleTime: 1000 * 30,
    }),

  riders: () =>
    queryOptions({
      queryKey: ['admin', 'riders'],
      queryFn: () => getRidersFn(),
      staleTime: 1000 * 30,
      refetchInterval: 1000 * 60 * 2, // 2 minutes live telemetry auto-refresh
    }),

  payments: () =>
    queryOptions({
      queryKey: ['admin', 'payments'],
      queryFn: () => getPaymentsFn(),
      staleTime: 1000 * 60,
    }),

  activePaymentGateways: () =>
    queryOptions({
      queryKey: ['public', 'activePaymentGateways'],
      queryFn: () => getPublicActivePaymentGatewaysFn(),
      staleTime: 1000 * 60,
    }),

  shipping: () =>
    queryOptions({
      queryKey: ['admin', 'shipping'],
      queryFn: () => getShippingFn(),
      staleTime: 1000 * 60 * 5,
    }),

  marketing: () =>
    queryOptions({
      queryKey: ['admin', 'marketing'],
      queryFn: () => getMarketingFn(),
      staleTime: 1000 * 60 * 2,
    }),

  campaigns: (status?: any) =>
    queryOptions({
      queryKey: ['admin', 'campaigns', status ?? 'all'],
      queryFn: () => getAdminCampaignsFn({ data: { status } }),
      staleTime: 1000 * 30,
    }),

  campaignDeliveries: (campaignId: string) =>
    queryOptions({
      queryKey: ['admin', 'campaign-deliveries', campaignId],
      queryFn: () => getCampaignDeliveriesFn({ data: { campaignId } }),
      staleTime: 1000 * 15,
      enabled: !!campaignId,
    }),

  audienceEstimate: (audience: string) =>
    queryOptions({
      queryKey: ['admin', 'audience-estimate', audience],
      queryFn: () => getAudienceEstimateFn({ data: { audience } }),
      staleTime: 1000 * 60,
    }),

  banners: () =>
    queryOptions({
      queryKey: ['admin', 'banners'],
      queryFn: () => getAdminLandingNoticesFn(),
      staleTime: 1000 * 30,
    }),

  audit: () =>
    queryOptions({
      queryKey: ['admin', 'audit'],
      queryFn: () => getAuditFn(),
      staleTime: 1000 * 60,
    }),

  settings: () =>
    queryOptions({
      queryKey: ['admin', 'settings'],
      queryFn: () => getSettingsFn(),
      staleTime: 1000 * 60 * 5,
    }),

  customers: () =>
    queryOptions({
      queryKey: ['admin', 'customers'],
      queryFn: () => getCustomersOpsFn(),
      staleTime: 1000 * 60,
    }),

  inventory: () =>
    queryOptions({
      queryKey: ['admin', 'inventory'],
      queryFn: () => getInventoryOpsFn(),
      staleTime: 1000 * 60,
    }),

  staff: () =>
    queryOptions({
      queryKey: ['admin', 'staff'],
      queryFn: () => getStaffOpsFn(),
      staleTime: 1000 * 60 * 2,
    }),

  reports: () =>
    queryOptions({
      queryKey: ['admin', 'reports'],
      queryFn: () => getReportsOpsFn(),
      staleTime: 1000 * 60 * 2,
    }),

  sourcingIntelligence: (days?: number | null) =>
    queryOptions({
      queryKey: ['admin', 'reports', 'sourcing-intelligence', days ?? 'all'],
      queryFn: () =>
        getProductVelocityAndSourcingIntelligenceFn({
          data: { days: days ?? null },
        }),
      staleTime: 1000 * 60 * 2,
    }),

  liquorProducts: () =>
    queryOptions({
      queryKey: ['admin', 'liquor'],
      queryFn: () => getAdminLiquorProductsFn(),
      staleTime: 1000 * 60 * 2,
    }),

  foodProducts: () =>
    queryOptions({
      queryKey: ['admin', 'food'],
      queryFn: () => getAdminFoodProductsFn(),
      staleTime: 1000 * 60 * 2,
    }),

  groceryProducts: () =>
    queryOptions({
      queryKey: ['admin', 'grocery'],
      queryFn: () => getAdminGroceryProductsFn(),
      staleTime: 1000 * 60 * 2,
    }),

  ddcProducts: () =>
    queryOptions({
      queryKey: ['admin', 'ddc'],
      queryFn: () => getAdminDdcProductsFn(),
      staleTime: 1000 * 60 * 2,
    }),

  brands: () =>
    queryOptions({
      queryKey: ['admin', 'brands'],
      queryFn: () => getAdminBrandsFn(),
      staleTime: 1000 * 60 * 5,
    }),

  taxonomy: () =>
    queryOptions({
      queryKey: ['admin', 'taxonomy'],
      queryFn: () => getAllTaxonomyFn(),
      staleTime: 1000 * 60 * 10,
    }),

  users: () =>
    queryOptions({
      queryKey: ['admin', 'users'],
      queryFn: () => getAdminUsersFn(),
      staleTime: 1000 * 60 * 2,
    }),

  dealers: () =>
    queryOptions({
      queryKey: ['admin', 'dealers'],
      queryFn: () => getAdminDealersFn(),
      staleTime: 1000 * 60 * 2,
    }),

  dealer: (id: string) =>
    queryOptions({
      queryKey: ['admin', 'dealer', id],
      queryFn: () => getDealerByIdFn({ data: { id } }),
      staleTime: 1000 * 60 * 2,
    }),

  adminPanelNotices: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'notices'],
      queryFn: () => getAdminPanelNoticesFn(),
      staleTime: 1000 * 15,
    }),

  superAdminSupport: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'support'],
      queryFn: () => getSuperAdminSupportSettingsFn(),
      staleTime: 1000 * 60,
    }),

  superAdminSystem: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'system'],
      queryFn: () => getSuperAdminSystemSettingsFn(),
      staleTime: 1000 * 30,
    }),

  superAdminWebsite: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'website'],
      queryFn: () => getSuperAdminWebsiteSettingsFn(),
      staleTime: 1000 * 60,
    }),

  superAdminOverview: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'overview'],
      queryFn: () => getSuperAdminBulkOverviewFn(),
      staleTime: 1000 * 30,
    }),

  superAdminFeatureFlags: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'feature-flags'],
      queryFn: () => getSuperAdminFeatureFlagsFn(),
      staleTime: 1000 * 30,
    }),

  superAdminPricingRules: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'pricing-rules'],
      queryFn: () => getSuperAdminPricingRulesFn(),
      staleTime: 1000 * 30,
    }),

  superAdminTelemetry: () =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'telemetry'],
      queryFn: () => getSuperAdminTelemetryFn(),
      staleTime: 1000 * 10,
    }),

  superAdminAuditLogs: (limit = 50) =>
    queryOptions({
      queryKey: ['admin', 'superadmin', 'audit-logs', limit],
      queryFn: () => getSuperAdminAuditLogsFn({ data: { limit } }),
      staleTime: 1000 * 15,
    }),

  recycleBin: () =>
    queryOptions({
      queryKey: ['admin', 'recycle-bin'],
      queryFn: () => getRecycleBinFn(),
      staleTime: 1000 * 10,
    }),
}

export const storeQueries = {
  deliveryPricing: () =>
    queryOptions({
      queryKey: ['store', 'delivery-pricing'],
      queryFn: () => getPublicDeliverySettingsFn(),
      staleTime: 1000 * 60 * 5, // 5 min
    }),
  operatingStatus: () =>
    queryOptions({
      queryKey: ['store', 'operating-status'],
      queryFn: () => getPublicStoreOperatingStatusFn(),
      staleTime: 1000 * 30, // 30 sec
    }),
}
