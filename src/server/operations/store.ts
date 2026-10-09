import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { opsKv } from '#/db/schema'
import type { OpsState } from './types'
import { defaultOpsState, seedOpsFromCatalog } from './seed-ops'
import {
  getAdminGroceryProductsQuery,
  getAdminLiquorProductsQuery,
  getAdminUsersQuery,
} from '#/server/catalog/catalog.queries'

const OPS_KEY = 'mezmani-ops-v1'

type GlobalOps = typeof globalThis & {
  __mezmaniOps?: OpsState
  __mezmaniOpsLoaded?: boolean
}

function g(): GlobalOps {
  return globalThis as GlobalOps
}

async function readFromDb(): Promise<OpsState | null> {
  try {
    const rows = await db
      .select()
      .from(opsKv)
      .where(eq(opsKv.key, OPS_KEY))
      .limit(1)
    const value = rows[0]?.value
    if (!value || typeof value !== 'object') return null
    return { ...defaultOpsState(), ...(value as Partial<OpsState>) }
  } catch {
    return null
  }
}

async function writeToDb(state: OpsState) {
  try {
    await db
      .insert(opsKv)
      .values({ key: OPS_KEY, value: state })
      .onConflictDoUpdate({
        target: opsKv.key,
        set: { value: state, updatedAt: new Date() },
      })
    return true
  } catch {
    return false
  }
}

export async function loadOps(): Promise<OpsState> {
  const cache = g()
  if (cache.__mezmaniOps && cache.__mezmaniOpsLoaded) {
    return cache.__mezmaniOps
  }

  let state = await readFromDb()
  if (!state) {
    const [liquor, grocery, users] = await Promise.all([
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
    ])
    state = seedOpsFromCatalog({ liquor, grocery, users })
    await writeToDb(state)
  } else if (state.orders.length === 0) {
    const [liquor, grocery, users] = await Promise.all([
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
    ])
    state = seedOpsFromCatalog({ liquor, grocery, users, base: state })
    await writeToDb(state)
  }

  cache.__mezmaniOps = state
  cache.__mezmaniOpsLoaded = true
  return state
}

export async function saveOps(state: OpsState): Promise<OpsState> {
  const cache = g()
  cache.__mezmaniOps = state
  cache.__mezmaniOpsLoaded = true
  await writeToDb(state)
  return state
}

export async function mutateOps(
  fn: (state: OpsState) => OpsState | void,
): Promise<OpsState> {
  const current = await loadOps()
  const next = fn(current) ?? current
  return saveOps(next)
}

export function nid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
