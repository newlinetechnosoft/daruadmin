import { auth } from '#/lib/auth'

export async function checkRestAdminAuth(request: Request): Promise<
  | { authorized: true; user: { id: string; name?: string; email: string; role?: string } }
  | { authorized: false; response: Response }
> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return {
        authorized: false,
        response: new Response(
          JSON.stringify({ error: 'Unauthorized: Authentication required' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      }
    }

    const rawUser = session.user as typeof session.user & { role?: string }
    const role = rawUser.role || 'customer'
    const email = rawUser.email || ''

    const isAuthorized =
      role === 'superadmin' ||
      role === 'admin' ||
      role === 'manager' ||
      email === 'admin@newline.com'

    if (!isAuthorized) {
      return {
        authorized: false,
        response: new Response(
          JSON.stringify({
            error: 'Forbidden: Admin privileges required to manage service zones',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      }
    }

    return {
      authorized: true,
      user: {
        id: rawUser.id,
        name: rawUser.name || 'Admin',
        email: rawUser.email || '',
        role,
      },
    }
  } catch (err) {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ error: 'Authentication error verifying session' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    }
  }
}
