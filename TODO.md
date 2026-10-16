# Daru Gang (Mezmani) — Full Development Roadmap

Legend: `[ ]` pending · `[x]` done · `[~]` partly done (exists but needs rework) · 🔴 blocker / logic bug · 🧾 accounting · 📱 mobile

Money is integer **paisa** everywhere. Every money/ledger change runs inside ONE `dbTx.transaction()`.

---

## PART A — Your original TODOs (kept as-is)

### A1. Customer

- [ ] Auth: require login before add-to-cart; fix login flow when adding to cart
- [ ] Checkout: delivery confirmation form
- [ ] ❓ Payment method selection only when order is not COD / eSewa — UNCLEAR: launch has only COD + eSewa, so what other methods would this show? Confirm the intended behavior before building
- [ ] Optional promo code field
- [ ] Leaflet map pin → capture lat/lng (default Butwal)
- [ ] Contact phone pre-filled from user profile, editable
- [ ] Favorites in IndexedDB (local-only, fast)
- [ ] `/drinks`: replace Add/Added with inline `− 1 +` controls, synced with cart sidebar

### A2. Admin

- [ ] Order history section
- [ ] Daily reports (alongside weekly/monthly/yearly)
- [x] 🔴 Managers cannot add/edit items — fix permissions
- [x] Brand CRUD (liquor + grocery)
- [x] Dealer fields (name, PAN/VAT, contact, WhatsApp) + dealer↔item assignment
- [x] Rider account creation

### A3. Offers & promos

- [ ] BOGO, free-delivery items, crossed-out discounted price, slug-based offer pages with banners
- [ ] Promo usage history (customer name, email, phone, order total, discount)

### A4. Bugs

- [ ] Default map location = Butwal
- [ ] Show all product details from DB
- [x] Rider maps open by lat/lng

### A5. Rider

- [ ] Rider salary (expanded in B6)

---

## PART B — NEW: logic & accounting (DO THIS FIRST)

> Findings from reading the code: the docs describe a double-entry ledger, but the code has a **single-entry** `ledger_entries` table with free-text `account` names. Order status is written directly (no state machine). Delivery does not post to the ledger. Coupons have no usage table. Stock is decremented at order creation with `Math.max(0, …)`, but the business keeps NO stock (dealers are third-party shops the rider buys from), so the whole stock-counting model is wrong for this business and must be replaced by dealer sourcing (B7). Fix these before adding features.

### B1. 🔴 Order lifecycle & state machine

- [ ] Create `src/lib/order-status.ts`: one map `from → [{to, roles}]`; nothing else may write `orders.status`
- [ ] Statuses (strict enum + CHECK): pending → confirmed → dealer_assigned → rider_assigned → picked_up → out_for_delivery → delivered; plus delivery_failed (from out_for_delivery or picked_up) → returned | retry, and cancelled
- [ ] Cancel rules: customer only from pending/confirmed (own); manager/admin up to rider_assigned; picked_up → cancelled admin-only with reason; cancelling an assigned order notifies the rider
- [ ] `dealer_assigned` requires every order line to have a dealer (snapshot dealer cost); unpaid eSewa orders can't move past pending unless admin overrides with reason
- [ ] Legacy mapping: `packing → confirmed`, `assigned → rider_assigned` (orders + history); backfill `from_status` with LAG(); legacy orders with rider but no dealer may skip dealer_assigned (flagged)
- [ ] Migration safety: Neon branch backup first, single transaction, before/after counts, show SQL before running
- [ ] Add the missing rider "picked up" action; `updateOrderFn` must never write status
- [ ] Reconcile current statuses (`packing`, `assigned`, etc.) with the machine + data migration
- [ ] Every transition: role check, ownership check, history row (from/to/actor/note), side effects in the same transaction
- [ ] Idempotency on place-order and on every payment/delivery action
- [ ] Server-side re-pricing (never trust client prices); compute VAT, delivery fee, discount on the server
- [ ] Age check: require `ageVerifiedAtDelivery` for liquor orders before `delivered`
- [ ] Failed delivery / return flow with reason, who bears the cost (customer / dealer / company), rider returns goods to dealer, and reversal postings
- [ ] Partial delivery / partial return (line-level)
- [ ] Order edit before dispatch (add/remove items) with recalculated totals

### B2. 🧾 Double-entry accounting core (Frappe-style)

- [ ] New tables: `ledger_accounts` (code, name, root_type asset/liability/equity/income/expense, parent_id, is_group, owner_type/owner_id for per-rider/dealer/customer sub-accounts, is_active), `journal_entries` (voucher_no, date, narration, ref_type/ref_id, posting status draft/submitted/cancelled, reversal_of, created_by), `journal_lines` (account_id, debit, credit, party_type/party_id, cost_center)
- [ ] DB `CHECK` / code guard: sum(debit) = sum(credit) per journal entry
- [ ] Single helper `postJournal(tx, …)` — the ONLY way to write ledger rows
- [ ] Append-only; corrections via `reverseJournal` (admin), never UPDATE/DELETE
- [ ] Seed the current Nepal fiscal year 2083/84 and the previous one
- [ ] Seed a Nepal chart of accounts (Cash, Bank, eSewa, Khalti, Rider Cash Holding, Dealer Payable, Customer Receivable, VAT Payable, VAT Receivable, TDS Payable, Sales, Delivery Income, Discount Allowed, COGS, Salary Expense, Rider Salary Payable, Rider Commission, Rent, Utilities, Round-off, Owner Equity, Retained Earnings)
- [ ] Legacy `ledger_entries` (8 rows, look like test data): archive to `legacy_ledger_archive`, do NOT fabricate journals; report any unreconciled/ambiguous balances
- [ ] Fiscal year table (Nepal FY: Shrawan 1 – Ashadh end), period locking (no postings in closed periods), year-end closing entry
- [ ] Bikram Sambat date display + BS↔AD conversion helper (UI shows BS, DB stores AD)
- [ ] Cost centers (Liquor / Grocery / Delivery) and optional per-dealer/per-rider analytics
- [ ] Round-off handling account for paisa rounding

### B3. 🧾 Standard postings (automatic)

| Event                                                           | Debit                           | Credit                                      |
| --------------------------------------------------------------- | ------------------------------- | ------------------------------------------- |
| Order delivered (COD)                                           | Rider Cash Holding (total)      | Sales (net) + VAT Payable + Delivery Income |
| Order delivered (online, paid)                                  | eSewa/Bank clearing             | Sales + VAT Payable + Delivery Income       |
| Discount / coupon                                               | Discount Allowed                | (reduces Sales line)                        |
| Cost of goods (dealer's price for each order line, at delivery) | COGS                            | Dealer Payable                              |
| Rider hands cash to manager                                     | Cash in Hand                    | Rider Cash Holding                          |
| Dealer settlement paid                                          | Dealer Payable                  | Cash / Bank                                 |
| Refund / return                                                 | Sales Return + VAT Payable      | Cash / Customer Credit                      |
| Rider salary accrued / paid                                     | Salary Expense / Salary Payable | Salary Payable / Cash                       |
| Expense                                                         | Expense account                 | Cash / Bank                                 |
| Dealer short-supply / return / credit note                      | Dealer Payable                  | COGS                                        |

- [ ] Implement `postOrderDelivered`, `postCashHandover`, `postDealerSettlement`, `postRefund`, `postSalary`, `postExpense`, `postDealerCreditNote`
- [ ] Each posting idempotent (unique `ref_type + ref_id + event`)
- [ ] VAT rule: Daru Gang is seller of record; dealers give NO VAT bills → no input VAT / VAT Receivable on dealer cost (COGS at full dealer cost). Add per-dealer flag "provides VAT bill" (default OFF) so input VAT can be enabled later; don't enable until accountant confirms
- [ ] Rider delivery pay (per-delivery rate) posted as its own component, never double-counting the delivery fee

### B4. 🧾 Accounting features

- [ ] General Ledger, Trial Balance, Balance Sheet, Profit & Loss, Cash Flow (date range, compare periods, CSV/PDF export)
- [ ] Account statement per account / per party (dealer, rider, customer) with running balance
- [ ] Manual journal voucher UI (multi-line, balanced check, attachments)
- [ ] Payment vouchers / receipt vouchers, contra (cash↔bank), with sequential voucher numbers
- [ ] Expense management: categories, receipts upload, approval flow (staff submit → admin approve → posts)
- [ ] Bank/eSewa reconciliation (Khalti later): import statement CSV, match to payments, mark reconciled, differences report
- [ ] (Later) Customer credit / store credit wallet; refunds to wallet
- [ ] Accounts Payable aging (dealers). Receivable aging only if credit/B2B customers are added later (launch is COD + eSewa)
- [ ] (Later, low priority) Budgeting per category with variance report
- [ ] Day-end cash closing (Z-report): expected vs counted cash, shortage/excess posting
- [ ] Rider cash reconciliation: cash on hand vs ledger, alert when above limit, overdue handovers
- [ ] Audit trail: who posted/reversed what, with before/after, immutable

### B5. 🧾 Tax (Nepal)

- [ ] VAT default 13%, configurable by tax category AND effective date: prices VAT-inclusive; `vatFromInclusive` / `netFromInclusive` helpers in `src/lib/tax.ts`
- [ ] Excise/other duties: separate configurable components by product/category/effective date; none enabled by default, no invented rates; ask before enabling
- [ ] Sequential tax invoices (`invoice_no` per fiscal year), seller PAN/VAT, optional buyer PAN, printable A4 + thermal 80 mm
- [ ] Credit notes / debit notes linked to invoice
- [ ] Sales Register (IRD format) + monthly VAT return summary (output VAT − input VAT; input VAT is zero unless a dealer's "provides VAT bill" flag is on). Purchase Register only for dealers with that flag
- [ ] TDS on dealer payments: configurable per dealer, default OFF, no hardcoded rate; record gross payable, TDS withheld and net paid separately; TDS payable report
- [ ] Invoice cancellation rules (credit note only, no delete)

### B6. 🧾 Rider payroll & commissions

- [x] Rider pay config per rider: base salary + per-successful-delivery rate (I enter amounts); optional % of delivery charge, distance bonus and incentive tiers are configurable and DISABLED by default for new riders; advance/deduction
- [x] Existing riders keep their current commission rate until an admin changes it
- [ ] Attendance / shift (online-offline time) feeding salary
- [ ] Monthly payroll run: draft → approve → pay → posts to ledger (salary expense, TDS if any, advance recovery)
- [ ] Payslip (printable/PDF), history per rider
- [ ] Cash shortage deducted from salary (optional, with approval)
- [x] Fix: current commission = % of delivery charge only; replace with the configurable per-rider formula above (each component separate in payroll and postings)
- [ ] Staff (manager) salary the same way

### B7. Dealer sourcing (REPLACES stock tracking — we hold no stock)

We do not keep inventory. Each order is bought from a third-party dealer, the rider picks it up and delivers it. So: no stock quantities, no reservations, no purchase orders/GRN, no stock valuation.

- [x] Remove the stock-decrement logic from `createOrderFn` / `placeOrder` (`*_variants.stock`, `Math.max(0, …)`) and stop showing stock counts; replace with an "available / unavailable" flag
- [x] Repurpose `dealer_stock` / `dealer_items` into **dealer item prices**: per dealer + variant: dealer cost price, `is_available`, effective-from date, price history
- [x] Storefront availability = at least one active dealer has the item marked available (no quantities)
- [x] Manager assigns dealer per order line (or per whole order) from dealers who carry the item; nearest-first by distance (haversine)
- [x] Capture dealer cost per order line at assignment (snapshot) → drives COGS, dealer payable, and margin
- [ ] Dealer unavailable / substitute flow: rider or dealer marks a line unavailable → manager reassigns to another dealer or removes the line (customer total recalculated, customer notified)
- [ ] Price difference handling: dealer's actual bill vs expected cost (rider enters actual bill amount + photo of dealer bill)
- [ ] Margin per product / dealer / order (selling price − dealer cost)
- [ ] Retire unused tables/columns after migration: `stock_movements`, `reserved_qty`, stock counters (archive, don't hard-delete)

### B8. Dealers & settlements (with proof + vouchers)

- [x] Add VAT number separate from PAN; "provides VAT bill" flag (default OFF); per-dealer TDS setting (default OFF); credit limit, payment terms (days), opening balance
- [x] Dealer ledger (payable running balance) tied to B2
- [x] Dealer settlement: pick delivered unsettled order lines → create settlement → pay (cash/bank/eSewa) → items marked settled
- [ ] Nearest-dealer suggestion among dealers who carry the item and are marked available (haversine, `src/lib/geo.ts`)
- [ ] Dealer performance: fulfilment rate, avg prep time, rejected orders
- [ ] Dealer rejects/accepts assigned order (WhatsApp deep link)
- [x] **Settlement voucher with public slug:** every dealer settlement and rider settlement gets a unique `slug` (e.g. `/voucher/<slug>`) + sequential voucher number; printable/PDF and shareable via WhatsApp link (unguessable slug, read-only, no login, shows only that voucher; `noindex`, rate-limited, no customer PII)
- [x] **Payment record per settlement:** method (cash / bank transfer / eSewa / Khalti / cheque), amount, paid date, reference/transaction ID, paid by, notes
- [x] **Proof attachments:** photo of receipt / bank slip / signed voucher / dealer bill (upload to S3-compatible storage with compression; multiple per settlement); proof required before a settlement can be marked `paid` (admin override with reason)
- [x] Settlement lifecycle: draft → approved → paid → (optional) disputed / reversed; each step logged with actor + time
- [ ] Partial payments and advance payments against a dealer/rider; remaining balance carried forward; overpayment becomes advance
- [x] Dealer settlement = delivered order lines for that dealer not yet settled, at snapshotted dealer cost, minus returns/credit notes, minus TDS if enabled
- [x] Rider settlement = salary/commission earned − advances − cash shortage ± cash held (ties to B6 payroll + rider cash handover)
- [ ] Settlement statements per dealer/rider: opening balance, orders, payments, closing balance (PDF)

### B9. Orders, delivery & logistics

- [ ] Rider auto-suggest (nearest available, load balanced) with manual override
- [x] Delivery fee Rs. 150, free at or above Rs. 3,000 merchandise value (excluding delivery fee, after discounts) — both in settings, remove hardcoded `300000`/`15000`
- [x] Three configurable zones: Butwal, Tilottama, Siddharthanagar (center + radius until real boundaries are provided), same Rs. 150 fee at launch; zone/distance/time-slot surcharges via settings later
- [ ] Reject orders outside zones unless an authorized manager approves an exception (audit-logged)
- [ ] Delivery time slots + scheduled orders
- [ ] Order tracking page by `trackingCode` (public, no login) with live rider location
- [ ] Proof of delivery (photo / OTP code to customer)
- [ ] Multi-dealer order split: one customer order → multiple pickups → single delivery route
- [x] Rider cash limit Rs. 20,000 outstanding COD (configurable): block NEW COD assignments at the limit until a verified handover or manager-authorized override (audit-logged); online-paid orders not blocked
- [ ] Cancellation reasons, refund workflow, customer notification
- [ ] Cancellation reasons, refund workflow, customer notification

### B10. Pricing, offers & promotions (logic)

- [ ] `offers` table: type (bogo, percent, fixed, free_delivery, bundle), scope (product/variant/category/brand), start/end, slug, banner, heading, priority, stackable flag
- [x] Price engine: one server function computes final price (base → offer → coupon → VAT); used by cart, checkout and invoice
- [ ] Original-price strikethrough data (`compare_at_price`)
- [x] 🔴 `coupon_redemptions` table (coupon, order, customer, discount, created_at) + atomic usage counter (race-safe); per-customer limit; first-order-only; min order; category restrictions
- [ ] Promo usage report (customer, email, phone, order total, discount) + CSV
- [ ] Loyalty points (earn/redeem) and referral codes (later)

### B11. Customers

- [ ] Saved addresses (multiple, default), saved map pins
- [ ] Reorder from past order
- [ ] Order history + invoice download
- [ ] Wallet / store credit balance
- [ ] Phone OTP login (phone-first market) and password reset
- [ ] Complaints/ticket system with status + order link (table exists, build full flow)
- [ ] Reviews moderation (table exists)

### B12. Payments

- [ ] eSewa (launch, with COD): initiate → redirect → server-side verify (validate status AND amount) → idempotent mark-paid; never trust client confirmation; webhook route
- [ ] Khalti (later) / Fonepay via provider-agnostic `payments`
- [ ] Gateway secrets encrypted (`src/lib/crypto.ts`, AES-256-GCM), masked in API
- [ ] Failed/abandoned payment cleanup job; auto-cancel unpaid online orders after N minutes
- [ ] Refund via gateway where API allows; otherwise manual with ledger entry

### B13. Roles, permissions & security

- [x] 🔴 Fix manager add/edit item permission (check `permissions.ts` matrix vs route guards vs server `requirePermission`)
- [ ] Field-level permissions (manager cannot see cost price / profit)
- [ ] Approval workflows (refund > X, dealer price change > X, expense > X → admin approval)
- [ ] Audit log viewer with filters + export; log every ledger/dealer-price/selling-price change
- [ ] Rate limiting on auth & order endpoints; input validation (Zod) on EVERY server fn
- [ ] Soft-delete/archive for referenced data; snapshots of product/price/address on orders (already partly done)
- [x] Remove `resetOpsFn` / demo reset from production builds; protect `db:clean`
- [ ] Rotate any secrets that were ever shared (the uploaded archive contains `.env.local` — treat those keys as exposed)

### B14. Reports & dashboards

- [ ] Daily / weekly / monthly / yearly sales (daily missing)
- [ ] Profit & margin by product, brand, category, dealer
- [ ] Top products, slow movers, most-unavailable items, dealer substitution rate
- [ ] Rider performance, COD outstanding, delivery time SLA
- [ ] Customer cohorts: new vs repeat, LTV, churn
- [ ] Coupon/offer ROI
- [ ] Scheduled email/WhatsApp daily summary to admin
- [ ] All reports: date range, filters, CSV + PDF export, server-side aggregation (SQL `sum/count`, no JS reduce on full tables)

### B15. Platform & notifications

- [ ] In-app notifications (exists) + Web Push for rider/manager
- [ ] SMS/WhatsApp order updates (provider-agnostic adapter)
- [ ] Email receipts (invoice PDF)
- [ ] Background jobs (Vercel Cron): auto-cancel, reminders, daily report, unpaid dealer/rider settlement digest
- [ ] Settings: store info (PAN/VAT, address, logo), VAT %, delivery fees, thresholds, fiscal year, invoice prefix
- [ ] Backups/export: full CSV/JSON export per module
- [ ] Data import (CSV) for products, dealers, opening balances (dealer payable, rider cash)

---

## PART C — 📱 Mobile responsiveness (AFTER logic is stable)

Current state: breakpoints are sparse in most admin panels (several panels have 1–5 responsive classes; `accounts-panel.tsx` is 2,672 lines). Do this per panel, visual only — no logic changes.

- [ ] Global: viewport meta check, safe-area insets, min tap target 44px, no horizontal page scroll at 360px width
- [ ] Admin shell: sidebar → drawer/sheet on mobile (uses `useIsMobile`), sticky compact header, bottom action bar for primary actions
- [ ] `DataTable`: below `md`, render rows as stacked cards (key fields + overflow menu) instead of horizontal-scroll tables; sticky first column fallback
- [ ] Forms/dialogs: full-screen `Drawer` (vaul) on mobile, single-column, sticky submit button, correct `inputmode`/`type` (tel, numeric)
- [ ] Filters: collapse into a filter sheet on mobile
- [ ] Split giant panels (`accounts-panel` 2.6k lines, `orders-panel` 1.5k, `staff-panel` 1.4k, `liquor`/`grocery` 1.2k) into tab components so each can be made responsive and lazy-loaded
- [ ] Charts: reduce ticks, horizontal scroll or simplified legend on small screens
- [ ] Storefront: sticky bottom cart bar, quantity stepper thumb-friendly, checkout as step wizard, map picker full-screen
- [ ] Rider app: PWA (manifest, install prompt, offline outbox already exists), big action buttons, one-handed layout, background location, call/WhatsApp/map deep links
- [ ] Test matrix: 360×640, 390×844, 768×1024; fix overflow with automated Playwright screenshots per route

---

## PART D — Quality & delivery

- [ ] Unit tests for money, tax, price engine, state machine, journal balancing (Vitest)
- [ ] Integration tests for place-order → deliver → handover → settle (checks ledger balances to zero difference, dealer payable = dealer cost)
- [ ] Seed script for realistic demo data (separate from production)
- [ ] CI: `bun run lint`, `bun run check`, `bunx tsc --noEmit`, tests
- [ ] Update `AGENT.md` of each directory you touch; keep the root phase table current

---

## Suggested order of work

1. B1 state machine (Module 1) → B7 dealer sourcing → B2 double-entry core + B3 postings
2. B10 price engine + coupons → B8 dealer/rider settlements with vouchers → B6 payroll
3. B5 tax/invoices + B4 accounting reports → B13 permissions/approvals → B14 reports
4. A1 customer features (cart, checkout, favorites) → B12 eSewa → B9 zones/tracking → B15 jobs/notifications
5. PART C mobile pass → PART D tests hardening

Open inputs from me: rider base salary + per-delivery amounts; dealer cost price per item; zone boundaries; accountant's decisions on input VAT, excise and TDS; meaning of the A1 payment-method line.
