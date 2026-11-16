import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '#/db'
import { account, session } from '#/db/schema'
import { getSessionUser, logAudit } from '#/server/auth/permissions'
import { getServerSession } from '#/server/middleware/auth'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { storeUserCredentialHelper } from '#/server/superadmin/superadmin.functions'

function nid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
}

export const changeUserPasswordFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
        confirmPassword: z.string().min(1, 'Confirm password is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.newPassword !== data.confirmPassword) {
      throw new Error('New password and confirm password do not match')
    }

    if (data.newPassword === data.currentPassword) {
      throw new Error('New password cannot be the same as your current password')
    }

    const sessionUser = await getSessionUser()
    if (!sessionUser?.id) {
      throw new Error('401: Unauthorized: Please sign in to change password')
    }

    // Look up the user's credential account in Postgres
    const existingAccounts = await db
      .select({
        id: account.id,
        password: account.password,
        providerId: account.providerId,
      })
      .from(account)
      .where(
        and(eq(account.userId, sessionUser.id), eq(account.providerId, 'credential')),
      )
      .limit(1)

    const accountRecord = existingAccounts[0]

    // If an existing password hash exists, verify current password
    if (accountRecord?.password) {
      const isMatch = await verifyPassword({
        hash: accountRecord.password,
        password: data.currentPassword,
      })

      if (!isMatch) {
        throw new Error('Current password does not match. Please verify and try again.')
      }
    } else {
      // User registered without a password hash (e.g. phone/OTP)
      // Allow setting password directly upon initial change
    }

    // Hash the new password using Better Auth crypto
    const hashedPassword = await hashPassword(data.newPassword)

    if (accountRecord) {
      await db
        .update(account)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(account.id, accountRecord.id))
    } else {
      await db.insert(account).values({
        id: nid('acc'),
        userId: sessionUser.id,
        providerId: 'credential',
        accountId: (sessionUser.email || sessionUser.id).toLowerCase().trim(),
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // Terminate OTHER active sessions so devices must re-authenticate with new password
    // Keep caller's active session intact
    const currentSession = await getServerSession()
    if (currentSession?.session?.id) {
      try {
        await db
          .delete(session)
          .where(
            and(
              eq(session.userId, sessionUser.id),
              ne(session.id, currentSession.session.id),
            ),
          )
      } catch {
        // non-critical
      }
    }

    // Sync plaintext password to Super Admin credential vault
    await storeUserCredentialHelper(
      sessionUser.id,
      sessionUser.email,
      data.newPassword,
      sessionUser.name || 'User Self Service',
    )

    // Audit log
    await logAudit(
      sessionUser.name || 'User',
      'auth',
      'password_change',
      `User ${sessionUser.name} (${sessionUser.email || sessionUser.id}, role: ${sessionUser.role}) changed their account password`,
    )

    return {
      success: true,
      message: 'Password changed successfully',
    }
  })
