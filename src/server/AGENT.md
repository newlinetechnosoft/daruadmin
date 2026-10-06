# src/server — server functions: conventions

**Scope:** how ALL server code is written. Domain-specific API lives in the subdirectory files.
**Read when:** creating/changing any server function, middleware, or server-side helper.
**Not here:** UI → `src/components/AGENT.md` · tables → `src/db/AGENT.md`.

## Domains (read only the one you need)
| Dir | Covers | Doc |
|---|---|---|
| `middleware/` | auth + role middleware | this file |
| `catalog/` | products, categories, brands, variants, images | `catalog/AGENT.md` |
| `orders/` | placing orders, manager ops, rider ops, status machine usage | `orders/AGENT.md` |
| `inventory/` | dealers, dealer stock, stock movements | `inventory/AGENT.md` |
| `finance/` | ledger, VAT, invoices, settlements, cash, payments, reports | `finance/AGENT.md` |
| `platform/` | users, site settings, gateway config, notifications, audit | `platform/AGENT.md` |

## File layout per domain
```
<domain>/
  <topic>.schemas.ts     # Zod schemas (shared with forms in the UI)
  <topic>.queries.ts     # db logic (server-only, no createServerFn)
  <topic>.functions.ts   # createServerFn exports (what the UI calls)
  AGENT.md
```

## Writing a server function (shape — verify against the installed TanStack Start version)
```ts
export const assignRider = createServerFn({ method: 'POST' })
  .middleware([requireRole('admin', 'manager')])
  .inputValidator(assignRiderSchema)          // Zod
  .handler(async ({ data, context }) => {
    return assignRiderQuery(data, context.user) // db work lives in *.queries.ts
  })
```

## Rules
1. **Every function** has a role middleware (`requireRole(...)`). The only exceptions are explicitly public storefront reads (catalog list/detail, public site settings).
2. **Validate all input with Zod.** Never accept prices, totals, user IDs, or roles from the client — derive from DB/session.
3. Use **`dbTx.transaction()`** for anything touching money, stock, ledger, or multiple tables; use `db` (neon-http) for plain reads. See `src/db/AGENT.md`.
4. Status changes only through `transition()` in `#/lib/order-status`. Ledger writes only through `finance/post.ts`.
5. **Audit-log** every admin/manager mutation (`platform/audit.ts`).
6. Errors: throw typed errors (`NotFound`, `Forbidden`, `Conflict`, `ValidationError`) with user-safe messages; never leak SQL or stack traces. The UI turns them into toasts/inline errors.
7. Import `#/db`, secrets, and storage only inside `src/server/**`. Components/routes call functions only.
8. Pagination everywhere: `{ page, pageSize ≤ 100, sort, filters }` → `{ rows, total }`.
9. Be idempotent where retries are likely (order placement, payment callbacks, cash handover).
10. Keep functions small; shared logic goes in `*.queries.ts` or `#/lib`.

## middleware/ (status)
| File | Purpose | Status |
|---|---|---|
| `middleware/auth.ts` | `authMiddleware` — loads session, rejects missing/deactivated/banned users | ⬜ |
| `middleware/role.ts` | `requireRole(...roles)` — wraps auth, 403 on mismatch | ⬜ |

_Update this file's conventions or middleware table when they change; domain specifics go in the domain's AGENT.md._
