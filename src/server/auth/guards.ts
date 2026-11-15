import { redirect } from '@tanstack/react-router'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { can, isSuperAdmin } from './permissions-shared'
import type { UserGrants, SessionUser } from './permissions-shared'

export interface AdminRouteContext {
  user?: SessionUser
  grants?: UserGrants
  adminUser?: SessionUser
}

/**
 * Route beforeLoad guard checking whether the current staff session
 * has permission for a specific module and action (default: 'view').
 * If unauthorized, redirects to /admin/forbidden.
 * Super Admin (Developer Team) always bypasses all module guards.
 */
export function guardModule(module: ModuleKey, action: ActionKey = 'view') {
  return ({ context }: { context: AdminRouteContext }) => {
    const user = context.adminUser || context.user
    if (user && isSuperAdmin(user)) {
      return
    }
    if (!context.grants || !can(context.grants, module, action)) {
      throw redirect({ to: '/admin/forbidden' })
    }
  }
}

/**
 * Route guard strictly restricting access to Super Admin (developer team).
 */
export function guardSuperAdmin() {
  return ({ context }: { context: AdminRouteContext }) => {
    const user = context.adminUser || context.user
    if (!user || !isSuperAdmin(user)) {
      throw redirect({ to: '/admin/forbidden' })
    }
  }
}
