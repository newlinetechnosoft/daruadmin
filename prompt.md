# Task: Role/permission architecture refactor for the Mezmani admin app (TanStack Start + React)

## Context
- Stack: TanStack Router/Start (createFileRoute, createServerFn-style `*Fn` functions), React, shadcn/ui, Neon Postgres, better-auth (`authClient`).
- Current state:
  - `routes/admin/route.tsx` guards with `checkAdminSessionFn` (authenticated + isAdmin only) and renders a hardcoded `NAV_GROUPS` sidebar.
  - All admin pages (index, orders, inventory, grocery, liquor, taxonomy, customers, riders, staff, shipping, accounts, payments, marketing, reports, settings, users) contain their full UI inside the route file.
  - `routes/admin/staff.tsx` has a permission matrix (`MODULES` x `ACTIONS` from `#/server/operations/types`) saved via `savePermissionsFn` and read from `ops.permissions[userId]`. It falls back to hardcoded default grants when none exist. Admin role = full access.
  - `getOpsBundleFn` returns orders, ledger, riders, audit, permissions, settings, etc. in one payload to every page.
  - Server functions do not check per-module permissions.
- Note: `routes/admin/index.tsx` imports from `#/components/admin/...` while all other pages import from `#/components/shared/...`. Consolidate to one location.

## Goals
1. Separate UI from routing: page bodies live in `components/panels/<module>/`, route files become thin wrappers.
2. Panels per role: `/admin` (admin + manager), `/rider` (rider only). Other roles must never load or see another panel's code or data.
3. Permission model like Frappe/ERPNext: roles hold (module, action) grants, admin bypasses, the UI hides what you cannot do, and the SERVER is the real enforcement.
4. Riders and similar roles only get row-scoped data (e.g. their own assigned orders).

## Rules
- Do NOT change visible behavior or styling of existing admin pages unless required.
- Default to deny: no grant means no access.
- UI hiding is cosmetic. Every server function must enforce permissions itself.
- Work in phases. After each phase run typecheck/lint and fix errors before continuing. Summarize what changed at the end of each phase.
- Do not delete existing server functions until their replacements are wired in.

## Phase 1: Permission core (server)
- Create `server/auth/permissions.ts` (or similar) with:
  - `getSessionUser()`: returns the current user (id, role, isActive) or throws 401. Suspended users (`isActive === false`) must be rejected.
  - `getUserGrants(user)`: admin returns all MODULES x ACTIONS; others read from the stored permissions, falling back to ONE shared `DEFAULT_GRANTS_BY_ROLE` constant (manager, rider). Move the hardcoded defaults currently duplicated in `staff.tsx` into this constant and import it in both places so UI and server never disagree.
  - `can(grants, module, action)` pure helper (usable on client and server).
  - `requirePermission(module, action)`: calls getSessionUser + getUserGrants, throws 403 if missing, returns `{ user, grants }`.
  - `requireRole(...roles)`.
- Log denied attempts and permission changes to the existing audit log.

## Phase 2: Enforce on server functions
- Add `requirePermission` / `requireRole` to EVERY function in `operations.functions` and `catalog.functions` (orders, ledger/accounts, payments, riders, shipping, marketing, settings, reports, users/role updates, catalog CRUD, etc.). Map each to a module + action (view / create / edit / delete as appropriate). Settings, role changes and permission saves should be admin-only.
- Split `getOpsBundleFn` into per-module functions (`getOrdersFn`, `getLedgerFn`, `getRidersFn`, `getPaymentsFn`, `getShippingFn`, `getMarketingFn`, `getAuditFn`, `getSettingsFn`, ...), each guarded by its own `view` permission and returning only what that page needs. Update each route loader to call only what it needs. Keep `getOpsBundleFn` temporarily only if something still depends on it, then remove.
- `getAdminChromeFn`, `globalSearchFn`: filter results by the user's grants (e.g. do not return customers or orders to someone without those view permissions).
- Provide a `getMyAccessFn` that returns `{ user, grants }` for the client.

## Phase 3: Route guards and context
- In `routes/admin/route.tsx` `beforeLoad`: allow admin and manager only; load `{ user, grants }` once and return them in route context. Redirect others (rider to `/rider`, customer to `/`, unauthenticated to `/login`).
- Add a per-child-route guard using a helper like `guardModule('orders')` that throws a redirect to a `/admin/forbidden` (or dashboard) page when `can(grants, module, 'view')` is false.
- Add `module` to each `NavItem` in `NAV_GROUPS` and filter the sidebar by `can(grants, item.module, 'view')`. Hide empty groups. Hide the command-palette result groups the user cannot view.
- Create a client hook `usePermissions()` exposing `can(module, action)` from route context, and use it to hide or disable action buttons (create, edit, delete, settle, reconcile, approve, etc.) in panels.

## Phase 4: Move UI into panels
- Create `components/panels/<module>/` for each admin module (dashboard, orders, inventory, grocery, liquor, taxonomy, customers, riders, staff, shipping, accounts, payments, marketing, reports, settings, users), containing the page component and its dialogs.
- Move shared pieces (page-header, kpi-card, status-badge, empty-state, confirm-dialog, charts) to ONE location and fix all imports.
- Each `routes/admin/<module>.tsx` becomes: `createFileRoute` + guard + loader + `component: () => <XPanel />`. Panels receive loader data via props or `getRouteApi('/admin/<module>').useLoaderData()`. Target is about 10-20 lines per route file.
- No behavior changes in this phase, only moves.

## Phase 5: Rider panel
- Create `routes/rider/route.tsx` (guard: role === 'rider' and isActive, own layout/nav) and pages such as `deliveries`, `earnings` / `cash-in-hand`, `profile`, built from `components/panels/rider/`.
- Server side data scoping: rider functions must filter by the logged-in rider (`where riderId = user's rider record`) in the query itself. A rider must never be able to pass another rider's id. Riders can only update status on their own assigned orders (e.g. out_for_delivery, delivered), not edit prices, customers, etc.
- Admin and manager panels must not import rider panel code and vice versa (separate bundles per panel).

## Phase 6: Staff matrix wiring
- `staff.tsx` matrix should read/write via the same `getUserGrants` / `savePermissionsFn` path, prevent editing admins, and prevent a user from granting permissions they do not hold themselves (only admins edit the matrix).
- After saving, invalidate the router so the sidebar updates.
- Role changes (`updateUserRoleFn`) are admin-only, must not allow demoting the last remaining admin, and should be audit-logged.

## Deliverables
- Summary of files created/moved/deleted.
- A table mapping each server function to the (module, action) it now requires.
- List of anything ambiguous you decided, and any places where permission checks could not be applied.
- Manual test checklist: admin, manager with limited grants, rider, suspended user, unauthenticated; including calling server functions directly while lacking permission (must return 403).
