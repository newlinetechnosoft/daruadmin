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

## Migrations & Schema Safety (Neon Only)

### Non-negotiable Rules
1. **Never run migrations or DB writes from coding agents.** The database is Neon only. You write SQL and code; the owner runs SQL in the Neon SQL Editor.
2. **Always backup first.** Take a Neon branch backup before applying any schema modification or migration tracking SQL.
3. **No `db:push` or unreviewed `db:generate`.** `db:push` is prohibited on shared/production branches. `drizzle-kit generate` is currently disconnected (see below); migrations are authored as reviewed, idempotent SQL.
4. **Safety guards on scripts:** `src/db/clean.ts` and `src/db/seed.ts` refuse to run unless explicitly passed `--confirm`. They print the DB host (never secrets/passwords) and check `NEON_BRANCH`.

### The Drizzle Migrator Mechanism & Journal Invariant
Drizzle ORM's migrator checks the tracking table `drizzle.__drizzle_migrations`:
```sql
SELECT "id", "hash", "created_at" FROM "drizzle"."__drizzle_migrations" ORDER BY "created_at" DESC LIMIT 1
```
It compares the newest `created_at` timestamp with the `when` field of each entry in `drizzle/meta/_journal.json`. Any migration whose `when` is greater than that database timestamp will be executed. The `hash` stored in the tracking table is the SHA-256 hex digest of the exact file contents:
```ts
crypto.createHash("sha256").update(sqlFileContent).digest("hex")
```

**Every migration file `drizzle/XXXX_*.sql` MUST be registered in `drizzle/meta/_journal.json`** with:
- `idx` equal to the migration index.
- `when` strictly increasing and greater than the previous entry.
- File name matching `drizzle/XXXX_*.sql`.

Automated verification is enforced via `bun test src/db/migrations.test.ts`, which asserts journal/file parity, strictly increasing timestamps, error-free execution on an in-memory Postgres (PGlite), and 100% column/table coverage against `src/db/schema`.

### Why Snapshots Stop at `0001`
The directory `drizzle/meta/` only contains snapshots for `0000_snapshot.json` and `0001_snapshot.json`. Historical migrations `0002` through `0015` were authored directly as SQL without updating the snapshot meta files. As a result, running `drizzle-kit generate` compares against snapshot `0001` and attempts to re-generate hundreds of lines of conflicting changes. 
**Do not edit snapshots manually without an approved schema snapshot regeneration plan.**

### Analysis of Historical Migrations on Populated Databases
- `0000_dusty_lyja.sql` through `0004_order_items_dealer_id.sql`: Schema baseline and additive changes.
- `0005_order_state_machine.sql`: **Mild.** Flags existing orders that have `rider_id IS NOT NULL AND dealer_id IS NULL` as `is_legacy = true`. Does not touch products.
- `0006_dealer_sourcing.sql`: **DANGEROUS on populated data.** Unconditionally resets `sourcing_status = 'assigned'` and recalculates `dealer_cost_price` for all order items where `dealer_id IS NOT NULL`.
- `0007_double_entry_accounting.sql`: **Safe.** Uses `IF NOT EXISTS` for all tables/indexes and `ON CONFLICT DO NOTHING` for all chart of accounts and voucher sequence seeds.
- `0008_pricing_promotions_and_settlements.sql`: **DANGEROUS on populated data.** Contains `ON CONFLICT (id) DO UPDATE SET delivery_charge = EXCLUDED.delivery_charge, active = EXCLUDED.active;` which overwrites custom shipping zone rates and active flags.
- `0009_rider_shifts_offers_customer_addresses.sql` through `0017_db_level_integrity.sql`: **Safe.** Fully guarded, idempotent DDL using `IF NOT EXISTS`, constraint existence checks, and idempotent trigger functions. `0016` hardens reversal columns and FKs; `0017` introduces DB-level deferred constraint triggers and mutation prevention triggers for accounting immutability.

Because of `0006` and `0008`, migrations must never be blindly re-run across existing branches. Tracking alignment via `tracking-sql.ts` is required.

### Neon Tracking Repair Procedure
When Neon's `drizzle.__drizzle_migrations` table contains corrupted rows or has fallen behind the journal (e.g. malformed row 8 storing tag name `'0007_double_entry_accounting'` with an older timestamp `1792148989282`):
1. Run `bun run src/db/tools/tracking-sql.ts` to output the exact corrective Neon transaction.
2. In the Neon Console SQL Editor (after taking a branch backup), run the generated transaction inside `BEGIN; ... COMMIT;`. This deletes the bad row and inserts valid SHA-256 hashes and monotonic timestamps for `0007` through `0017`.
3. Run `bun run src/db/tools/schema-check.ts` to generate the schema completeness verification query. Run that query in Neon SQL Editor; returning 0 rows verifies that Neon already has 100% of expected tables and columns.

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
