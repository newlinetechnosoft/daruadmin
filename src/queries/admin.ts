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
    partyType: 'dealer' | 'rider' | 'customer' | 'supplier'
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
