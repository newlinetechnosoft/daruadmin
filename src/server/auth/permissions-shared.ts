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
  phone?: string | null
  phoneVerified?: boolean
}

export const DEFAULT_GRANTS_BY_ROLE: Record<string, UserGrants> = {
  admin: Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])),
  manager: {
    dashboard: ['view'],
    liquor: ['view', 'create', 'edit'],
    food: ['view', 'create', 'edit'],
    grocery: ['view', 'create', 'edit'],
    ddc: ['view', 'create', 'edit'],
    categories: ['view', 'create', 'edit'],
    brands: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit'],
    dealers: ['view', 'create', 'edit'],
    orders: ['view', 'edit', 'approve'],
    customers: ['view', 'edit'],
    riders: ['view', 'edit'],
    staff: ['view'],
    users: ['view', 'edit'],
    accounts: ['view', 'create', 'export'],
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

  // 1. Direct grant check: if module is explicitly defined in grants (even if empty []),
  // it takes absolute precedence over any legacy fallback.
  const moduleActions = grants[module]
  if (Array.isArray(moduleActions)) {
    return moduleActions.includes(action)
  }

  // 2. Backward compatibility fallback: checking legacy 'products' with granular submodules
  if (module === 'products') {
    return Boolean(
      grants.liquor?.includes(action) ||
      grants.food?.includes(action) ||
      grants.grocery?.includes(action) ||
      grants.ddc?.includes(action) ||
      grants.categories?.includes(action) ||
      grants.brands?.includes(action) ||
      grants.inventory?.includes(action) ||
      grants.dealers?.includes(action),
    )
  }

  // Fallbacks below ONLY run if grants[module] is completely undefined (e.g. legacy stored records)

  // 3. Backward compatibility fallback: 'categories' grant covers 'brands' if brands is undefined
  if (
    module === 'brands' &&
    grants.brands === undefined &&
    Array.isArray(grants.categories) &&
    grants.categories.includes(action)
  ) {
    return true
  }

  // 4. Backward compatibility fallback: 'inventory' grant covers 'dealers' if dealers is undefined
  if (
    module === 'dealers' &&
    grants.dealers === undefined &&
    Array.isArray(grants.inventory) &&
    grants.inventory.includes(action)
  ) {
    return true
  }

  // 5. Backward compatibility fallback: 'staff' grant covers 'users' if users is undefined
  if (
    module === 'users' &&
    grants.users === undefined &&
    Array.isArray(grants.staff) &&
    grants.staff.includes(action)
  ) {
    return true
  }

  // 6. Backward compatibility fallback: legacy 'products' umbrella grant covers catalog modules if undefined
  if (
    (module === 'liquor' ||
      module === 'food' ||
      module === 'grocery' ||
      module === 'ddc' ||
      module === 'categories' ||
      module === 'brands' ||
      module === 'inventory' ||
      module === 'dealers') &&
    grants[module] === undefined &&
    Array.isArray(grants.products) &&
    grants.products.includes(action)
  ) {
    return true
  }

  return false
}
