import { useMemo } from 'react'
import { useRouteContext } from '@tanstack/react-router'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { can, isSuperAdmin } from '#/server/auth/permissions-shared'
import type { UserGrants, SessionUser } from '#/server/auth/permissions-shared'

export function usePermissions() {
  let context: { grants?: UserGrants; user?: SessionUser } | undefined
  try {
    // Attempt reading from /admin route context
    context = useRouteContext({ from: '/admin' })
  } catch {
    context = undefined
  }

  const grants = context?.grants
  const user = context?.user
  const isSuper = isSuperAdmin(user)

  return useMemo(() => {
    return {
      grants,
      user,
      isSuperAdmin: isSuper,
      isAdmin: user?.role === 'admin' || isSuper,
      can: (module: ModuleKey, action: ActionKey) =>
        isSuper || can(grants, module, action),
    }
  }, [grants, user, isSuper])
}
