import { queryOptions } from '@tanstack/react-query'
import {
  getAdminChromeFn,
  getAuditFn,
  getCustomersOpsFn,
  getDashboardFn,
  getInventoryOpsFn,
  getLedgerFn,
  getMarketingFn,
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
  getAdminGroceryProductsFn,
  getAdminLiquorProductsFn,
  getAdminUsersFn,
  getAllTaxonomyFn,
  getAdminBrandsFn,
} from '#/server/catalog/catalog.functions'
import { getAdminDealersFn } from '#/server/inventory/inventory.functions'

export const adminQueries = {
  access: () =>
    queryOptions({
      queryKey: ['auth', 'my-access'],
      queryFn: () => getMyAccessFn(),
      staleTime: 0,
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

  riders: () =>
    queryOptions({
      queryKey: ['admin', 'riders'],
      queryFn: () => getRidersFn(),
      staleTime: 1000 * 30,
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

  groceryProducts: () =>
    queryOptions({
      queryKey: ['admin', 'grocery'],
      queryFn: () => getAdminGroceryProductsFn(),
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
}

export const storeQueries = {
  deliveryPricing: () =>
    queryOptions({
      queryKey: ['store', 'delivery-pricing'],
      queryFn: () => getPublicDeliverySettingsFn(),
      staleTime: 1000 * 60 * 5, // 5 min
    }),
}
