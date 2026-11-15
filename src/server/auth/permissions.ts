import { db } from '#/db'
import { user as userTable, userPermissions } from '#/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#/server/middleware/auth'
import { MODULES, ACTIONS } from '#/server/operations/types'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { DEFAULT_GRANTS_BY_ROLE, can, isSuperAdmin } from './permissions-shared'
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
 * Recognizes admin@newline.com and 'superadmin' as root developer team.
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
    phone?: string | null
    phoneVerified?: boolean | null
  }

  const rawRole = rawUser.role || 'customer'
  const isSuper = isSuperAdmin({ email: rawUser.email, role: rawRole })
  const role = isSuper ? 'superadmin' : rawRole
  const isActive = isSuper ? true : rawUser.isActive !== false
  const banned = isSuper ? false : Boolean(rawUser.banned)

  if (!isActive || banned) {
    throw new Error('403: Forbidden: Account is suspended')
  }

  // If superadmin in session but not yet updated in Postgres, sync it asynchronously
  if (isSuper && rawUser.id && rawUser.role !== 'superadmin') {
    db.update(userTable)
      .set({ role: 'superadmin' })
      .where(eq(userTable.id, rawUser.id))
      .catch((err) => {
        console.warn('[Permissions] Failed to sync superadmin role to DB:', err)
      })
  }

  return {
    id: rawUser.id,
    name: rawUser.name || (isSuper ? 'Developer Super Admin' : 'User'),
    email: rawUser.email || '',
    role,
    isActive: true,
    banned: false,
    phone: rawUser.phone || null,
    phoneVerified: Boolean(rawUser.phoneVerified),
  }
}

/**
 * Calculates effective grants for a user.
 * - Superadmin role / admin@newline.com always bypasses with 100% MODULES x ACTIONS.
 * - Stored user permissions from user_permissions table are checked next (enables custom matrix for admin, rider, manager).
 * - Falls back to DEFAULT_GRANTS_BY_ROLE for their role.
 */
export async function getUserGrants(user: SessionUser): Promise<UserGrants> {
  if (isSuperAdmin(user)) {
    return Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]))
  }

  const roleDefaults = DEFAULT_GRANTS_BY_ROLE[user.role] ?? {}

  try {
    const rows = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, user.id))

    if (rows.length > 0) {
      const custom: UserGrants = {}
      const dbGrants: Partial<Record<ModuleKey, ActionKey[]>> = {}
      for (const r of rows) {
        dbGrants[r.module as ModuleKey] = r.actions as ActionKey[]
      }
      for (const mod of MODULES) {
        if (mod in dbGrants) {
          custom[mod] = dbGrants[mod]
        } else if (mod in roleDefaults) {
          custom[mod] = roleDefaults[mod]
        }
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
 * Superadmin (Developer Team) always bypasses all permission checks.
 * Admins follow custom matrix grants if set by Super Admin, or full defaults.
 */
export async function requirePermission(
  module: ModuleKey,
  action: ActionKey,
): Promise<{ user: SessionUser; grants: UserGrants }> {
  const user = await getSessionUser()
  const grants = await getUserGrants(user)

  if (!isSuperAdmin(user) && !can(grants, module, action)) {
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
 * Superadmin (Developer Team) always bypasses role checks.
 */
export async function requireRole(
  ...roles: string[]
): Promise<{ user: SessionUser; grants: UserGrants }> {
  const user = await getSessionUser()
  const grants = await getUserGrants(user)

  if (!isSuperAdmin(user) && !roles.includes(user.role)) {
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
