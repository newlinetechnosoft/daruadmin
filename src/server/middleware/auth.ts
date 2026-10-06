import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

export async function getServerSession() {
  try {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers: new Headers(headers as unknown as Record<string, string>),
    })
    return session
  } catch (err) {
    console.warn('getServerSession warning:', err)
    return null
  }
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session?.user) {
    throw new Error('Unauthorized: Please sign in')
  }
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  const user = session.user as typeof session.user & { role?: string }
  if (user.role !== 'admin') {
    throw new Error('Forbidden: Administrator privileges required')
  }
  return session
}
