import { db } from '#/db'
import { userPermissions } from '#/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#/server/middleware/auth'
import { MODULES, ACTIONS } from '#/server/operations/types'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { DEFAULT_GRANTS_BY_ROLE, can } from './permissions-shared'
import type { SessionUser, UserGrants } from './permissions-shared'
import { insertAuditLogQuery } from '#/server/platform/platform.queries'

export * from './permissions-shared'

/**
 * Log an event to the operational audit log in Postgres.
 */
export async function logAudit(
  actor: string,
  module: string,
  action: string,
  detail: string,
) {
  try {
    await insertAuditLogQuery({
      actor: actor || 'system',
      module,
      action,
      detail,
    })
  } catch (err) {
    console.warn('[AuditLog] Failed to record audit log:', err)
  }
}

/**
 * Returns the currently authenticated user or throws a 401/403.
 * Suspended/inactive/banned users are immediately rejected.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await getServerSession()
  if (!session?.user) {
    throw new Error('401: Unauthorized: Please sign in')
  }

  const rawUser = session.user as typeof session.user & {
    role?: string | null
    isActive?: boolean | null
    banned?: boolean | null
  }

  const role = rawUser.role || 'customer'
  const isActive = rawUser.isActive !== false
  const banned = Boolean(rawUser.banned)

  if (!isActive || banned) {
    throw new Error('403: Forbidden: Account is suspended')
  }

  return {
    id: rawUser.id,
    name: rawUser.name || 'User',
    email: rawUser.email || '',
    role,
    isActive: true,
    banned: false,
  }
}

/**
 * Calculates effective grants for a user.
 * - Admin role always bypasses with all MODULES x ACTIONS.
 * - Stored user permissions from user_permissions table are checked next.
 * - Falls back to DEFAULT_GRANTS_BY_ROLE for their role (manager, rider, etc.).
 */
export async function getUserGrants(user: SessionUser): Promise<UserGrants> {
  if (user.role === 'admin') {
    return Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]))
  }

  const roleDefaults = DEFAULT_GRANTS_BY_ROLE[user.role] ?? {}

  try {
    const rows = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, user.id))

    if (rows.length > 0) {
      const custom: UserGrants = { ...roleDefaults }
      for (const r of rows) {
        custom[r.module as ModuleKey] = r.actions as ActionKey[]
      }
      return custom
    }
  } catch (err) {
    console.warn('[Permissions] Failed to read user permissions from DB:', err)
  }

  return roleDefaults
}

/**
 * Server guard: requires the user to possess a specific (module, action) grant.
 * Admins always bypass. Non-admins lacking the grant receive 403 and are audit-logged.
 */
export async function requirePermission(
  module: ModuleKey,
  action: ActionKey,
): Promise<{ user: SessionUser; grants: UserGrants }> {
  const user = await getSessionUser()
  const grants = await getUserGrants(user)

  if (user.role !== 'admin' && !can(grants, module, action)) {
    await logAudit(
      user.name || user.email || user.id,
      module,
      action,
      `Permission denied: lacks ${module}.${action}`,
    )
    throw new Error(`403: Forbidden: Missing permission ${module}.${action}`)
  }

  return { user, grants }
}

/**
 * Server guard: requires the user to possess one of the specified roles.
 * Admins always bypass.
 */
export async function requireRole(
  ...roles: string[]
): Promise<{ user: SessionUser; grants: UserGrants }> {
  const user = await getSessionUser()
  const grants = await getUserGrants(user)

  if (user.role !== 'admin' && !roles.includes(user.role)) {
    await logAudit(
      user.name || user.email || user.id,
      'auth',
      'role_check',
      `Role denied: requires [${roles.join(', ')}], user has [${user.role}]`,
    )
    throw new Error(
      `403: Forbidden: Required role [${roles.join(' | ')}], but user is [${user.role}]`,
    )
  }

  return { user, grants }
}
