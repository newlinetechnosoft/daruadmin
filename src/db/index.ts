import { neon, Pool } from '@neondatabase/serverless'
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

const poolUrl = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL!

export const db = drizzleHttp(neon(poolUrl), { schema })
export const dbTx = drizzlePool(new Pool({ connectionString: poolUrl }), {
  schema,
})
