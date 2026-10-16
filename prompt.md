# PROMPT FOR AI CODING AGENT — Daru Gang (Mezmani)

## ROLE
You are a senior full-stack engineer and ERP architect. You are upgrading an existing delivery-marketplace + back-office app for a Nepal liquor & grocery business into a production-grade system with Frappe/ERPNext-level business logic in these areas: Accounts (double-entry), Selling, Buying-from-dealers, and light HR/Payroll. There is NO inventory. Adapt everything to Nepal: NPR, 13% VAT, PAN/VAT numbers, Bikram Sambat dates, Nepal fiscal year (Shrawan–Ashadh), COD + eSewa.

## PROJECT CONTEXT (already in the repo — read before coding)
- Stack: TanStack Start (React 19) on Vercel, Neon Postgres + Drizzle (`neon-http` for reads, `neon-serverless` `dbTx` for transactions — never `pg`), better-auth, shadcn/ui + Tailwind v4, TanStack Query, Zod, Leaflet, IndexedDB (idb-keyval).
- Read first: root `AGENT.md` (router), then ONLY the directory `AGENT.md` files relevant to the current task (`src/server/AGENT.md`, `finance/`, `orders/`, `inventory/` (being replaced by dealer sourcing), `platform/`, `src/db/AGENT.md`, `src/lib/AGENT.md`; `UI_APPROACH.md` + `src/components/AGENT.md` for any UI). `COMMIT_RULE.md` for commits. The full task checklist is the TODO file in the repo root (`DARU_TODO.md` / `TODO.md`).
- Repo rules: integer paisa for all money; every money/ledger change in ONE `dbTx.transaction()`; ledger is append-only (reverse, never edit); soft-delete referenced data; snapshot product/price/address on orders; all server logic as `createServerFn` with Zod validation + permission check; UI never imports `#/db` or secrets; UI built only from shadcn components; don't hand-edit `routeTree.gen.ts`; do NOT commit or push unless I ask; before finishing run `bun run lint`, `bun run check`, `bunx tsc --noEmit`.
- Roles: admin, manager, rider, customer.
- Business flow: customer signs up/in → adds items to cart → places order (COD or eSewa, with map pin) → manager confirms → manager assigns a dealer per order line (nearest dealer that carries the item) → manager assigns a rider → rider buys/picks up at the dealer (we pay the dealer LATER) → rider delivers and collects cash → rider hands cash to manager → manager settles dealers and riders with a payment record, proof photo and a voucher with a public slug → everything posts to the ledger.

## KNOWN PROBLEMS (verified in code — fix in this order)
1. `updateOrderFn` writes any `status` string directly: no state machine, no transition role/ownership checks, no ledger side effects. Old statuses `packing`/`assigned` conflict with the documented machine.
2. The code tracks stock (`Math.max(0, stock - qty)` on `*_variants.stock`, plus `dealer_stock`) but THE BUSINESS HOLDS NO STOCK. Remove this model; replace with dealer sourcing (availability flag + dealer cost price per item). Do NOT "fix" it with reservations.
3. `ledger_entries` is single-entry with free-text account names; the docs describe a double-entry design that was never built.
4. Delivery (`updateRiderDeliveryStatusFn`) updates rider cash/earnings but posts nothing to the ledger and has no dealer-cost posting. Rider commission is only a % of the delivery charge.
5. Delivery thresholds are hardcoded (`300000`, `15000`); `tax` is always `0` on manual orders.
6. Coupons have a counter but no redemption history, no per-customer limit, no race-safe usage.
7. Managers cannot add/edit items (mismatch between permission matrix, route guards and server functions).
8. `resetOpsFn`/demo reset exists in production code. The archive I shared included `.env.local`: tell me to rotate the secrets; never read or print `.env.local`.
9. Many admin panels are not mobile responsive; some files are huge (`accounts-panel.tsx` ~2.7k lines, `orders-panel.tsx` ~1.5k, `staff-panel.tsx` ~1.4k).

## FINAL REQUIREMENTS (all numbers are initial, configurable settings, not legal approvals)

### Business model
- NO inventory. Never implement stock quantities, reservations, stock deduction, purchase-order stock, GRN or inventory valuation. Remove the existing stock logic (stop writing `*_variants.stock`; archive, don't hard-delete, unused stock tables/columns).
- Cost model: fixed dealer cost price per item per dealer, with price history. Snapshot the dealer cost on each order line when the dealer is assigned. Storefront availability = at least one active dealer has the item marked available.
- Daru Gang is the seller of record and invoices the customer. Dealers do NOT give VAT bills:
  - No input VAT / no VAT Receivable on dealer costs. Post COGS at full dealer cost: Dr COGS / Cr Dealer Payable.
  - Output VAT = VAT component of the VAT-inclusive customer price → VAT Payable.
  - Add a per-dealer flag "provides VAT bill", default OFF, so input VAT can be enabled later without a migration. Don't enable input VAT until I confirm with my accountant.

### Delivery, zones, payments
- Delivery fee Rs. 150; free at or above Rs. 3,000 merchandise value (excluding delivery fee, after discounts). Both in settings, never hardcoded. Zone, distance and time-slot surcharges later via settings.
- Service area: Butwal, Tilottama, Siddharthanagar as three configurable zones, same Rs. 150 fee in each at launch. Default map = Butwal. Reject orders outside zones unless an authorized manager approves an exception (audit-logged). I'll provide zone boundaries later; until then build zones as center point + radius and show me where to edit them.
- Payments: COD + eSewa only. Verify callbacks server-side, validate status AND amount, idempotent, never trust client confirmation. Khalti later.

### Riders
- Cash limit: Rs. 20,000 outstanding COD cash (configurable). At the limit, block NEW COD assignments until a verified handover or a manager-authorized override (audit-logged). Online-paid orders aren't blocked by it.
- Pay: base salary + per-successful-delivery rate, both configurable per rider (I'll enter amounts). Commission % of delivery charge and bonuses/incentives are configurable and DISABLED by default for new riders; existing riders keep their current commission rate until an admin changes it. Keep each component separate in payroll and postings; never double-count the delivery fee.

### Tax
- Prices are VAT-inclusive; store VAT separately. VAT (default 13%) configurable by tax category and effective date.
- Excise/other duties: separate configurable components by product/category/effective date. No invented rates, none enabled by default.
- TDS on dealer payments: configurable per dealer, default OFF. Record gross payable, TDS withheld and net paid separately. No hardcoded rate.
- Ask me before enabling any uncertain tax treatment.

### Accounting & data
- True double-entry. Every posted journal balances. Posted entries are immutable; correct by reversal. NPR in integer paisa, consistent rounding.
- Nepal fiscal year, Bikram Sambat display, Gregorian in the DB. Seed the current FY 2083/84 and the previous one.
- Legacy ledger: archive the 8 existing rows (they look like test data); don't fabricate journals; report unreconciled or ambiguous balances to me.
- Preserve existing order history; backfill only when the meaning is clear.

### Pricing, settlements, refunds
- Server-side pricing engine is authoritative: product offers first, then coupon, then compute VAT from the resulting VAT-inclusive amount. Define explicit rules for allocating a discount across order lines.
- Dealer and rider settlements: partial payments, advances, payment method, transaction reference, proof photos (required before "paid"), approvals, and public voucher pages with unguessable slugs; lifecycle draft → approved → paid.
- Refunds/returns: full and partial, authorized and audit-logged, with credit/debit notes and reversing entries. Returned goods are not inventory.

### Security
- Strict role and ownership checks, audit logs, hide cost/profit from managers, rate limiting, no production demo-reset endpoint.

## MODULE 1 SPEC — ORDER STATE MACHINE (no stock work)
Statuses (strict enum + CHECK constraint): `pending, confirmed, dealer_assigned, rider_assigned, picked_up, out_for_delivery, delivered, delivery_failed, returned, cancelled`.

Transitions (all others rejected):
- pending → confirmed (manager/admin) · confirmed → dealer_assigned (manager/admin; every order line must have a dealer; snapshot dealer cost) · dealer_assigned → rider_assigned (manager/admin) · rider_assigned → picked_up (assigned rider) · picked_up → out_for_delivery (assigned rider) · out_for_delivery → delivered (assigned rider; liquor requires age verification)
- out_for_delivery → delivery_failed and picked_up → delivery_failed (assigned rider, reason required) · delivery_failed → out_for_delivery (reschedule) · delivery_failed → returned (goods returned to dealer)
- Cancel: customer only from pending/confirmed (own orders). Manager/admin up to rider_assigned. picked_up → cancelled is admin only with a required reason. Cancelling an assigned order notifies the rider.
- Online (eSewa) orders unpaid cannot move past pending unless admin overrides with a reason.
- `delivered` is terminal. Post-delivery returns/refunds are separate documents (credit note + return record), not statuses.

Enforcement:
- Status changes ONLY through one `transition()` in `src/lib/order-status.ts` plus a server wrapper (role + ownership checks, history row, side effects in the same transaction). `updateOrderFn` may edit notes/payment status but never status. Rider delivery functions and `createOrderFn` use the same transition function. Add the missing rider "picked up" action.
- Keep today's rider cash/earnings updates on delivery until the accounting module replaces them; leave a clearly marked hook for `postOrderDelivered`.
- `order_status_history`: add `from_status, to_status, actor_id, actor_role, metadata jsonb`; keep legacy `status`/`actor`; backfill `from_status` with `LAG()` per order.
- Legacy status mapping: `packing → confirmed`, `assigned → rider_assigned` (orders and history). Legacy orders that have a rider but no dealer must not fail; allow them to skip `dealer_assigned` only if flagged as legacy.
- Idempotent transitions; server-side re-pricing; never trust client prices.

Migration safety: create a Neon branch/backup first and tell me its name; generate with `drizzle-kit generate` (never `db:push`); run in a single transaction; print before/after counts by status for `orders` and `order_status_history`; show me the migration SQL before running it.

Tests (Vitest): every allowed transition passes and every disallowed one throws; role and ownership checks; legacy mapping; transitions are idempotent.

## HOW TO WORK
1. Logic first, UI second. Order: Module 1 (state machine) → dealer sourcing (remove stock model, dealer prices, cost snapshot) → double-entry accounting core + automatic postings → price engine + coupons → dealer/rider settlements with vouchers → payroll → tax/invoices/reports → permissions fixes → customer features from the TODO → eSewa → mobile pass → test hardening. One module at a time: finish, test, report, then wait for my OK.
2. For each module: read the relevant AGENT.md; propose schema + function list briefly; Drizzle schema + generated migration; pure domain logic in `src/lib` or `src/server/<module>` with unit tests; server functions with Zod + permissions; minimal UI; update that directory's AGENT.md.
3. Keep business logic pure and testable (money, tax, price engine, state machine, journal balancing, payroll) and separate from DB code.
4. End-to-end scenario test (when the modules exist): place order → confirm → assign dealer → assign rider → pick up → deliver → rider cash handover → dealer settlement; assert trial balance debits = credits, Dealer Payable = snapshotted dealer cost, rider cash = 0.
5. Never guess on accounting or tax. If something is unclear, ask me a short list BEFORE building.
6. UI: no emoji, no new global CSS, no invented primitives; follow `UI_APPROACH.md`.
7. After each module report: what changed, files touched, migrations, how to test, open questions.

## DEFINITION OF DONE (per module)
- Schema, migration and backfill ready in the working tree, left uncommitted unless I ask
- Server functions validated (Zod) and permission-checked; money/ledger changes in one transaction
- Unit + scenario tests passing; trial balance always balanced
- Lint, prettier check and `tsc --noEmit` pass
- Relevant `AGENT.md` updated
- Short report to me with open questions

## OPEN INPUTS I WILL PROVIDE LATER
Rider base salary and per-delivery amounts; dealer cost prices per item; exact zone boundaries; accountant's decisions on input VAT, excise and TDS. Build everything configurable so these can be entered without code changes.

## START NOW
1. Read the root `AGENT.md` and the finance, orders and inventory AGENT.md files (skip any you've already read in this session).
2. Implement ONLY Module 1 (order state machine + status migration). No stock work.
3. Show me the migration SQL and wait for my OK before running anything against the real database.
