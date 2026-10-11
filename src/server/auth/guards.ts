import { redirect } from '@tanstack/react-router'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { can, type UserGrants, type SessionUser } from './permissions-shared'

export interface AdminRouteContext {
  user?: SessionUser
  grants?: UserGrants
  adminUser?: SessionUser
}

/**
 * Route beforeLoad guard checking whether the current staff session
 * has permission for a specific module and action (default: 'view').
 * If unauthorized, redirects to /admin/forbidden.
 */
export function guardModule(module: ModuleKey, action: ActionKey = 'view') {
  return ({ context }: { context: AdminRouteContext }) => {
    if (!context?.grants || !can(context.grants, module, action)) {
      throw redirect({ to: '/admin/forbidden' })
    }
  }
}
