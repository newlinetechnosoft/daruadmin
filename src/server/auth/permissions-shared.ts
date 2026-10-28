import { MODULES, ACTIONS } from '#/server/operations/types'
import type { ModuleKey, ActionKey } from '#/server/operations/types'

export type UserGrants = Partial<Record<ModuleKey, ActionKey[]>>

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  banned?: boolean
}

export const DEFAULT_GRANTS_BY_ROLE: Record<string, UserGrants> = {
  admin: Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])),
  manager: {
    dashboard: ['view'],
    liquor: ['view', 'create', 'edit'],
    grocery: ['view', 'create', 'edit'],
    categories: ['view', 'create', 'edit'],
    brands: ['view', 'create', 'edit'],
    products: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit'],
    dealers: ['view', 'create', 'edit'],
    orders: ['view', 'edit', 'approve'],
    customers: ['view', 'edit'],
    riders: ['view', 'edit'],
    staff: ['view'],
    users: ['view', 'edit'],
    accounts: ['view', 'export'],
    payments: ['view'],
    shipping: ['view', 'edit'],
    marketing: ['view', 'create', 'edit'],
    reports: ['view', 'export'],
    settings: ['view'],
  },
  rider: {
    orders: ['view', 'edit'],
    riders: ['view'],
  },
  customer: {},
}

/**
 * Pure permission evaluator usable on both client and server.
 * Handles direct grants and backwards-compatible aliases.
 */
export function can(
  grants: UserGrants | undefined | null,
  module: ModuleKey,
  action: ActionKey,
): boolean {
  if (!grants) return false

  // 1. Direct grant check
  const moduleActions = grants[module]
  if (Array.isArray(moduleActions) && moduleActions.includes(action)) {
    return true
  }

  // 2. Backward compatibility fallback: 'products' or 'categories' grant covers 'brands'
  if (
    module === 'brands' &&
    Array.isArray(grants.categories) &&
    grants.categories.includes(action)
  ) {
    return true
  }

  // 3. Backward compatibility fallback: 'inventory' grant covers 'dealers'
  if (
    module === 'dealers' &&
    Array.isArray(grants.inventory) &&
    grants.inventory.includes(action)
  ) {
    return true
  }

  // 4. Backward compatibility fallback: 'products' umbrella grant for catalog/inventory/dealers
  if (
    (module === 'liquor' ||
      module === 'grocery' ||
      module === 'categories' ||
      module === 'brands' ||
      module === 'inventory' ||
      module === 'dealers') &&
    Array.isArray(grants.products) &&
    grants.products.includes(action)
  ) {
    return true
  }

  // 5. Backward compatibility fallback: 'staff' grant covers 'users'
  if (
    module === 'users' &&
    Array.isArray(grants.staff) &&
    grants.staff.includes(action)
  ) {
    return true
  }

  // 6. Backward compatibility fallback: checking legacy 'products' with granular submodules
  if (module === 'products') {
    return Boolean(
      grants.liquor?.includes(action) ||
      grants.grocery?.includes(action) ||
      grants.categories?.includes(action) ||
      grants.brands?.includes(action) ||
      grants.inventory?.includes(action) ||
      grants.dealers?.includes(action),
    )
  }

  return false
}
