import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { dbTx } from '#/db'
import * as schema from '#/db/schema'

export const auth = betterAuth({
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
  plugins: [
    admin({
      adminRole: 'admin',
      defaultRole: 'customer',
    }),
    tanstackStartCookies(),
  ],
})
