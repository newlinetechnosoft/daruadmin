# src/routes — pages, layouts, guards

**Scope:** TanStack Router file-based routes for all four panels + storefront.
**Read when:** adding/changing a page, URL, layout, guard, loader, or search params.
**Not here:** UI building rules → `src/components/AGENT.md` · server functions → `src/server/AGENT.md`.

## Conventions

- Layout = `route.tsx`; pathless layout = `_name/`; dynamic = `$param`. **Never edit `src/routeTree.gen.ts`.**
- Each panel layout (`admin/`, `manager/`, `rider/`, `account/`) has a `beforeLoad` that checks the session + role and redirects to `/sign-in` or the user's own panel. This is **UX only** — real security is the role middleware on server functions.
- Admin/Manager layout: shadcn `Sidebar` + breadcrumb header + notification bell. Rider layout: **mobile-first**, bottom nav, `Drawer` instead of `Dialog`.
- `loader` prefetches with TanStack Query (`ensureQueryData`); components read via `useSuspenseQuery`.
- Filters, sorting, pagination, tabs live in **URL search params**, validated with Zod (`validateSearch`) — never in local state only.
- Every route sets (or inherits) `pendingComponent` (Skeleton), `errorComponent`, `notFoundComponent`. Set `head()` meta on public pages.
- Routes never import `#/db` or server secrets — call server functions only.

## Storefront behavior

- **Age gate:** shadcn `AlertDialog` in `_store/route.tsx`. "I am 18+" sets cookie `age_verified` (~30 days); "No" → blocked screen. Read the cookie in the layout loader to avoid a flash after hydration. Text/duration from `site_settings`.
- **Cart:** client-side (context + `localStorage`, client-only render to avoid hydration mismatch). Server re-prices at checkout.
- **Checkout:** address + map pin (lat/lng needed for nearest-dealer), 18+ checkbox ("will show ID on delivery"), payment = COD. Place order with a client-generated idempotency key.
- Customers can cancel only before pickup.

## Route map

| URL                                                                          | File                              | Role              | Purpose                                                                          | Status |
| ---------------------------------------------------------------------------- | --------------------------------- | ----------------- | -------------------------------------------------------------------------------- | ------ |
| —                                                                            | `__root.tsx`                      | public            | Storefront root: AgeGate, CartSheet, Toaster, SEO                                | ✅     |
| `/`                                                                          | `index.tsx`                       | public            | Home (Kathmandu express storefront similar to Barmandoo)                         | ✅     |
| `/drinks`                                                                    | `drinks.tsx`                      | public            | Drinks/Alcohol listing (filters: category, brand, query) + variant picker        | ✅     |
| `/grocery`                                                                   | `grocery.tsx`                     | public            | Food & Munchies listing (filters: category, query)                               | ✅     |
| `/cart`, `/checkout`                                                         | `_store/`                         | public / customer | Cart review / checkout                                                           | ⬜     |
| `/sign-in`, `/sign-up`                                                       | `sign-in.tsx`, `sign-up.tsx`      | public            | Auth                                                                             | ⬜     |
| `/account`, `/account/orders`, `/account/orders/$orderNo`                    | `account/`                        | customer          | Profile, addresses, history, tracking                                            | ⬜     |
| `/admin`                                                                     | `admin/route.tsx`, `index.tsx`    | admin             | Layout + dashboard                                                               | ⬜     |
| `/admin/liquor/products[/$id]`, `/admin/grocery/products[/$id]`              | `admin/liquor/`, `admin/grocery/` | admin             | Product + variant CRUD, images, availability                                     | ⬜     |
| `/admin/liquor/categories`, `…/brands`, `/admin/grocery/categories`          |                                   | admin             | Taxonomy                                                                         | ⬜     |
| `/admin/orders[/$orderNo]`                                                   |                                   | admin             | All orders                                                                       | ⬜     |
| `/admin/dealers[/$id]`                                                       |                                   | admin             | Dealer CRUD, stock, settlement history                                           | ⬜     |
| `/admin/users` (tabs: customers / managers / riders)                         |                                   | admin             | List, create staff, activate/deactivate, role                                    | ⬜     |
| `/admin/stock`                                                               |                                   | admin             | Stock overview + movements                                                       | ⬜     |
| `/admin/ledger`, `/accounts`, `/journal`                                     |                                   | admin             | Chart of accounts, statements, manual journal                                    | ⬜     |
| `/admin/invoices`                                                            |                                   | admin             | Invoice list / print                                                             | ⬜     |
| `/admin/reports/*`                                                           |                                   | admin             | sales, vat, profit, dealer-settlement, rider-cash, stock                         | ⬜     |
| `/admin/settings` (tabs: general, tax & fees, **payment gateway**, age gate) |                                   | admin             | Site settings                                                                    | ⬜     |
| `/admin/audit-log`                                                           |                                   | admin             | Audit trail                                                                      | ⬜     |
| `/manager`                                                                   | `manager/route.tsx`, `index.tsx`  | manager (+admin)  | Layout + live order queue                                                        | ⬜     |
| `/manager/orders[/$orderNo]`                                                 |                                   | manager           | Confirm, **assign dealer** (nearest list), **assign rider**, cancel              | ⬜     |
| `/manager/dealers`, `/manager/riders`                                        |                                   | manager           | View dealers / riders                                                            | ⬜     |
| `/manager/settlements`, `/manager/cash`                                      |                                   | manager           | Dealer settlements / rider cash handover                                         | ⬜     |
| `/manager/stock`, `/manager/reports`                                         |                                   | manager           | Stock adjust + availability / operational reports                                | ⬜     |
| `/rider`                                                                     | `rider/route.tsx`, `index.tsx`    | rider             | Mobile layout + my assigned orders                                               | ⬜     |
| `/rider/orders/$orderNo`                                                     |                                   | rider             | Pickup (dealer) + delivery address, call/map links, status buttons, collect cash | ⬜     |
| `/rider/history`, `/rider/cash`                                              |                                   | rider             | Completed deliveries / cash held vs handed over                                  | ⬜     |
| `/api/auth/$`                                                                | `api/auth/$.ts`                   | –                 | better-auth handler                                                              | ✅     |
| `/api/webhooks/esewa`                                                        | `api/webhooks/esewa.ts`           | –                 | eSewa callback (Phase 6)                                                         | ⬜     |

## Assumptions to confirm

- Guest checkout? Default: account required (phone mandatory).
- Delivery area limits / operating hours — unspecified.
- Address input = text + map pin (free map library).

_Update this file when you add/rename routes or change their status._
