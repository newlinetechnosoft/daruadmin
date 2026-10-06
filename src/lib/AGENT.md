# src/lib — auth, permissions, money/tax, state machine, storage, utils

**Read when:** auth setup, roles/permissions, money or VAT helpers, order-status machine, storage adapter, crypto, geo, generic utils.
**Used by:** everything. Keep these modules **pure and well-tested** where possible.

## Files

| File              | Purpose                                                   | Status                                      |
| ----------------- | --------------------------------------------------------- | ------------------------------------------- |
| `utils.ts`        | `cn()` and generic helpers                                | ✅                                          |
| `auth.ts`         | better-auth server instance (**server-only**)             | ✅ Drizzle adapter + admin plugin + cookies |
| `auth-client.ts`  | better-auth client                                        | ✅ adminClient plugin                       |
| `permissions.ts`  | access-control statements + role map                      | ⬜                                          |
| `money.ts`        | `toPaisa`, `fromPaisa`, `formatNPR`, rounding rules       | ✅                                          |
| `tax.ts`          | VAT inclusive/exclusive calc (default 13%)                | ⬜                                          |
| `order-status.ts` | state machine: transitions, allowed roles, `transition()` | ⬜                                          |
| `geo.ts`          | haversine distance, sort-by-nearest                       | ⬜                                          |
| `storage.ts`      | Object-storage adapter (S3-compatible) — server-only      | ⬜                                          |
| `crypto.ts`       | AES-GCM encrypt/decrypt for gateway secrets — server-only | ⬜                                          |

## Auth (better-auth) — target

- `drizzleAdapter(dbTx, { provider: 'pg', schema })`.
- Plugins: `admin({ ac, roles })` (roles + ban/unban); **`tanstackStartCookies()` must be last**.
- Extra user fields: `phone` (required for customers/riders — phone-first market), `isActive`.
- Generate auth tables with the better-auth CLI (`bunx @better-auth/cli generate`; check docs if the CLI name changed) → `src/db/schema/auth.ts` → `db:generate` + `db:migrate`.
- Enable auth rate limiting. Email verification / password reset / phone OTP can come later.
- Deactivated or banned users are rejected in `src/server/middleware/auth.ts`.
- `auth.ts` is server-only; client code uses `auth-client.ts`.

## Permission matrix (assumptions — confirm, then encode in `permissions.ts`)

| Capability                                                  | Admin |     Manager     | Rider | Customer |
| ----------------------------------------------------------- | :---: | :-------------: | :---: | :------: |
| Manage manager/rider accounts (create, activate/deactivate) |  ✅   |  👁 view riders  |   –   |    –     |
| Manage customers (activate/deactivate)                      |  ✅   |     👁 view      |   –   |    –     |
| Catalog create/edit/archive (liquor & grocery)              |  ✅   |        –        |   –   |    –     |
| Toggle availability, adjust stock                           |  ✅   |       ✅        |   –   |    –     |
| Dealers create/edit                                         |  ✅   | 👁 view + settle |   –   |    –     |
| Orders (all) view/confirm/assign/cancel                     |  ✅   |       ✅        |   –   |    –     |
| Orders — own assigned (update status)                       |   –   |        –        |  ✅   |    –     |
| Orders — own (place/view/cancel pre-pickup)                 |   –   |        –        |   –   |    ✅    |
| Cash handover & dealer settlement entries                   |  ✅   |       ✅        |   –   |    –     |
| Manual journal / reverse ledger entries                     |  ✅   |        –        |   –   |    –     |
| Operational reports                                         |  ✅   |       ✅        |   –   |    –     |
| Financial reports (VAT, profit, full ledger)                |  ✅   |        –        |   –   |    –     |
| Site settings, VAT %, fees, **payment gateway**             |  ✅   |        –        |   –   |    –     |
| Audit log                                                   |  ✅   |        –        |   –   |    –     |

## Module rules

- **money.ts:** integer paisa only. `formatNPR(paisa)` → `Rs. 1,250.00` (use `Intl.NumberFormat('en-IN')` grouping). Arithmetic helpers must never produce floats; round half-up at the paisa level, once, at the line level.
- **tax.ts:** default VAT 13% from `site_settings`; prices VAT-inclusive (assumption). `vatFromInclusive(total, rate)`, `netFromInclusive`.
- **order-status.ts:** single map `from → [{ to, roles }]`; `transition(order, to, actor)` validates and returns the history record; no other code may write `orders.status`.
- **storage.ts:** `putObject`, `getPublicUrl`, `deleteObject`, `presignPut` over the AWS S3 SDK. Neon Object Storage is beta + region-limited — keep all provider specifics here so it can be swapped for R2/S3.
- **crypto.ts:** AES-256-GCM with `APP_ENCRYPTION_KEY` (32-byte, base64); random IV per value; never log plaintext.
- **geo.ts:** haversine in km; used by `suggestDealers`.

## Env vars used here

`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ENCRYPTION_KEY`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_BASE_URL` (names may follow Neon's injected vars), later `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Keep `.env.example` updated; confirm `.env*` (except `.env.example`) is gitignored.

_Update statuses and the matrix when decisions change._
