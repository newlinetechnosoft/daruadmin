# AGENT.md — Mezmani (root index)

> **This file is an index, not the full manual.** Do **not** load every doc for every task.
> Find your task in the router (§2) and read **only** the AGENT.md file(s) it points to. Each directory's AGENT.md is the source of truth for that directory (rules, structure, API, status).

## 1. What Mezmani is

Dynamic e-commerce + ERP back-office for the **Nepal** market (NPR, VAT, English only, `Asia/Kathmandu`).

- **Two separate catalogs:** **Liquor** (hard/soft drinks, sold by variant e.g. 200 ml / 750 ml) and **Grocery**.
- **Four panels, one app:** Storefront/Customer, Rider (mobile web), Manager, Admin.
- **Flow (COD only for now):** customer orders → manager notified → manager assigns a nearby **dealer** → manager manually assigns a **rider** → rider picks up at dealer, delivers, collects cash → rider hands cash to manager → manager settles with dealer → everything recorded in the **ledger**.
- **Age gate:** visitors confirm 18+ on opening the site.
- **Out of scope for now:** branches, warehouses, multi-language, online payment (eSewa is planned, Phase 6).

| Role       | Summary                                                                           |
| ---------- | --------------------------------------------------------------------------------- |
| `admin`    | Manages everything (users, catalog, dealers, settings, gateway, ledger, reports). |
| `manager`  | Orders, dealer/rider assignment, stock, settlements, limited ledger entries.      |
| `rider`    | Sees only orders assigned to them; notified; updates delivery; collects cash.     |
| `customer` | Browses, orders, tracks own orders.                                               |

Full permission matrix: `src/lib/AGENT.md`.

## 2. Task router — read ONLY what applies

| If your task involves…                                                                                                                         | Read                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Anything visual** — creating/restyling a page, component, form, table, dialog, layout; colors, typography, spacing, look & feel, responsive | **`UI_APPROACH.md` first**, then `src/components/AGENT.md` |
| Pages, URLs, layouts, route guards, loaders, search params, storefront behavior (age gate, cart)                                               | `src/routes/AGENT.md`                                      |
| **Any UI** — component structure, forms, tables, dialogs, sidebar, toasts, loading/empty states, Tailwind, mobile layout                       | `src/components/AGENT.md` (+ `UI_APPROACH.md` for the look) |
| Adding/updating a shadcn component                                                                                                             | `src/components/ui/AGENT.md` (+ `src/components/AGENT.md`) |
| How to write a server function, middleware, errors, transactions                                                                               | `src/server/AGENT.md`                                      |
| Products, categories, brands, variants, product images                                                                                         | `src/server/catalog/AGENT.md`                              |
| Cart→order, checkout, order status, assign dealer/rider, rider delivery actions                                                                | `src/server/orders/AGENT.md`                               |
| Dealers, dealer stock, stock movements, low-stock                                                                                              | `src/server/inventory/AGENT.md`                            |
| Ledger, VAT, invoices, dealer settlement, rider cash, payments/eSewa, reports                                                                  | `src/server/finance/AGENT.md`                              |
| Activate/deactivate users, staff accounts, site settings, gateway config, notifications, audit log                                             | `src/server/platform/AGENT.md`                             |
| Tables, columns, migrations, DB drivers                                                                                                        | `src/db/AGENT.md`                                          |
| Auth config, roles/permissions, money/VAT helpers, order-status machine, storage adapter, utils                                                | `src/lib/AGENT.md`                                         |
| **Committing** — writing a commit message or being asked to commit                                                                             | `commit_rule.md`                                           |

A task that spans areas (e.g. "new admin page for dealers") → read each relevant file (`UI_APPROACH` + `routes` + `components` + `server/inventory`), nothing else.

## 3. Tech stack (compact)

TanStack Start (React 19, file routing) on **Vercel only** · Neon Postgres + Drizzle (`neon-http` + `neon-serverless`, **never `pg`**) · better-auth (Drizzle adapter + admin plugin) · **shadcn/ui** (new-york, zinc) + Tailwind v4 + lucide-react · TanStack Query · `@tanstack/react-table` · Neon Object Storage (S3-compatible, beta) behind an adapter.
Path alias: `#/*` → `./src/*`.

## 4. Commands

```bash
bun install
bun run dev            # port 3000
bun run build
bun run lint
bun run format
bun run check          # prettier --check
bun run db:generate | db:migrate | db:studio     # db:push = throwaway dev only
bunx --bun shadcn@latest add <component>
bunx tsc --noEmit
# If bun errors, use npm/npx. Do NOT commit package-lock.json (only bun.lock).
```

## 5. Non-negotiable rules (details live in the directory files)

1. **UI is built from shadcn components. Never create primitives from scratch.** (`src/components/AGENT.md`) **Its look (tokens, typography, shape, layouts) is defined in `UI_APPROACH.md` — follow it for every UI task.**
2. **All server logic = `createServerFn`/server routes inside `src/server/`**, with Zod validation and role middleware on every function. UI code never imports `#/db` or secrets.
3. **Money = integer paisa.** Format only at the UI edge.
4. **Money / stock / ledger changes run in one DB transaction (`dbTx`).** Ledger is append-only; reverse, never edit.
5. **Soft-delete/archive** referenced data; **snapshot** product/price/address on orders.
6. **No secrets in client code** (`VITE_*` is public). Never commit `.env.local`.
7. Don't hand-edit `src/routeTree.gen.ts` or (normally) `src/components/ui/*`.
8. If a decision isn't documented, **ask the owner** — see "Assumptions to confirm" at the top of each directory file.
9. Before finishing: `bun run lint`, `bun run check`, `bunx tsc --noEmit` pass.
10. **UI tasks are visual only** unless asked: never change loaders, server functions, routing, cart logic, form state or data shapes while restyling. No emoji, no new global CSS classes or unlayered element selectors in `styles.css` (see `UI_APPROACH.md` §2).
11. **Never commit (or push) on your own — only when the user explicitly asks.** When asked, follow `commit_rule.md` exactly.

## 6. Progress (phase level — details are in each directory file)

| Phase             | Scope                                                                                                                                                                                                                                     | Status |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0 Foundation      | Remove demo files (`src/db.ts`, `db/init.sql`, `.cursorrules`, todos schema, `pg`); new db drivers; better-auth + Drizzle + roles; install base shadcn set; role middleware; panel layouts + guards; seed first admin; `typecheck` script | ✅     |
| 1 Catalog (admin) | Categories/brands, liquor + grocery products/variants, images                                                                                                                                                                             | 🟨     |
| 2 Storefront      | Age gate, listings, detail, cart, COD checkout, customer account                                                                                                                                                                          | 🟨     |
| 3 Operations      | Manager panel, dealers, nearest-dealer, rider assignment, rider mobile panel, notifications                                                                                                                                               | ⬜     |
| 4 Stock & Finance | Stock tracking, ledger, invoices, cash handover, dealer settlements                                                                                                                                                                       | ⬜     |
| 5 Admin ERP       | User management, settings, reports, audit log, dashboards                                                                                                                                                                                 | ⬜     |
| 6 Growth          | eSewa, Web Push, SMS, coupons, SEO, tests                                                                                                                                                                                                 | ⬜     |

Legend: ⬜ not started · 🟨 in progress · ✅ done · 🗑 remove

## 7. Maintaining these docs

- After finishing a task, update **only the AGENT.md of the directory you changed** (status symbols, route/API/schema tables, "Assumptions"). Update this root file only for the phase table or a new directory.
- **Visual/design changes** (new token, recipe, page pattern, restyled screen) → update `UI_APPROACH.md` (§ Status + the relevant section), not the directory files.
- Adding a new directory with real logic? Create its `AGENT.md` (Scope · Read when · Rules · Structure · Status) and add a row to the router in §2.
- Keep each file focused; if one grows past ~250 lines, split it.

## 8. Changelog

| Date       | Change                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| _YYYY-MM-DD_ | Initial docs created from scaffold                                                    |
| 2026-10-07 | Added `UI_APPROACH.md` (visual design system); router row, rule 1/10 and §7 updated     |
| 2026-10-07 | Added `commit_rule.md`; router row and rule 11 (no self-commits)                        |
