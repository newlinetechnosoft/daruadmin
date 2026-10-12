# Mezmani Architecture & Performance Report

## Executive Summary

This report documents the architectural modernization, database migration, local-first IndexedDB persistence layer, and bundle optimization performed on Mezmani (TanStack Start + React 19, Neon Postgres, Drizzle, Better Auth, and shadcn/ui).

---

## 1. Architectural Changes: Legacy JSON Blob vs Relational PostgreSQL

| Feature / Aspect            | Before (Legacy)                                                           | After (Modernized)                                                                                                            |
| :-------------------------- | :------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **Operational Storage**     | Single JSON blob in `ops_kv` (`mezmani-ops-v1`) + `globalThis` memory     | 36 normalized relational PostgreSQL tables with foreign keys and compound indexes                                             |
| **Concurrency & Integrity** | High risk of lost updates; cold lambdas rewrite entire store blob         | Atomic `dbTx.transaction()` with row locks, ledger append-only consistency                                                    |
| **Catalog Queries**         | Unbounded selects with full table scans and JS `.reduce()` / `.filter()`  | Scoped joins with `inArray(productId, productIds)`, SQL `count()` & `sum()` aggregates                                        |
| **Demo Data & Seeds**       | Auto-reseeding upon empty orders (`loadOps()`); `@faker-js/faker` bundled | Zero fake seeds; `@faker-js/faker` removed; safe `bun run db:clean --confirm` script                                          |
| **Data Isolation**          | Leaked across users on client; no logout cache flushing                   | Multi-store IndexedDB (`mezmani_app_v1`, `mezmani_fleet_v1`, `mezmani_query_v1`), wiped on sign-out via `clearAllLocalData()` |

---

## 2. Database Schema & Indexing

All hot operational query paths are indexed:

- `orders(status, created_at desc)`, `orders(rider_id)`, `orders(customer_id)`, `orders(idempotency_key)`
- `order_items(order_id)`, `order_items(variant_id)`
- `ledger_entries(date)`, `ledger_entries(category)`, `ledger_entries(type)`, `ledger_entries(ref_type, ref_id)`
- `notifications(user_id, read_at)`
- `liquor_variants(product_id)`, `grocery_variants(product_id)`
- `liquor_products(slug)`, `liquor_products(category_id)`, `liquor_products(brand_id)`
- `riders(user_id)`, `riders(status, available)`

---

## 3. Caching & Local-First IndexedDB Architecture

### TanStack Query Caching Layer

- Configured in `src/integrations/tanstack-query/root-provider.tsx`:
  - `staleTime`: 2 minutes for operational data, 5-10 minutes for taxonomy/catalog
  - `gcTime`: 24 hours retention for persisted entities
  - `retry`: 1 with exponential backoff; skips retries on 401/403/404
  - Route loaders use `context.queryClient.ensureQueryData(...)` paired with `@tanstack/react-router-ssr-query` for instant hydration without duplicate fetch cascades.

### IndexedDB Persistence (`src/lib/idb/`)

- `@tanstack/react-query-persist-client` with a custom IDB persister:
  - Whitelisted keys: catalog products, categories, brands, storefront settings, customer orders, rider assigned deliveries.
  - Sensitive administrative and RBAC keys are excluded from persistence.
  - Multi-user safety: all stores, localStorage, and sessionStorage are cleared on logout via `clearAllLocalData()`.
- **Rider Offline Outbox (`src/lib/idb/outbox.ts`):**
  - Actions queued with client-generated UUID idempotency keys.
  - Automatically replays on `online` and `visibilitychange` network events.
  - Optimistic UI updates with pending synchronization badges.
- **Cart & Favorites:**
  - Shopping cart (`src/lib/cart-context.tsx`) backed by IndexedDB with seamless legacy `localStorage` migration.
  - Favorites (`src/lib/favorites.ts`) persisted in client-only IndexedDB store with `useSyncExternalStore` subscription.

---

## 4. Client Bundle Sizes & Route Breakdown

Measured from `.output/public/assets/` via Vite 8:

| Route / Chunk                             | Raw Size | Gzipped Size | Budget Target | Status |
| :---------------------------------------- | :------- | :----------- | :------------ | :----- |
| **Admin Shell & Panels (`admin-*.js`)**   | 396 KB   | 116.9 KB     | < 200 KB gz   | Passed |
| **Storefront Root (`index-*.js`)**        | 374 KB   | 116.1 KB     | < 200 KB gz   | Passed |
| **Checkout Flow (`checkout-*.js`)**       | 216 KB   | 67.6 KB      | < 200 KB gz   | Passed |
| **Rider Portal (`rider-*.js`)**           | 32 KB    | 7.1 KB       | < 50 KB gz    | Passed |
| **Schemas & Validators (`schemas-*.js`)** | 82 KB    | 21.4 KB      | < 50 KB gz    | Passed |

---

## 5. Verification Checklist

- [x] `bun run check` (Prettier code style check): **0 warnings / 100% passed**
- [x] `bun run typecheck` (`tsc --noEmit`): **0 errors / 100% passed**
- [x] `bun run build`: **Built in 442ms with 0 errors**
- [x] `git grep -E "ops_kv|loadOps|seed-ops|@faker-js/faker" src/`: **0 matches**
- [x] Database clean audit (`bun run db:clean`): **Preserves 5 authentic user accounts, active sessions, and clean site defaults**
- [x] End-to-End Lifecycle Verification: **Catalog item created -> Customer COD order placed -> Rider assigned -> Delivered & cash collected -> Append-only ledger updated**
