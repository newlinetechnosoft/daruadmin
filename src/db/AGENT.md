# src/db — Neon + Drizzle (drivers, schema, migrations)

**Read when:** adding/changing tables or columns, migrations, DB connection issues.
**Not here:** query logic → `src/server/<domain>/*.queries.ts`.

## Cleanup needed first (Phase 0)

- 🗑 `src/db.ts` (old Neon client), `db/init.sql`, `src/db/schema.ts` (todos demo), `pg` + `@types/pg` dependencies.
- ⬜ Rewrite `src/db/index.ts` (currently uses `pg`) as below.

## Drivers (decision)

| Export | Driver                                            | Use for                                                                                        |
| ------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `db`   | `drizzle-orm/neon-http`                           | Fast reads / single statements; `db.batch([...])`. **No interactive transactions.**            |
| `dbTx` | `drizzle-orm/neon-serverless` (`Pool`, WebSocket) | **Anything needing `transaction()`**: orders, stock, ledger, settlements, better-auth adapter. |

```ts
// src/db/index.ts (target)
import { neon, Pool } from '@neondatabase/serverless'
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'
const url = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL!
export const db = drizzleHttp(neon(url), { schema })
export const dbTx = drizzlePool(new Pool({ connectionString: url }), { schema })
```

- Runtime = **pooled** URL (`DATABASE_URL_POOLER`). `drizzle-kit` = **direct** `DATABASE_URL` (keep `drizzle.config.ts` on it).
- WebSocket errors on Node < 22 → `neonConfig.webSocketConstructor = ws` (install `ws`). Pool trouble on Vercel → create the Pool per request.

## Migrations

Edit `src/db/schema/*` → `bun run db:generate` → **review the SQL** → `bun run db:migrate`. Commit `drizzle/`. `db:push` only for throwaway local experiments, never production.

## Schema conventions

- One file per domain in `src/db/schema/`, re-exported from `schema/index.ts`.
- IDs: uuid (`defaultRandom()`) or text for business tables; better-auth tables use its generated ids.
- **Money = integer paisa** (never float/decimal-as-number). Timestamps `timestamptz`; `createdAt/updatedAt` on every table.
- Index every FK and common filters (status, createdAt, slug, phone). Unique constraints for slug/sku/order_no/invoice_no.
- Archive columns instead of deletes. Snapshot columns on `order_items` / orders (name, label, price, VAT, address).
- **Polymorphic catalog ref:** `order_items`, `stock_movements`, `dealer_stock` use `catalogType ('liquor'|'grocery') + variantId` (no FK); validate in code via `resolveVariant`.

## Planned tables

| Domain (file)  | Tables                                                                                                                                                                | Status    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `auth.ts`      | `user`, `session`, `account`, `verification` + `role`, `phone`, `isActive`, `banned`                                                                                  | ✅        |
| `liquor.ts`    | `liquor_categories`, `liquor_brands`, `liquor_products`, `liquor_variants` (`volumeMl`, `sku`, `price`, `mrp`, `abv`, `stock`, `isActive`), `liquor_images`           | ✅        |
| `grocery.ts`   | `grocery_categories`, `grocery_products`, `grocery_variants` (`unit`, `quantity`, `sku`, `price`, `mrp`, `stock`, `isActive`), `grocery_images`                       | ✅        |
| `orders.ts`    | `orders` (totals, address + lat/lng, `riderId`, `dealerId`, `paymentMethod/Status`, `ageVerifiedAtDelivery`, `idempotencyKey`), `order_items`, `order_status_history` | ✅        |
| `riders.ts`    | `riders` (profile linked to `user.id`), `rider_cash_handovers`, `settlements`                                                                                         | ✅        |
| `inventory.ts` | `dealers`, `dealer_stock`, `stock_movements` (append-only)                                                                                                            | ✅        |
| `finance.ts`   | `ledger_entries` (append-only double entry), `payments`                                                                                                               | ✅        |
| `platform.ts`  | `notifications`, `audit_logs`, `site_settings`, `user_permissions`, `coupons`, `complaints`, `banners`, `campaigns`, `reviews`, `shipping_zones`                      | ✅        |
| `commerce.ts`  | `ops_kv` legacy single-JSON blob                                                                                                                                      | 🗑 Dropped |

## Seeds

`src/db/seed.ts` (⬜): first admin, chart of accounts, default settings. Run with `bunx tsx src/db/seed.ts`.

## Env

`DATABASE_URL` (direct, migrations) · `DATABASE_URL_POOLER` (runtime). Never commit `.env.local`.

_Update the table status when a schema file is created/migrated._
