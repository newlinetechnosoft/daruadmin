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
  admin: Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])) as UserGrants,
  manager: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    orders: ['view', 'edit', 'approve'],
    customers: ['view', 'edit'],
    riders: ['view', 'edit'],
    staff: ['view'],
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
 */
export function can(
  grants: UserGrants | undefined | null,
  module: ModuleKey,
  action: ActionKey,
): boolean {
  if (!grants) return false
  const moduleActions = grants[module]
  if (!Array.isArray(moduleActions)) return false
  return moduleActions.includes(action)
}
