import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { dbTx } from '#/db'
import * as schema from '#/db/schema'

const getBaseURL = () => {
  let url = process.env.BETTER_AUTH_URL
  // If deployed to production but BETTER_AUTH_URL was accidentally left as localhost
  if (process.env.NODE_ENV === 'production' && url?.includes('localhost')) {
    url = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined
  }
  if (url) return url
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export const auth = betterAuth({
  baseURL: getBaseURL(),
  database: drizzleAdapter(dbTx, {
    provider: 'pg',
    schema,
  }),
  user: {
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
      },
      isActive: {
        type: 'boolean',
        defaultValue: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: async (request) => {
    const origins: string[] = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://*.vercel.app',
      'https://*.netlify.app',
    ]

    if (process.env.BETTER_AUTH_URL) {
      origins.push(process.env.BETTER_AUTH_URL)
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    }
    if (process.env.VERCEL_URL) {
      origins.push(`https://${process.env.VERCEL_URL}`)
    }
    if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
      origins.push(
        ...process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((s) => s.trim())
      )
    }

    // Automatically allow same-origin requests dynamically forwarded by reverse proxies
    if (request) {
      const host =
        request.headers.get('x-forwarded-host') || request.headers.get('host')
      const proto = request.headers.get('x-forwarded-proto') || 'https'
      if (host) {
        origins.push(`${proto}://${host}`)
      }
    }

    return origins.filter(Boolean)
  },
  advanced: {
    trustedProxyHeaders: true,
  },
  plugins: [
    admin({
      adminRole: 'admin',
      defaultRole: 'customer',
    }),
    tanstackStartCookies(),
  ],
})
