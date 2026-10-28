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

| URL                                                      | File                             | Role              | Purpose                                                                   | Status |
| -------------------------------------------------------- | -------------------------------- | ----------------- | ------------------------------------------------------------------------- | ------ |
| —                                                        | `__root.tsx`                     | public            | Storefront root: AgeGate, CartSheet, Toaster, SEO                         | ✅     |
| `/`                                                      | `index.tsx`                      | public            | Home (Butwal express storefront similar to Mezmani)                       | ✅     |
| `/drinks`                                                | `drinks.tsx`                     | public            | Drinks/Alcohol listing (filters: category, brand, query) + variant picker | ✅     |
| `/grocery`                                               | `grocery.tsx`                    | public            | Food & Munchies listing (filters: category, query)                        | ✅     |
| `/checkout`                                              | `checkout.tsx`                   | customer          | Order checkout with map pin, live total, COD / eSewa                      | ✅     |
| `/login`, `/signup`                                      | `login.tsx`, `signup.tsx`        | public            | Better-auth sign-in & sign-up forms                                       | ✅     |
| `/favorites`                                             | `favorites.tsx`                  | public / customer | Local IndexedDB favorites panel with optimistic toggle                    | ✅     |
| `/admin`                                                 | `admin/route.tsx`, `index.tsx`   | admin / staff     | Soft two-part rail layout + KPI metrics dashboard                         | ✅     |
| `/admin/orders`                                          | `admin/orders.tsx`               | admin / staff     | Paginated orders list, detail modal, status transitions                   | ✅     |
| `/admin/inventory`                                       | `admin/inventory.tsx`            | admin / staff     | Stock levels, movements, low stock alerts                                 | ✅     |
| `/admin/accounts`, `/admin/payments`                     | `admin/accounts.tsx`, `payments` | admin / staff     | Append-only double-entry ledger & payment transactions                    | ✅     |
| `/admin/riders`                                          | `admin/riders.tsx`               | admin / staff     | Rider fleet directory, cash-on-hand, availability                         | ✅     |
| `/admin/settings`                                        | `admin/settings.tsx`             | admin             | Store settings (VAT, operational parameters, gateways)                    | ✅     |
| `/admin/users`                                           | `admin/users.tsx`                | admin             | Staff roles, active status, customer management                           | ✅     |
| `/rider`                                                 | `rider/route.tsx`, `index.tsx`   | rider             | Mobile-first rider layout + active delivery cockpit                       | ✅     |
| `/rider/deliveries`, `/rider/earnings`, `/rider/profile` | `rider/*.tsx`                    | rider             | Outbox offline-first delivery flow, cash handover, earnings               | ✅     |
| `/api/auth/$`                                            | `api/auth/$.ts`                  | –                 | better-auth server handler                                                | ✅     |

## Assumptions to confirm

- Guest checkout? Default: account required (phone mandatory).
- Delivery area limits / operating hours — unspecified.
- Address input = text + map pin (free map library).

_Update this file when you add/rename routes or change their status._
