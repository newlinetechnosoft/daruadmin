import { useMemo } from 'react'
import { useRouteContext } from '@tanstack/react-router'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { can, type UserGrants, type SessionUser } from '#/server/auth/permissions-shared'

export function usePermissions() {
  let context: { grants?: UserGrants; user?: SessionUser } | undefined
  try {
    // Attempt reading from /admin route context
    context = useRouteContext({ from: '/admin' }) as any
  } catch {
    context = undefined
  }

  const grants = context?.grants
  const user = context?.user

  return useMemo(() => {
    return {
      grants,
      user,
      isAdmin: user?.role === 'admin',
      can: (module: ModuleKey, action: ActionKey) => can(grants, module, action),
    }
  }, [grants, user])
}
