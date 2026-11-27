# bug mezmani

## RIDER APP
> Settlement

## RIDER WEBSITE
> Minimize the details on rides harek section
> on `/rider/deliveries` route delivered `failed` status shows `done`.
> rider profile page shows ledger (Read only)
> send notice to `rider` while settlement request sent to admin
> fix customer delivery time (admin panel and rider dashboard should show
delivery time selected by the customer)
> admin assigned rider -> Rider can `accept` or `decline` the request or order.
Send notification to admin panel.
> allow admin to assign multiple orders to rider but can rider only accept one
order at one time.
> show orders list in rider panel with ASC(time).
> countdown system on the list of orders (also track the delivery time from
order confirm to successful delivery).

## Dealer
> Cost price & MRP Price
> `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
admin is unable to save sourcing items cost price
> cost price should be shown in the account
`https://mezmani.com/admin/accounts?tab=dealer-ledger` with the const declared
in the `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
route
Thought · 559ms
I'll start by exploring the codebase to understand the structure and locate the relevant areas.
$ ls -la && cat package.json 2>/dev/null | head -60
(99 earlier lines)
    "better-auth": "^1.7.27",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "cn": "^0.4.0",
    "date-fns": "^4.4.0",
    "drizzle-kit": "^0.31.11",
$ git log --oneline -10 && git status
(10 earlier lines)
On branch major-update/accounting-module
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/lib/firebase-admin.ts

no changes added to commit (use "git add" and/or "git commit -a")
Thought · 378ms
$ find src -type d | head -100
(69 earlier lines)
src/routes/api
src/routes/api/webhooks
src/routes/api/rider
src/routes/api/auth
src/routes/api/jobs
src/routes/api/jobs/campaigns
src/routes/superadmin
$ cat AGENT.md
(99 earlier lines)
## 8. Changelog

| Date         | Change                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| _YYYY-MM-DD_ | Initial docs created from scaffold                                                  |
| 2026-10-07   | Added `UI_APPROACH.md` (visual design system); router row, rule 1/10 and §7 updated |
| 2026-10-07   | Added `commit_rule.md`; router row and rule 11 (no self-commits)                    |
Thought · 1.2s
$ find src/routes/rider src/routes/admin src/routes/api/rider -type f | sort
(28 earlier lines)
src/routes/admin/users.tsx
src/routes/api/rider/$.ts
src/routes/rider/deliveries.tsx
src/routes/rider/earnings.tsx
src/routes/rider/index.tsx
src/routes/rider/profile.tsx
src/routes/rider/route.tsx
$ find src/components/panels/rider src/components/panels/riders src/components/panels/dealers src/components/panels/accounts -type f | sort
(41 earlier lines)
src/components/panels/rider/rider-profile.tsx
src/components/panels/riders/index.ts
src/components/panels/riders/rider-dialog.tsx
src/components/panels/riders/rider-settlement-dialog.tsx
src/components/panels/riders/riders-panel.tsx
src/components/panels/riders/rider-telemetry-map.tsx
$ find src/server/riders src/server/orders src/server/finance src/server/inventory -type f | sort
(45 earlier lines)
src/server/orders/order.queries.ts
src/server/orders/order.schemas.ts
src/server/orders/order.transitions.ts
src/server/orders/sourcing-logistics.test.ts
src/server/riders/rider.queries.ts
src/server/riders/rider-settlements.test.ts
src/server/riders/rider-settlements.ts
Thought · 827ms
Explored: 2 reads
Thought · 4.5s
Explored: 2 reads
$ wc -l src/server/operations/*.ts src/server/riders/*.ts src/server/orders/*.ts src/components/panels/rider/*.tsx src/routes/rider/*.tsx
(21 earlier lines)
    16 src/routes/rider/deliveries.tsx
    23 src/routes/rider/earnings.tsx
    14 src/routes/rider/index.tsx
    16 src/routes/rider/profile.tsx
    31 src/routes/rider/route.tsx
 13320 total
Thought · 1.5s
$ grep -rn "deliveryTime\|delivery_time\|preferredTime\|preferred_time\|deliverySlot" src --include=*.ts --include=*.tsx | head -50
(4 earlier lines)
src/server/orders/order.functions.ts:760:            ? data.deliverySlot === 'custom'
src/server/orders/order.functions.ts:762:              : `[Slot: ${data.deliverySlot === 'evening' ? 'Evening 6PM-8PM' : 'Late Night 8PM-10PM'}]`
src/components/panels/customer/checkout-panel.tsx:244:      deliverySlot: 'express',
src/components/panels/customer/checkout-panel.tsx:256:  const watchedDeliverySlot = watch('deliverySlot')
src/components/panels/customer/checkout-panel.tsx:304:      setValue('deliverySlot', 'custom')
src/components/panels/customer/checkout-panel.tsx:1003:                  name="deliverySlot"
$ grep -rn "settlement" src/components/panels/rider src/server/operations/operations.functions.ts src/routes/rider | head -60
(54 earlier lines)
src/server/operations/operations.functions.ts:3606:          settlementId = nid('set')
src/server/operations/operations.functions.ts:3608:          await tx.insert(settlements).values({
src/server/operations/operations.functions.ts:3609:            id: settlementId,
src/server/operations/operations.functions.ts:3635:          id: settlementId,
src/server/operations/operations.functions.ts:3928:      settlements: riderSettlements,
src/server/operations/operations.functions.ts:4218:        title: 'Rider settlement request pending',
$ grep -rn "accept\|decline\|reject" src/server/operations/operations.functions.ts src/server/orders/*.ts src/components/panels/rider/*.tsx | head -60
(6 earlier lines)
src/components/panels/rider/rider-earnings.tsx:302:                    {handover.status === 'rejected' &&
src/components/panels/rider/rider-earnings.tsx:303:                      handover.rejectionReason && (
src/components/panels/rider/rider-earnings.tsx:305:                          Reason: {handover.rejectionReason}
src/components/panels/rider/rider-earnings.tsx:312:                        ? 'Awaiting manager/admin acceptance'
src/components/panels/rider/rider-earnings.tsx:398:                transfer, or cheque. A manager or admin must accept it before it
src/components/panels/rider/rider-earnings.tsx:489:                Your request stays pending until a manager or admin accepts it.
Thought · 1.3s
Explored: 3 reads
Thought · 1.2s
$ grep -n "export const .*Fn\|createServerFn\|assignRider\|getRiderPortalFn\|updateRiderDeliveryStatusFn\|requestRiderSettlement\|notify" src/server/operations/operations.functions.ts | head -120
(80 earlier lines)
4318:export const upsertOfferFn = createServerFn({ method: 'POST' })
4366:export const deleteOfferFn = createServerFn({ method: 'POST' })
4379:export const getCustomerAddressesFn = createServerFn({ method: 'GET' }).handler(
4389:export const upsertCustomerAddressFn = createServerFn({ method: 'POST' })
4433:export const deleteCustomerAddressFn = createServerFn({ method: 'POST' })
4441:export const setDefaultCustomerAddressFn = createServerFn({ method: 'POST' })
$ grep -n "export const .*Fn\|createServerFn\|assignRider\|markPickedUp\|markDelivered\|rider" src/server/orders/order.functions.ts | head -100
(23 earlier lines)
1103:          name: riderRows[0].name,
1104:          phone: riderRows[0].phone,
1105:          vehicle: riderRows[0].vehicle ?? null,
1106:          rating: riderRows[0].rating ? Number(riderRows[0].rating) : null,
1144:      rider: publicRider,
1152:export const getCustomerOrdersFn = createServerFn({ method: 'GET' }).handler(
Explored: 2 reads
Thought · 1.7s
Explored: 2 reads
$ ls src/db/schema && grep -n "deliverySlot\|delivery_slot\|sourcing\|costPrice\|cost_price\|mrp" src/db/schema/*.ts | head -80
(17 earlier lines)
src/db/schema/inventory.ts:115:    costPrice: integer('cost_price').notNull().default(0), // paisa
src/db/schema/liquor.ts:99:    mrp: integer('mrp'), // in paisa
src/db/schema/orders.ts:92:    dealerCostPrice: integer('dealer_cost_price'), // snapshotted dealer unit cost (paisa)
src/db/schema/orders.ts:93:    actualDealerCostPrice: integer('actual_dealer_cost_price'), // actual rider-paid unit cost (paisa)
src/db/schema/orders.ts:95:    sourcingStatus: text('sourcing_status').notNull().default('pending'), // 'pending' | 'assigned' | 'unavailable' | 'picked_up'
src/db/schema/orders.ts:103:    index('order_items_sourcing_status_idx').on(table.sourcingStatus),
Explored: 2 reads
Thought · 1.2s
$ grep -n "toPaisa\|fromPaisa" src/lib/money.ts && cat src/server/inventory/inventory.schemas.ts
(64 earlier lines)
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
})

export type UpdateDealerLocationInput = z.infer<
  typeof updateDealerLocationSchema
>
$ grep -n "upsertDealerFn\|upsertDealer\|dealerItems\|assignedItems\|costPrice" src/server/inventory/inventory.functions.ts src/server/inventory/inventory.queries.ts | head -80
(31 earlier lines)
src/server/inventory/inventory.queries.ts:530:          eq(dealerItems.productId, input.productId),
src/server/inventory/inventory.queries.ts:536:      await tx.insert(dealerItems).values(
src/server/inventory/inventory.queries.ts:560:    .select({ dealerId: dealerItems.dealerId })
src/server/inventory/inventory.queries.ts:561:    .from(dealerItems)
src/server/inventory/inventory.queries.ts:564:        eq(dealerItems.catalogType, catalogType),
src/server/inventory/inventory.queries.ts:565:        eq(dealerItems.productId, productId),
Explored: 2 reads
Thought · 1.2s
Explored: 1 read
Thought · 4.5s
Explored: 1 read
Thought · 2.3s
$ ls src/components/shared/form-view && sed -n '1,260p' src/components/shared/form-view/form-view.tsx 2>/dev/null || sed -n '1,260p' src/components/shared/form-view/index.tsx
(82 earlier lines)
      ) : (
        <div className="max-w-4xl space-y-6">{children}</div>
      )}
    </div>
  )
}
Explored: 1 read
Thought · 5.1s
$ grep -n -i "cost price\|sourcing\|rider\|settlement\|delivery\|countdown\|accept\|decline\|ledger" TODO.md | head -80
(73 earlier lines)
257:- [ ] Rider app: PWA (manifest, install prompt, offline outbox already exists), big action buttons, one-handed layout, background location, call/WhatsApp/map deep links
262:## PART D — Quality & delivery
265:- [ ] Integration tests for place-order → deliver → handover → settle (checks ledger balances to zero difference, dealer payable = dealer cost)
274:1. B1 state machine (Module 1) → B7 dealer sourcing → B2 double-entry core + B3 postings
275:2. B10 price engine + coupons → B8 dealer/rider settlements with vouchers → B6 payroll
280:Open inputs from me: rider base salary + per-delivery amounts; dealer cost price per item; zone boundaries; accountant's decisions on input VAT, excise and TDS; meaning of the A1 payment-method line.
$ grep -rn "dealer-ledger\|DealerLedger\|costPrice" src/components/panels/accounts src/server/finance | head -80
(3 earlier lines)
src/components/panels/accounts/accounts-panel.tsx:800:      value: 'dealer-ledger',
src/components/panels/accounts/accounts-panel.tsx:1037:              {activeTab === 'dealer-ledger' && (
src/components/panels/accounts/accounts-route.ts:18:  'dealer-ledger',
src/components/panels/accounts/accounts-route.ts:71:  if (partyType === 'dealer') return 'dealer-ledger'
src/components/panels/accounts/tabs/dealer-report-tab.tsx:76:          tab: 'dealer-ledger',
src/components/panels/accounts/tabs/dealer-report-tab.tsx:90:        tab: 'dealer-ledger',
src/components/panels/accounts/accounts-overview.tsx:932:                      onClick={() => onNavigateTab?.('dealer-ledger')}
Thought · 695ms
Explored: 1 read
Thought · 2.2s
Explored: 2 reads
Thought · 1.1s
Explored: 1 read
Thought · 405ms
Explored: 1 read
Thought · 713ms
$ grep -n "export interface Order\|export type Order\|deliverySlot\|notes\|OrderStatus\|deliveryOtp\|deliveryProof" src/server/operations/types.ts | head -50 && sed -n '1,180p' src/server/operations/types.ts
(190 earlier lines)
      {
        key: 'riders',
        label: 'Riders',
        description:
          'Manage delivery fleet, payout rates, shifts, and online status',
        section: 'Operations',
Explored: 1 read
Thought · 1.3s
$ grep -rn "assignRider\|assignOrderItemDealerFn\|suggestRiders\|rider_assigned" src/components/panels src/routes | head -80
(16 earlier lines)
src/components/panels/orders/orders-panel.tsx:313:      await assignOrderItemDealerFn({
src/components/panels/orders/orders-panel.tsx:1023:                      'rider_assigned',
src/components/panels/orders/orders-panel.tsx:1085:                            'rider_assigned',
src/components/panels/orders/orders-panel.tsx:1096:                            'rider_assigned',
src/components/panels/dashboard/dashboard-panel.tsx:120:      count: countStatuses('rider_assigned', 'picked_up', 'out_for_delivery'),
src/routes/api/rider/$.ts:137:                'rider_assigned',
$ grep -n "assignRider\|transitionOrder\|riderId" src/server/orders/order.transitions.ts | head -60 && sed -n '1,180p' src/server/orders/order.transitions.ts
(193 earlier lines)
  }

  const auditMetadata = {
    ...(options.metadata || {}),
    ...(options.proofPhotoUrl ? { proofPhotoUrl: options.proofPhotoUrl } : {}),
    ...(options.deliveryOtp ? { deliveryOtpVerified: true } : {}),
Explored: 2 reads
Thought · 8.3s
Explored: 4 reads
Thought · 382ms
Explored: 1 read
Thought · 2.6s
$ grep -n "export async function getRider\|getPartyStatementQuery\|RiderLedger\|getRiderAccountsSummaryQuery" src/server/finance/finance.queries.ts
636:export async function getRiderAccountsSummaryQuery(): Promise<
706:export interface RiderLedgerBalance {
717:export async function getRiderLedgerBalanceQuery(
721:): Promise<RiderLedgerBalance> {
1485:export async function getPartyStatementQuery(
$ grep -n "export const getPartyStatementFn\|getRiderAccountsSummaryFn\|requirePermission" src/server/finance/finance.functions.ts | head -40
(19 earlier lines)
1016:    const { user } = await requirePermission('accounts', 'create')
1075:    const { user } = await requirePermission('accounts', 'create')
1120:    const { user } = await requirePermission('accounts', 'approve')
1165:    const { user } = await requirePermission('accounts', 'approve')
1209:    const { user } = await requirePermission('accounts', 'create')
1260:    const { user } = await requirePermission('accounts', 'create')
$ sed -n '1,140p' src/queries/rider.ts
(4 earlier lines)
  portal: () =>
    queryOptions({
      queryKey: ['rider', 'portal'],
      queryFn: () => getRiderPortalFn(),
      staleTime: 1000 * 15, // 15 seconds for real-time fleet operations
    }),
}
Explored: 2 reads
Thought · 9.1s
$ grep -n "shouldDirty" node_modules/react-hook-form/dist/index.esm.mjs | head -20
2474:    const updateTouchAndDirty = (name, fieldValue, isBlurEvent, shouldDirty, shouldRender) => {
2480:        if (!_options.disabled || shouldDirty === true) {
2481:            if (!isBlurEvent || shouldDirty) {
2810:        (options.shouldDirty || options.shouldTouch) &&
2818:                : fieldValue, options.shouldTouch, options.shouldDirty, !skipRender);
2867:            if (_isTracked('isDirty', 'dirtyFields') && options.shouldDirty) {
2926:            options.shouldDirty ||
2937:            if (options.shouldDirty && _isTracked('isDirty', 'dirtyFields')) {
$ sed -n '2470,2505p' node_modules/react-hook-form/dist/index.esm.mjs && sed -n '2855,2875p' node_modules/react-hook-form/dist/index.esm.mjs
(51 earlier lines)
                if (!skipStateEmit) {
                    _subjects.state.next({
                        name,
                        dirtyFields: _formState.dirtyFields,
                        isDirty: _formState.isDirty,
                    });
Thought · 5.2s
$ grep -n "dealer:\|dealers:\|dealerPayablesSummary\|partyStatement" src/queries/admin.ts | head -40 && sed -n '1,120p' src/queries/admin.ts
(118 earlier lines)
      queryFn: () => getMyAccessFn(),
      staleTime: 1000 * 30, // 30s cache prevents repeating network roundtrips on route navigation
    }),

  chrome: () =>
    queryOptions({
Thought · 774ms
$ sed -n '1,140p' src/components/panels/orders/orders-panel.tsx && sed -n '920,1140p' src/components/panels/orders/orders-panel.tsx
(355 earlier lines)
                    <div className="text-muted-foreground flex items-center gap-1.5 font-mono">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {selectedOrder.customerPhone}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
Thought · 774ms
$ grep -n "handleUpdateStatus\|handleMarkDelivered\|Rider\|rider" src/components/panels/orders/orders-panel.tsx | sed -n '1,120p'
(41 earlier lines)
2134:                    {showRiderRouting && (
2137:                          Dealer Pickups (Rider Route):
2287:                    {/* Rider Assignment & Footer */}
2290:                        Assigned Rider:{' '}
2292:                          {ops.riders.find(
2293:                            (r) => r.id === selectedOrder.riderId,
Explored: 2 reads
Thought · 667ms
Explored: 1 read
Thought · 934ms
$ ls drizzle | tail -30 && ls drizzle/migrations 2>/dev/null | tail -10 && cat drizzle.config.ts && cat src/db/index.ts | head -60
(51 earlier lines)
export const db = drizzleHttp(neon(poolUrl), { schema })
export const dbTx = drizzlePool(new Pool({ connectionString: poolUrl }), {
  schema,
})

export type DbTx = Parameters<Parameters<typeof dbTx.transaction>[0]>[0]
Thought · 560ms
$ cat drizzle/0021_rider_settlement_requests.sql && cat drizzle/0026_rider_fcm_and_review_image.sql && cat drizzle/meta/_journal.json | tail -40
(62 earlier lines)
      "when": 1794400000000,
      "tag": "0026_rider_fcm_and_review_image",
      "breakpoints": true
    }
  ]
}
Thought · 681ms
$ ls src/db/*.test.ts src/db/tools 2>/dev/null; sed -n '1,120p' src/db/migrations.test.ts 2>/dev/null
(107 earlier lines)
      }
    }

    expect(inspectedTableCount).toBeGreaterThan(20)
    expect(missingColumns).toEqual([])
  }, 30000)
})
Thought · 16.1s
$ sed -n '1,220p' src/lib/nepal-date.ts 2>/dev/null; grep -rn "Asia/Kathmandu\|kathmandu\|NEPAL" src/lib/*.ts | head -30
(239 earlier lines)
src/lib/pricing.ts:1:import { vatFromInclusive, DEFAULT_NEPAL_VAT_RATE } from './tax'
src/lib/pricing.ts:284:    vatRate = DEFAULT_NEPAL_VAT_RATE,
src/lib/tax.ts:7:export const DEFAULT_NEPAL_VAT_RATE = 13 // 13%
src/lib/tax.ts:16:  vatRate: number = DEFAULT_NEPAL_VAT_RATE,
src/lib/tax.ts:27:  vatRate: number = DEFAULT_NEPAL_VAT_RATE,
src/lib/tax.ts:38:  vatRate: number = DEFAULT_NEPAL_VAT_RATE,
Thought · 471ms
$ sed -n '100,200p' src/lib/campaign-timezone.ts
(94 earlier lines)
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
Compaction· 172.0K in · 1.6K out
Objective
Fix the listed Mezmani rider-app/website and dealer bugs, including rider settlement notifications, delivery-time display, rider accept/decline flow, countdowns, ledger visibility, and dealer sourcing cost-price saving/display.
Requirements
RIDER APP > Settlement:
Minimize details in rider sections.
/rider/deliveries: failed status must not appear under Done.
Rider profile page shows ledger read-only.
Send notice to rider when settlement request is sent to admin.
Admin panel and rider dashboard must show the customer-selected delivery time.
Admin-assigned rider must accept or decline; notify admin panel.
Admin can assign multiple orders to a rider, but rider can accept only one at a time.
Rider order list sorted ASC by time.
Countdown system on order list; track delivery duration from order confirmation to successful delivery.
Dealer:
Show Cost price & MRP Price.
Admin cannot save sourcing item cost price on /admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91.
Cost price must show in /admin/accounts?tab=dealer-ledger using the constant declared in the dealer route.
No commit/push unless explicitly requested.
Decisions
Found root cause of dealer cost-price save failure: form.setValue('name', sameValue, { shouldDirty: true }) does not mark RHF form dirty because RHF compares against defaults; FormHeader Save button is disabled when !isDirty.
Planned approach for rider acceptance: add riderAssignmentStatus (pending|accepted|declined) plus timestamp/decline fields on orders, not a new order status.
Planned order delivery-time fields: deliverySlot, deliveryScheduledFor, confirmedAt, deliveredAt.
Planned rider ledger via new rider-scoped read-only server function using existing getRiderLedgerBalanceQuery / getPartyStatementQuery.
Planned countdown target = deliveryScheduledFor, falling back to confirmation time + 45 minutes.
Planned dealer form fix: track separate itemsDirty state and pass isDirty={form.formState.isDirty || itemsDirty}.
Planned dealer MRP display: extend CatalogItemSummary / AssignedItemDto with mrp, and show cost/MRP in dealer ledger detail.
Work State
Completed
Explored repo structure, relevant rider/dealer/accounting files, schemas, state machine, and UI flows.
Identified exact causes/areas for most requested bugs.
No code changes made yet.
Active
Preparing implementation plan for all requested fixes.
Blocked
(none)
Next Move
Add migration drizzle/0027_* and register it in drizzle/meta/_journal.json with columns: orders.delivery_slot, orders.delivery_scheduled_for, orders.confirmed_at, orders.delivered_at, orders.rider_assignment_status, orders.rider_assigned_at, orders.rider_responded_at, orders.rider_decline_reason; backfill timestamps from order_status_history.
Update Drizzle orders schema and Order type/mapping (src/db/schema/orders.ts, src/server/operations/types.ts, src/server/orders/order.queries.ts).
Persist deliverySlot/scheduled time during createCustomerOrderFn using parseDateTimeToUtc from src/lib/campaign-timezone.ts; set confirmedAt/deliveredAt in order.transitions.ts.
Implement rider accept/decline server fns with admin notifications and single-active-accepted-order enforcement; set new assignments to pending in updateOrderFn and transitionOrderTx.
Update rider portal query: ASC order sorting, pending offers, accepted active orders, ledger data.
Update rider UI: accept/decline request cards, compact sections, countdown component, delivery-time labels, failed tab fix, profile ledger card, rider settlement notice.
Fix dealer form dirty-state cost-price save; add MRP columns; show dealer cost/MRP in dealer ledger tab.
Run bunx tsc --noEmit, bun run lint, bun run check, and relevant tests.
Relevant Files
src/server/operations/operations.functions.ts: updateOrderFn, getRiderPortalFn, updateRiderDeliveryStatusFn, depositRiderCashFn, settlement/payroll functions.
src/server/orders/order.transitions.ts: order state transitions, rider notifications, delivery accounting.
src/server/orders/order.queries.ts: mapOrderRecord, order queries, rider suggestions.
src/lib/order-status.ts: transition validation/state machine.
src/db/schema/orders.ts: order table definitions.
src/db/schema/riders.ts: riders, handovers, settlements, shifts.
src/server/operations/types.ts: Order, Rider, settlement types.
src/components/panels/rider/rider-dashboard.tsx: rider dashboard/order cards.
src/components/panels/rider/rider-deliveries.tsx: deliveries tabs and failed/completed logic.
src/components/panels/rider/rider-profile.tsx: rider profile page.
src/components/panels/rider/rider-earnings.tsx: settlement request UI.
src/components/panels/dealers/dealer-form.tsx: dealer sourcing item editing/save bug.
src/components/panels/accounts/tabs/dealer-report-tab.tsx: dealer ledger UI.
src/server/inventory/inventory.queries.ts: dealer items, catalog summaries, upsert persistence.
src/server/finance/finance.queries.ts: rider ledger balance and party statement queries.
Important Context
Dealer save bug: in dealer-form.tsx, child-table edits call form.setValue('name', form.getValues('name'), { shouldDirty: true }); RHF treats unchanged value as pristine, so Save stays disabled.
/rider/deliveries currently defines completedOrders as ['delivered', 'delivery_failed'], and tab label is Done — this causes failed orders to show as done.
Delivery slot is currently only embedded in orders.notes, not stored as structured fields.
Rider assignment currently immediately sets status rider_assigned with no acceptance step.
getRiderPortalFn currently returns assigned orders sorted by getAllOrdersQuery() (desc by createdAt).
getRiderLedgerBalanceQuery and getPartyStatementQuery already exist and can back a rider-scoped read-only ledger endpoint.
Working tree has one pre-existing unrelated modification: src/lib/firebase-admin.ts.
Branch: major-update/accounting-module; latest commit 1833fe8.
Thought · 1.0s
I'll pick up from the plan. Let me first verify the current state of the repo and the key files.
$ git status --short && git log --oneline -3 && ls drizzle | tail -20
(17 earlier lines)
0021_rider_settlement_requests.sql
0022_accounting_section_refactor.sql
0023_service_zones.sql
0024_erp_accounting_expansion.sql
0025_campaign_scheduling_and_expiry.sql
0026_rider_fcm_and_review_image.sql
meta
Explored: 1 read
Thought · 950ms
$ cat drizzle/meta/_journal.json | tail -40 && cat drizzle/0026_rider_fcm_and_review_image.sql && cat drizzle/0025_campaign_scheduling_and_expiry.sql | head -40
(90 earlier lines)
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "expired_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "delivery_progress" jsonb;
Explored: 1 read
Thought · 1.9s
$ wc -l src/server/operations/operations.functions.ts src/server/operations/types.ts src/server/orders/order.queries.ts src/components/panels/rider/rider-dashboard.tsx src/components/panels/rider/rider-deliveries.tsx src/componen…
(7 earlier lines)
  1057 src/components/panels/dealers/dealer-form.tsx
   949 src/components/panels/accounts/tabs/dealer-report-tab.tsx
   685 src/server/inventory/inventory.queries.ts
  1641 src/server/finance/finance.queries.ts
   495 src/lib/order-status.ts
 13640 total
Explored: 1 read
Thought · 1.3s
Explored: 1 read
$ grep -n "interface Order\b\|export interface Order\|deliverySlot\|confirmedAt\|riderAssignment\|RiderAssignment\|deliveryScheduled" -r src/server/operations/types.ts src/server src/db/schema | head -60
(18 earlier lines)
src/server/orders/order.schemas.ts:70:  deliverySlot: z
src/server/orders/order.functions.ts:374:      if (data.deliverySlot === 'express') {
src/server/orders/order.functions.ts:638:    if (data.deliverySlot === 'custom') {
src/server/orders/order.functions.ts:759:          data.deliverySlot && data.deliverySlot !== 'express'
src/server/orders/order.functions.ts:760:            ? data.deliverySlot === 'custom'
src/server/orders/order.functions.ts:762:              : `[Slot: ${data.deliverySlot === 'evening' ? 'Evening 6PM-8PM' : 'Late Night 8PM-10PM'}]`
Explored: 2 reads
Thought · 1.4s
Explored: 2 reads
Thought · 840ms
$ grep -n "export const .*Fn\|async function\|function " src/server/operations/operations.functions.ts | sed -n '1,200p'
(81 earlier lines)
4318:export const upsertOfferFn = createServerFn({ method: 'POST' })
4366:export const deleteOfferFn = createServerFn({ method: 'POST' })
4379:export const getCustomerAddressesFn = createServerFn({ method: 'GET' }).handler(
4389:export const upsertCustomerAddressFn = createServerFn({ method: 'POST' })
4433:export const deleteCustomerAddressFn = createServerFn({ method: 'POST' })
4441:export const setDefaultCustomerAddressFn = createServerFn({ method: 'POST' })
Explored: 1 read
Thought · 859ms
Explored: 1 read
Thought · 865ms
Explored: 2 reads
Thought · 1.3s
$ find src/routes -path '*rider*' -o -path '*dealer*' | head -40 && grep -rn "RiderProfile\|RiderDeliveries\|getRiderPortalFn\|RiderDashboard\|RiderEarnings" src/routes src/components | grep -v "components/panels/rider" | head -40
(20 earlier lines)
src/routes/rider/earnings.tsx:10:  component: RiderEarningsPage,
src/routes/rider/earnings.tsx:13:function RiderEarningsPage() {
src/routes/rider/earnings.tsx:16:    <RiderEarnings
src/routes/rider/deliveries.tsx:10:  component: RiderDeliveriesPage,
src/routes/rider/deliveries.tsx:13:function RiderDeliveriesPage() {
src/routes/rider/deliveries.tsx:15:  return <RiderDeliveries orders={data.orders} />
Explored: 4 reads
Thought · 1.1s
Explored: 1 read
$ cat src/routes/rider/profile.tsx src/routes/rider/deliveries.tsx src/routes/rider/earnings.tsx src/routes/rider/index.tsx && sed -n '1,80p' src/queries/rider.ts
(74 earlier lines)
    queryOptions({
      queryKey: ['rider', 'portal'],
      queryFn: () => getRiderPortalFn(),
      staleTime: 1000 * 15, // 15 seconds for real-time fleet operations
    }),
}
Thought · 926ms
Explored: 3 reads
Thought · 589ms
Explored: 1 read
Thought · 526ms
Explored: 1 read
Thought · 2.3s
$ grep -rn "mrp\|MRP" src/db/schema src/server | head -60
(23 earlier lines)
src/server/superadmin/superadmin.functions.ts:708:                mrp,
src/server/superadmin/superadmin.functions.ts:790:                  mrp,
src/server/superadmin/superadmin.functions.ts:804:                mrp,
src/server/recycle-bin/recycle-bin.queries.ts:265:              mrp: v.mrp || null,
src/server/recycle-bin/recycle-bin.queries.ts:383:              mrp: v.mrp || null,
src/server/recycle-bin/recycle-bin.queries.ts:496:              mrp: v.mrp || null,
src/server/recycle-bin/recycle-bin.queries.ts:607:              mrp: v.mrp || null,
$ grep -rn "dealer-ledger\|DEALER_LEDGER\|LEDGER_TAB\|const .*TAB\|TAB_" src/routes/admin/dealers src/components/panels/accounts src/components/panels/dealers | head -50
(16 earlier lines)
src/components/panels/accounts/tabs/party-accounts-tab.tsx:94:  const activeTabMeta = PARTY_TABS.find((t) => t.type === activePartyType)!
src/components/panels/accounts/tabs/dealer-report-tab.tsx:76:          tab: 'dealer-ledger',
src/components/panels/accounts/tabs/dealer-report-tab.tsx:90:        tab: 'dealer-ledger',
src/components/panels/accounts/accounts-overview.tsx:932:                      onClick={() => onNavigateTab?.('dealer-ledger')}
src/components/panels/dealers/dealer-form.tsx:461:            href: '/admin/accounts?tab=dealer-ledger',
src/components/panels/dealers/dealer-form.tsx:540:                    search: { tab: 'dealer-ledger' },
Thought · 1.4s
Explored: 1 read
$ grep -rn "dealerLedger\|DEALER_.*=\|const .*dealer" src/routes/admin/dealers src/routes/admin/dealers.tsx | head -40 && sed -n '1,120p' src/routes/admin/dealers.tsx
(7 earlier lines)

export const Route = createFileRoute('/admin/dealers')({
  beforeLoad: guardModule('dealers'),
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: () => <Outlet />,
})
Thought · 1.4s
$ grep -rn "DEALER_LEDGER\|dealerLedger\|DEALER_ROUTE\|dealerRoute\|LEDGER_HREF\|DEALER_LEDGER_TAB" src | head -40
(no output)
$ grep -rn "dealer-ledger" src --include=*.ts --include=*.tsx | head -40
(7 earlier lines)
src/components/panels/accounts/tabs/dealer-report-tab.tsx:76:          tab: 'dealer-ledger',
src/components/panels/accounts/tabs/dealer-report-tab.tsx:90:        tab: 'dealer-ledger',
src/components/panels/accounts/accounts-overview.tsx:932:                      onClick={() => onNavigateTab?.('dealer-ledger')}
src/components/panels/dealers/dealer-form.tsx:461:            href: '/admin/accounts?tab=dealer-ledger',
src/components/panels/dealers/dealer-form.tsx:540:                    search: { tab: 'dealer-ledger' },
src/routes/admin/route.tsx:319:            search: { tab: 'dealer-ledger' },
src/routes/admin/accounts.tsx:17:      'dealer-ledger',
Thought · 1.0s
Explored: 2 reads
Thought · 1.6s
$ grep -rn "onSettleDealer\|SettleDealer\|dealerSettle\|settleDealer" src | head -40
(18 earlier lines)
src/server/operations/types.ts:891:  dealerSettlements?: any[]
src/components/panels/accounts/accounts-panel.tsx:1040:                  onSettleDealer={handleOpenBatchSettlement}
src/components/panels/accounts/tabs/dealer-report-tab.tsx:37:  onSettleDealer?: (dealerId: string) => void
src/components/panels/accounts/tabs/dealer-report-tab.tsx:42:  onSettleDealer,
src/components/panels/accounts/tabs/dealer-report-tab.tsx:325:                  onClick={() => onSettleDealer?.(row.original.dealerId)}
src/components/panels/accounts/tabs/dealer-report-tab.tsx:338:    [onPayoutDealer, onSettleDealer, openDealer],
src/components/panels/accounts/tabs/dealer-report-tab.tsx:673:                    onClick={() => onSettleDealer?.(selectedDealer.dealerId)}
Explored: 1 read
Thought · 534ms
$ grep -rn "handleOpenBatchSettlement\|BatchSettlement\|batchSettlement" src | head -30
src/components/panels/accounts/accounts-panel.tsx:493:  const [hasOpenedBatchSettlement, setHasOpenedBatchSettlement] =
src/components/panels/accounts/accounts-panel.tsx:672:  const handleOpenBatchSettlement = useCallback((dealerId?: string) => {
src/components/panels/accounts/accounts-panel.tsx:674:    setHasOpenedBatchSettlement(true)
src/components/panels/accounts/accounts-panel.tsx:997:                  onDealerSettlement={() => handleOpenBatchSettlement()}
src/components/panels/accounts/accounts-panel.tsx:1040:                  onSettleDealer={handleOpenBatchSettlement}
src/components/panels/accounts/accounts-panel.tsx:1507:      {hasOpenedBatchSettlement && (
Explored: 1 read
$ grep -rn "DealerSettlementDialog\|dealer-settlement" src/components | head -20
src/components/panels/accounts/accounts-panel.tsx:157:const BatchDealerSettlementDialog = React.lazy(() =>
src/components/panels/accounts/accounts-panel.tsx:158:  import('./batch-dealer-settlement-dialog').then((m) => ({
src/components/panels/accounts/accounts-panel.tsx:159:    default: m.BatchDealerSettlementDialog,
src/components/panels/accounts/accounts-panel.tsx:1509:          <BatchDealerSettlementDialog
src/components/panels/accounts/batch-dealer-settlement-dialog.tsx:35:export interface BatchDealerSettlementDialogProps {
src/components/panels/accounts/batch-dealer-settlement-dialog.tsx:67:export function BatchDealerSettlementDialog({
src/components/panels/accounts/batch-dealer-settlement-dialog.tsx:73:}: BatchDealerSettlementDialogProps) {
Explored: 1 read
Thought · 2.9s
$ grep -rni "mezmani\|rider settlement\|delivery time" . --include=*.md --include=*.txt --exclude-dir=node_modules --exclude-dir=.git | head -30
(20 earlier lines)
./TODO.md:162:- [x] **Settlement voucher with public slug:** every dealer settlement and rider settlement gets a unique `slug` (e.g. `/voucher/<slug>`) + sequential voucher number; printable/PDF and shareable via WhatsApp link (unguessable slug, read-only, no login, shows only that voucher; `noindex`, rate-limited, no customer PII)
./TODO.md:168:- [x] Rider settlement = salary/commission earned − advances − cash shortage ± cash held (ties to B6 payroll + rider cash handover)
./TODO.md:177:- [x] Delivery time slots + scheduled orders
./TODO.md:227:- [x] Rider performance, COD outstanding, delivery time SLA
./TODO.md:238:- [ ] Background jobs (Vercel Cron): auto-cancel, reminders, daily report, unpaid dealer/rider settlement digest
./TODO.md:275:2. B10 price engine + coupons → B8 dealer/rider settlements with vouchers → B6 payroll
$ ls && ls docs 2>/dev/null | head -30 && git branch --show-current
(27 earlier lines)
vercel.json
vite.config.ts
vitest.config.ts
admin-loading.md
admin-ux-plan.md
perf-report.md
major-update/accounting-module
Thought · 499ms
$ sed -n '1,200p' PROMPT.md
(124 earlier lines)
- [ ] Accounts resolved via `ACCOUNT_KEYS` / settings, never literal `acc_xxxx` strings.
- [ ] Party set on party-controlled accounts; cost center set where applicable.
- [ ] `refType + refId + event` set for system postings; manual vouchers carry a reason/narration.
- [ ] Posting date and fiscal year/period handled; closed period rejected.
- [ ] Reversal path exists and is tested; double reversal blocked.
- [ ] Permission + audit log + Zod on the server function; error messages user-safe.
- [ ] Tests cover the happy path, imbalance, duplicate, closed period, wrong permission.
Thought · 13.2s
Explored: 1 read
$ grep -n "batchDealers\|batchDealerId\|dealerPayables" src/components/panels/accounts/accounts-panel.tsx | head -30
(3 earlier lines)
602:      const summary = dealerPayables.find(
620:    [dealerPayables],
803:      count: dealerPayables.length,
1377:                    dealerPayables.find(
1512:            dealers={batchDealers}
1513:            initialDealerId={batchDealerId || undefined}
Explored: 1 read
Thought · 4.2s
$ grep -rn "const .*COST\|COST_.*=\|DEFAULT.*COST\|MARKUP" src/server src/lib src/components/panels/dealers | head -40
(no output)
$ grep -rn "9a3fbf8e\|9a3f" . --exclude-dir=node_modules --exclude-dir=.git | head
(no output)
Thought · 3.8s
$ find src/components/panels/orders -type f 2>/dev/null; find src/components -iname '*order*' -type f | head -40; grep -rln "updateOrderFn\|suggestRidersForOrderFn" src/components | head -20
src/components/panels/orders/index.ts
src/components/panels/orders/orders-panel.tsx
src/components/panels/customer/track-order-panel.tsx
src/components/panels/customer/customer-orders-panel.tsx
src/components/panels/customer/order-confirmation-panel.tsx
src/components/panels/orders/orders-panel.tsx
src/components/panels/orders/orders-panel.tsx
$ grep -n "riderId\|deliverySlot\|notes\|Assign\|rider" src/components/panels/orders/orders-panel.tsx | head -80
(52 earlier lines)
2290:                        Assigned Rider:{' '}
2292:                          {ops.riders.find(
2293:                            (r) => r.id === selectedOrder.riderId,
2688:                <Label htmlFor="order-notes">Order Notes / Instructions</Label>
2690:                  id="order-notes"
2692:                  value={orderForm.notes}
2694:                    setOrderForm({ ...orderForm, notes: e.target.value })
$ wc -l src/components/panels/orders/orders-panel.tsx
2718 src/components/panels/orders/orders-panel.tsx
Thought · 1.5s
Explored: 2 reads
Thought · 1.0s
Explored: 1 read
Thought · 893ms
$ grep -n "Delivery\|delivery" src/components/panels/orders/orders-panel.tsx | sed -n '1,80p'
(17 earlier lines)
2250:                        <span className="text-muted-foreground">Delivery:</span>
2252:                          {formatNPR(selectedOrder.deliveryCharge)}
2360:                        Delivery Destination:
2438:                          {formatNPR(selectedOrder.deliveryCharge)}
2512:                  <Label htmlFor="cust-addr">Delivery Address *</Label>
2548:                    <option value="cod">Cash on Delivery (COD)</option>
2696:                  placeholder="Gate instructions, landmark, preferred delivery window..."
Explored: 1 read
Thought · 1.2s
Explored: 1 read
Thought · 3.3s
$ grep -n "export async function getRiderLedgerBalanceQuery\|export async function getPartyStatementQuery\|export interface PartyStatementRow\|export interface RiderLedger" -A 60 src/server/finance/finance.queries.ts | head -160
(154 earlier lines)
1529-    )
1530-    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
1531-    .where(and(...conditions))
1532-    .orderBy(
1533-      asc(journalEntries.postingDate),
1534-      asc(journalEntries.createdAt),
Thought · 1.1s
$ sed -n '1,240p' src/db/migrations.test.ts
(101 earlier lines)
      }
    }

    expect(inspectedTableCount).toBeGreaterThan(20)
    expect(missingColumns).toEqual([])
  }, 30000)
})
Thought · 1.8s
$ grep -n "campaign-timezone\|parseDateTimeToUtc\|^import" src/server/orders/order.functions.ts | head -50 && grep -n "export function parseDateTimeToUtc" -A 40 src/lib/campaign-timezone.ts
(50 earlier lines)
145-  // General DST-aware calculation using native Intl
146-  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0))
147-  const formatter = new Intl.DateTimeFormat('en-US', {
148-    timeZone,
149-    year: 'numeric',
150-    month: 'numeric',
Thought · 2.2s
$ sed -n '1,110p' src/lib/campaign-timezone.ts && grep -n "export" src/lib/campaign-timezone.ts
(112 earlier lines)
17:export const SUPPORTED_TIMEZONES: SupportedTimezone[] = [
93:export function getTimezoneMeta(timeZone = DEFAULT_TIMEZONE): SupportedTimezone {
110:export function parseDateTimeToUtc(
183:export function formatUtcToParts(
221:export function formatInTimezone(
247:export interface ScheduleValidationResult {
261:export function validateCampaignSchedule(params: {
Thought · 937ms
$ grep -n "orders\|riders" src/db/schema/index.ts | head -20; grep -n "export const notifications" -A 20 src/db/schema/*.ts | head -40
(17 earlier lines)
src/db/schema/platform.ts-31-    index('notifications_read_idx').on(table.read),
src/db/schema/platform.ts-32-    index('notifications_type_idx').on(table.type),
src/db/schema/platform.ts-33-    index('notifications_created_at_idx').on(table.createdAt),
src/db/schema/platform.ts-34-    index('notifications_user_id_idx').on(table.userId),
src/db/schema/platform.ts-35-  ],
src/db/schema/platform.ts-36-)
Thought · 20.8s
$ sed -n '1,150p' src/server/operations/operations.functions.ts
(142 earlier lines)
import {
  postRiderPayoutTx,
  postRiderSalaryAccrualTx,
  reverseJournalTx,
} from '#/server/finance/double-entry'

export { ACTIONS, MODULES }
Thought · 2.1s
$ sed -n '1,220p' src/components/shared/child-table.tsx 2>/dev/null || find src/components/shared/child-table -type f
(214 earlier lines)
                    <TableCell className="text-right py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
Thought · 4.4s
$ grep -n "dealers:\|dealer:\|dealerPayablesSummary\|partyStatement" -A 8 src/queries/admin.ts | head -80
(29 earlier lines)
681-      queryKey: ['admin', 'dealer', id],
682-      queryFn: () => getDealerByIdFn({ data: { id } }),
683-      staleTime: 1000 * 60 * 2,
684-    }),
685-
686-  adminPanelNotices: () =>
687-    queryOptions({
Thought · 5.4s
$ grep -n "export async function getUserNotificationsQuery\|export async function getAllNotificationsQuery" -A 40 src/server/platform/platform.queries.ts
(54 earlier lines)
136-
137-export async function insertNotificationQuery(item: {
138-  id?: string
139-  title: string
140-  body: string
141-  type: 'order' | 'stock' | 'rider' | 'finance' | 'system'
Thought · 9.8s
Now I have the full picture. Let me start implementing, beginning with the database migration and schema.
drizzle/0027_rider_acceptance_and_delivery_timing.sql
-- Rider assignment acceptance flow + structured delivery scheduling & timing
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_slot" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_scheduled_for" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_assignment_status" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_assigned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_responded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rider_decline_reason" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_delivery_scheduled_for_idx" ON "orders" ("delivery_scheduled_for");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_rider_assignment_status_idx" ON "orders" ("rider_assignment_status");
--> statement-breakpoint
UPDATE "orders" AS o
SET "confirmed_at" = h."created_at"
FROM (
	SELECT "order_id", MIN("created_at") AS "created_at"
	FROM "order_status_history"
	WHERE COALESCE("to_status", "status") = 'confirmed'
	GROUP BY "order_id"
) AS h
WHERE o."id" = h."order_id" AND o."confirmed_at" IS NULL;
--> statement-breakpoint
UPDATE "orders" AS o
SET "delivered_at" = h."created_at"
FROM (
	SELECT "order_id", MIN("created_at") AS "created_at"
	FROM "order_status_history"
	WHERE COALESCE("to_status", "status") = 'delivered'
	GROUP BY "order_id"
) AS h
WHERE o."id" = h."order_id" AND o."delivered_at" IS NULL;
--> statement-breakpoint
UPDATE "orders" AS o
SET "rider_assigned_at" = h."created_at"
FROM (
	SELECT "order_id", MAX("created_at") AS "created_at"
	FROM "order_status_history"
	WHERE COALESCE("to_status", "status") = 'rider_assigned'
	GROUP BY "order_id"
) AS h
WHERE o."id" = h."order_id" AND o."rider_assigned_at" IS NULL;
--> statement-breakpoint
UPDATE "orders"
SET "rider_assignment_status" = 'accepted'
WHERE "rider_id" IS NOT NULL AND "rider_assignment_status" IS NULL;

      "version": "7",      "version": "7",
      "when": 1794400000000,      "when": 1794400000000,
      "tag": "0026_rider_fcm_and_review_image",      "tag": "0026_rider_fcm_and_review_image",
      "breakpoints": true      "breakpoints": true
    },
    {
      "idx": 27,
      "version": "7",
      "when": 1794500000000,
      "tag": "0027_rider_acceptance_and_delivery_timing",
      "breakpoints": true
    }
    }  ]
  ]}
}
    tax: integer('tax').notNull().default(0), // paisa    tax: integer('tax').notNull().default(0), // paisa
    total: integer('total').notNull(), // paisa    total: integer('total').notNull(), // paisa
    riderId: text('rider_id'),    riderId: text('rider_id'),
    dealerId: text('dealer_id'),    dealerId: text('dealer_id'),
    // Rider assignment acceptance: 'pending' | 'accepted' | 'declined'.
    // Legacy rows are backfilled as 'accepted' (null is treated as accepted).
    riderAssignmentStatus: text('rider_assignment_status'),
    riderAssignedAt: timestamp('rider_assigned_at', { withTimezone: true }),
    riderRespondedAt: timestamp('rider_responded_at', { withTimezone: true }),
    riderDeclineReason: text('rider_decline_reason'),
    // Customer-selected delivery window and lifecycle timestamps.
    deliverySlot: text('delivery_slot'),
    deliveryScheduledFor: timestamp('delivery_scheduled_for', {
      withTimezone: true,
    }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    trackingCode: text('tracking_code').notNull(),
    notes: text('notes').notNull().default(''),
    couponCode: text('coupon_code'),
    idempotencyKey: text('idempotency_key'),






    trackingCode: text('tracking_code').notNull(),
    notes: text('notes').notNull().default(''),
    couponCode: text('coupon_code'),
    idempotencyKey: text('idempotency_key'),
    index('orders_customer_id_idx').on(table.customerId),    index('orders_customer_id_idx').on(table.customerId),
    index('orders_rider_id_idx').on(table.riderId),    index('orders_rider_id_idx').on(table.riderId),
    index('orders_dealer_id_idx').on(table.dealerId),    index('orders_dealer_id_idx').on(table.dealerId),
    index('orders_created_at_idx').on(table.createdAt),    index('orders_created_at_idx').on(table.createdAt),
    index('orders_delivery_scheduled_for_idx').on(table.deliveryScheduledFor),
    index('orders_rider_assignment_status_idx').on(
      table.riderAssignmentStatus,
    ),
    index('orders_number_idx').on(table.number),
    index('orders_number_idx').on(table.number),    index('orders_idempotency_idx').on(table.idempotencyKey),
    index('orders_idempotency_idx').on(table.idempotencyKey),    index('orders_delivery_otp_idx').on(table.deliveryOtp),
    index('orders_delivery_otp_idx').on(table.deliveryOtp),  ],
  ],
Thought · 2.0s
  actorRole?: string | null  actorRole?: string | null
  metadata?: Record<string, any> | null  metadata?: Record<string, any> | null
}}

export type RiderAssignmentStatus = 'pending' | 'accepted' | 'declined'

export interface Order {
export interface Order {  id: string
  id: string  number: string
  number: string  customerId: string
  customerId: string
  discount: number  discount: number
  tax: number  tax: number
  total: number  total: number
  riderId: string | null  riderId: string | null
  riderAssignmentStatus?: RiderAssignmentStatus | null
  riderAssignedAt?: string | null
  riderRespondedAt?: string | null
  riderDeclineReason?: string | null
  deliverySlot?: string | null
  deliveryScheduledFor?: string | null
  confirmedAt?: string | null
  deliveredAt?: string | null
  trackingCode: string
  trackingCode: string  notes: string
  notes: string  couponCode: string | null
  couponCode: string | null  idempotencyKey?: string | null
  idempotencyKey?: string | null
Thought · 3.7s
): Order {): Order {
  const orderLat = order.lat ? Number(order.lat) : null  const orderLat = order.lat ? Number(order.lat) : null
  const orderLng = order.lng ? Number(order.lng) : null  const orderLng = order.lng ? Number(order.lng) : null

  // Legacy orders predate the structured timing columns; fall back to the
  // status history so durations and countdowns still work.
  const historyTimestamp = (target: OrderStatus) => {
    const match = events.find(
      (event) => (event.toStatus ?? event.status) === target,
    )
    return match?.createdAt.toISOString() ?? null
  }
  const confirmedAt =
    order.confirmedAt?.toISOString() ?? historyTimestamp('confirmed')
  const deliveredAt =
    order.deliveredAt?.toISOString() ?? historyTimestamp('delivered')

  return {
    id: order.id,
    number: order.number,
    customerId: order.customerId ?? '',


  return {
    id: order.id,
    number: order.number,
    customerId: order.customerId ?? '',
    discount: order.discount,    discount: order.discount,
    tax: order.tax,    tax: order.tax,
    total: order.total,    total: order.total,
    riderId: order.riderId,    riderId: order.riderId,
    riderAssignmentStatus: (order.riderAssignmentStatus as any) ?? null,
    riderAssignedAt: order.riderAssignedAt?.toISOString() ?? null,
    riderRespondedAt: order.riderRespondedAt?.toISOString() ?? null,
    riderDeclineReason: order.riderDeclineReason ?? null,
    deliverySlot: order.deliverySlot ?? null,
    deliveryScheduledFor: order.deliveryScheduledFor?.toISOString() ?? null,
    confirmedAt,
    deliveredAt,
    trackingCode: order.trackingCode,
    notes: order.notes,
    couponCode: order.couponCode,
    idempotencyKey: order.idempotencyKey,

    trackingCode: order.trackingCode,
    notes: order.notes,
    couponCode: order.couponCode,
    idempotencyKey: order.idempotencyKey,
Thought · 13.1s
import { DEFAULT_TIMEZONE, parseDateTimeToUtc } from './campaign-timezone'
import type { Order } from '#/server/operations/types'

export const EXPRESS_DELIVERY_MINUTES = 45

export const DELIVERY_SLOT_LABELS: Record<string, string> = {
  express: 'Express (ASAP)',
  evening: 'Evening (6–8 PM)',
  late_night: 'Late night (8–10 PM)',
  custom: 'Scheduled',
}

/** Returns today's calendar date (YYYY-MM-DD) in the store timezone. */
export function getStoreDateString(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

interface DeliveryScheduleInput {
  deliverySlot?: string | null
  customDeliveryDate?: string | null
  customDeliveryTime?: string | null
  now?: Date
}

/**
 * Converts the customer-selected checkout slot into a concrete UTC instant.
 * Express orders have no fixed instant (countdown falls back to confirmation
 * time + 45 minutes); evening/late-night slots use today's store date and roll
 * to tomorrow when the window has already started.
 */
export function resolveDeliverySchedule({
  deliverySlot,
  customDeliveryDate,
  customDeliveryTime,
  now = new Date(),
}: DeliveryScheduleInput): {
  deliverySlot: string | null
  deliveryScheduledFor: Date | null
} {
  if (!deliverySlot) {
    return { deliverySlot: null, deliveryScheduledFor: null }
  }

  if (deliverySlot === 'express') {
    return { deliverySlot, deliveryScheduledFor: null }
  }

  if (deliverySlot === 'custom') {
    if (!customDeliveryTime) {
      return { deliverySlot, deliveryScheduledFor: null }
    }
    const date = customDeliveryDate || getStoreDateString(now)
    try {
      return {
        deliverySlot,
        deliveryScheduledFor: parseDateTimeToUtc(
          date,
          customDeliveryTime,
          DEFAULT_TIMEZONE,
        ),
      }
    } catch {
      return { deliverySlot, deliveryScheduledFor: null }
    }
  }

  const windowStart =
    deliverySlot === 'evening'
      ? '18:00'
      : deliverySlot === 'late_night'
        ? '20:00'
        : null

  if (!windowStart) {
    return { deliverySlot, deliveryScheduledFor: null }
  }

  let date = getStoreDateString(now)
  let scheduled = parseDateTimeToUtc(date, windowStart, DEFAULT_TIMEZONE)
  if (scheduled.getTime() <= now.getTime()) {
    date = addDays(date, 1)
    scheduled = parseDateTimeToUtc(date, windowStart, DEFAULT_TIMEZONE)
  }

  return { deliverySlot, deliveryScheduledFor: scheduled }
}

function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

/** Human-readable label for the customer-selected delivery window. */
export function formatOrderDeliveryTime(
  order: Pick<
    Order,
    'deliverySlot' | 'deliveryScheduledFor' | 'notes'
  >,
): string {
  if (order.deliveryScheduledFor) {
    const label =
      DELIVERY_SLOT_LABELS[order.deliverySlot ?? ''] ?? 'Scheduled'
    return `${label} · ${formatInstant(order.deliveryScheduledFor)}`
  }

  if (order.deliverySlot) {
    return DELIVERY_SLOT_LABELS[order.deliverySlot] ?? order.deliverySlot
  }

  // Legacy rows only carry the slot inside notes.
  const legacyMatch = order.notes?.match(/\[Slot:\s*([^\]]+)\]/i)
  if (legacyMatch) {
    return legacyMatch[1].trim()
  }

  return 'Express (ASAP)'
}

/**
 * The instant used by the rider countdown. Prefers the customer-selected
 * schedule, then falls back to confirmation time + express SLA.
 */
export function getDeliveryDeadline(
  order: Pick<
    Order,
    'deliveryScheduledFor' | 'confirmedAt' | 'createdAt'
  >,
): Date | null {
  if (order.deliveryScheduledFor) {
    return new Date(order.deliveryScheduledFor)
  }
  const base = order.confirmedAt ?? order.createdAt
  if (!base) return null
  return new Date(
    new Date(base).getTime() + EXPRESS_DELIVERY_MINUTES * 60 * 1000,
  )
}

/** Confirmation → delivery duration, in minutes, for completed orders. */
export function getDeliveryDurationMinutes(
  order: Pick<Order, 'confirmedAt' | 'deliveredAt'>,
): number | null {
  if (!order.confirmedAt || !order.deliveredAt) return null
  const minutes = Math.round(
    (new Date(order.deliveredAt).getTime() -
      new Date(order.confirmedAt).getTime()) /
      60000,
  )
  return Math.max(0, minutes)
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

Thought · 3.8s
    const trackingCode = `TRK${Math.floor(100000 + Math.random() * 900000)}`    const trackingCode = `TRK${Math.floor(100000 + Math.random() * 900000)}`
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000))    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000))
    const now = new Date()    const now = new Date()

    // Persist the customer's delivery window as structured data so dispatch,
    // riders and accounting can all show the same schedule.
    const deliverySchedule = resolveDeliverySchedule({
      deliverySlot: data.deliverySlot,
      customDeliveryDate: data.customDeliveryDate,
      customDeliveryTime: data.customDeliveryTime,
      now,
    })

    // Execute atomic creation in transaction with dbTx
    await dbTx.transaction(async (tx) => {
      // 1. Atomic coupon redemption with row-level lock
    // Execute atomic creation in transaction with dbTx      if (appliedCoupon) {
    await dbTx.transaction(async (tx) => {
      // 1. Atomic coupon redemption with row-level lock
      if (appliedCoupon) {
        discount: totals.discountPaisa,        discount: totals.discountPaisa,
        tax: totals.vatPaisa, // 13% Nepal VAT component computed by pricing engine        tax: totals.vatPaisa, // 13% Nepal VAT component computed by pricing engine
        total: totals.totalPaisa,        total: totals.totalPaisa,
        riderId: null,        riderId: null,
        deliverySlot: deliverySchedule.deliverySlot,
        deliveryScheduledFor: deliverySchedule.deliveryScheduledFor,
        trackingCode,
        deliveryOtp,
        trackingCode,        notes: [
        deliveryOtp,          data.deliverySlot && data.deliverySlot !== 'express'
        notes: [
          data.deliverySlot && data.deliverySlot !== 'express'
import type { PaymentMethod, Order } from '#/server/operations/types'import type { PaymentMethod, Order } from '#/server/operations/types'
import { checkoutFormSchema, validatePromoSchema } from './order.schemas'import { checkoutFormSchema, validatePromoSchema } from './order.schemas'
import { fromPaisa } from '#/lib/money'import { fromPaisa } from '#/lib/money'
import { validateCoupon, calculateOrderTotals } from '#/lib/pricing'import { validateCoupon, calculateOrderTotals } from '#/lib/pricing'
import { resolveDeliverySchedule } from '#/lib/delivery-time'
import {
import {  transitionOrder,
  transitionOrder,  transitionOrderTx,
  transitionOrderTx,} from '#/server/orders/order.transitions'
} from '#/server/orders/order.transitions'
Thought · 1.3s
Explored: 1 read
Thought · 1.1s
src/server/operations/operations.functions.ts
        tax: 0,        tax: 0,
        total,        total,
        trackingCode,        trackingCode,
        deliveryOtp,        deliveryOtp,
        confirmedAt: new Date(),
        notes: data.notes || '',        notes: data.notes || '',
      })      })

      for (const item of data.items) {      for (const item of data.items) {
Thought · 3.2s
  if (options.riderId !== undefined) {  if (options.riderId !== undefined) {
    updates.riderId = options.riderId    updates.riderId = options.riderId
  }  }

  if (toStatus === 'confirmed') {
    updates.confirmedAt = now
  }

  if (toStatus === 'delivered') {
    updates.deliveredAt = now
  }

  // Every fresh rider assignment starts as an offer the rider must accept.
  if (toStatus === 'rider_assigned') {
    updates.riderAssignmentStatus = 'pending'
    updates.riderAssignedAt = now
    updates.riderRespondedAt = null
    updates.riderDeclineReason = null
  }

  // Handle COD auto-mark paid when delivered
  // Handle COD auto-mark paid when delivered  if (
  if (    toStatus === 'delivered' &&
    toStatus === 'delivered' &&    existingOrder.paymentMethod === 'cod' &&
    existingOrder.paymentMethod === 'cod' &&
Thought · 3.4s
src/server/operations/operations.functions.ts
              : 'rider_assigned'              : 'rider_assigned'

        await tx        await tx
          .update(orders)          .update(orders)
          .set({ riderId: newRider.id, status: newStatus, updatedAt: now })          .set({

            riderId: newRider.id,
            status: newStatus,
            riderAssignmentStatus: 'pending',
            riderAssignedAt: now,
            riderRespondedAt: null,
            riderDeclineReason: null,
            updatedAt: now,
          .where(eq(orders.id, data.id))          })
          .where(eq(orders.id, data.id))
        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),
src/server/operations/operations.functions.ts
          await tx.insert(notifications).values({          await tx.insert(notifications).values({
            id: nid('notif'),            id: nid('notif'),
            userId: newRider.userId,            userId: newRider.userId,
            type: 'rider',            type: 'rider',
            title: `New Delivery: Order #${order.number}`,            title: `Delivery request: Order #${order.number}`,
            body: `You have been assigned to order ${order.number}.`,            body: `You have a new delivery request for order ${order.number}. Open the rider app to accept or decline.`,
            href: '/rider',
            href: '/rider',            read: false,
            read: false,            createdAt: now,
            createdAt: now,          })
          })
Thought · 1.4s
src/server/operations/operations.functions.ts
        const newStatus = shouldRevert ? revertStatus : order.status        const newStatus = shouldRevert ? revertStatus : order.status

        await tx        await tx
          .update(orders)          .update(orders)
          .set({ riderId: null, status: newStatus, updatedAt: now })          .set({

            riderId: null,
            status: newStatus,
            riderAssignmentStatus: null,
            riderRespondedAt: now,
            updatedAt: now,
          .where(eq(orders.id, data.id))          })
          .where(eq(orders.id, data.id))
        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),
Thought · 4.3s
    | 'paymentStatus'    | 'paymentStatus'
    | 'isLegacy'    | 'isLegacy'
    | 'deliveryOtp'    | 'deliveryOtp'
  > & {  > & {
    riderAssignmentStatus?: 'pending' | 'accepted' | 'declined' | null
    items?: Array<Pick<OrderItem, 'id' | 'dealerId' | 'catalogType'>>
    items?: Array<Pick<OrderItem, 'id' | 'dealerId' | 'catalogType'>>  },
  },  toStatus: OrderStatus,
  toStatus: OrderStatus,  user: UserContext,
  user: UserContext,
            'You are not the assigned rider for this delivery.',            'You are not the assigned rider for this delivery.',
            'OWNERSHIP_MISMATCH',            'OWNERSHIP_MISMATCH',
          )          )
        }        }
        if (order.riderAssignmentStatus === 'pending') {
          throw new OrderTransitionError(
            'Accept the delivery request before starting this order.',
            'INVALID_TRANSITION',
          )
        }
      } else if (user.role !== 'admin' && user.role !== 'system') {
        throw new OrderTransitionError(
      } else if (user.role !== 'admin' && user.role !== 'system') {          'Only the assigned rider or an admin can mark an order as picked up.',
        throw new OrderTransitionError(          'UNAUTHORIZED_ROLE',
          'Only the assigned rider or an admin can mark an order as picked up.',
          'UNAUTHORIZED_ROLE',
Thought · 7.0s
src/server/operations/operations.functions.ts
  getFiscalYearsQuery,  getFiscalYearsQuery,
  getDealerPayablesSummaryQuery,  getDealerPayablesSummaryQuery,
  getRiderAccountsSummaryQuery,  getRiderAccountsSummaryQuery,
  getRiderLedgerBalanceQuery,  getRiderLedgerBalanceQuery,
  getPartyStatementQuery,
  getAllDealerSettlementsQuery,  getAllDealerSettlementsQuery,
} from '#/server/finance/finance.queries'} from '#/server/finance/finance.queries'
import {import {
  getAllNotificationsQuery,  getAllNotificationsQuery,
src/server/operations/operations.functions.ts
    }    }

    const currentRider = rider    const currentRider = rider
    const orderList = await getAllOrdersQuery()    const orderList = await getAllOrdersQuery()
    const assignedOrders = orderList.filter(    const assignedOrders = orderList
      (o) => o.riderId === currentRider.id,      .filter((o) => o.riderId === currentRider.id)
      // Riders work the earliest delivery window first.
    )      .sort((a, b) => {
        const aTime = new Date(
          a.deliveryScheduledFor ?? a.confirmedAt ?? a.createdAt,
        ).getTime()
        const bTime = new Date(
          b.deliveryScheduledFor ?? b.confirmedAt ?? b.createdAt,
        ).getTime()
        return aTime - bTime
      })

    const pendingAssignments = assignedOrders.filter(
      (o) =>

        o.status === 'rider_assigned' &&
    const activeOrders = assignedOrders.filter((o) =>        o.riderAssignmentStatus === 'pending',
      ['rider_assigned', 'picked_up', 'out_for_delivery'].includes(o.status),    )
    const activeOrders = assignedOrders.filter(
      (o) =>
    )        ['rider_assigned', 'picked_up', 'out_for_delivery'].includes(o.status) &&
        o.riderAssignmentStatus !== 'pending',
    )
    const completedOrders = assignedOrders.filter(
      (o) => o.status === 'delivered',
    )

    const completedOrders = assignedOrders.filter(    const [
      (o) => o.status === 'delivered',
    )      activeShift,
      attendanceStats,
    const [activeShift, attendanceStats, riderSettlements, cashHandovers] =      riderSettlements,
      await Promise.all([
        getActiveRiderShiftQuery(currentRider.id),      cashHandovers,
        getRiderAttendanceStatsQuery(currentRider.id),
        getSettlementsByRiderIdQuery(currentRider.id),      ledgerBalance,
        getRiderCashHandoversByRiderIdQuery(currentRider.id),
      ])      ledgerEntries,
    ] = await Promise.all([
      getActiveRiderShiftQuery(currentRider.id),
      getRiderAttendanceStatsQuery(currentRider.id),
      getSettlementsByRiderIdQuery(currentRider.id),
      getRiderCashHandoversByRiderIdQuery(currentRider.id),
      getRiderLedgerBalanceQuery(db, currentRider.id),
      getPartyStatementQuery({
        partyType: 'rider',
        partyId: currentRider.id,
        limit: 25,
      }),
    ])
    const riderNotifications = await getUserNotificationsQuery(user.id, 20)
    const pendingSettlementAmount = cashHandovers
      .filter((h) => h.status === 'pending')
      .reduce((total, h) => total + h.amount, 0)
    const riderNotifications = await getUserNotificationsQuery(user.id, 20)
    const pendingSettlementAmount = cashHandovers
      .filter((h) => h.status === 'pending')
      .reduce((total, h) => total + h.amount, 0)
Thought · 2.0s
src/server/operations/operations.functions.ts
    return {    return {
      rider: currentRider,      rider: currentRider,
      orders: assignedOrders,      orders: assignedOrders,
      activeOrders,      activeOrders,
      pendingAssignments,
      completedOrders,      completedOrders,
      notifications: riderNotifications,      notifications: riderNotifications,
      activeShift,      activeShift,
      attendanceStats,      attendanceStats,
      settlements: riderSettlements,      settlements: riderSettlements,
      cashHandovers,      cashHandovers,
      pendingSettlementAmount,      pendingSettlementAmount,
      ledger: {
        balance: ledgerBalance,
        entries: ledgerEntries,
      },
      stats: {      stats: {
        totalAssigned: assignedOrders.length,        totalAssigned: assignedOrders.length,
        activeCount: activeOrders.length,        activeCount: activeOrders.length,
        pendingCount: pendingAssignments.length,
        completedCount: completedOrders.length,        completedCount: completedOrders.length,
        cashOnHand: currentRider.cashOnHand,        cashOnHand: currentRider.cashOnHand,
        earnings: currentRider.earnings,        earnings: currentRider.earnings,
        deliveries: currentRider.deliveries,        deliveries: currentRider.deliveries,
Thought · 13.7s
src/server/operations/operations.functions.ts
  user,  user,
  riderShifts,  riderShifts,
} from '#/db/schema'} from '#/db/schema'
import { auth } from '#/lib/auth'import { auth } from '#/lib/auth'
import { and, count, eq, isNull, or } from 'drizzle-orm'import { and, count, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import {import {
  requirePermission,  requirePermission,
  requireRole,  requireRole,
  logAudit,  logAudit,
src/server/operations/operations.functions.ts

    return true    return true
  })  })

export const respondToRiderAssignmentFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        action: z.enum(['accept', 'decline']),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    if (user.role !== 'rider') {
      throw new Error('Forbidden: Rider access required')
    }

    const rider = await getRiderByUserIdQuery(user.id)
    if (!rider) throw new Error('Rider profile not found')

    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')
    if (order.riderId !== rider.id) {
      throw new Error('Forbidden: This delivery is not assigned to you')
    }
    if (order.status !== 'rider_assigned') {
      throw new Error(
        `This delivery is already "${order.status.replace(/_/g, ' ')}" and can no longer be accepted or declined.`,
      )
    }
    if (order.riderAssignmentStatus === 'accepted' && data.action === 'accept') {
      return { success: true, action: 'accepted' as const }
    }
    if (order.riderAssignmentStatus === 'declined') {
      throw new Error('This delivery request has already been declined.')
    }
    if (
      order.riderAssignmentStatus !== 'pending' &&
      order.riderAssignmentStatus != null
    ) {
      throw new Error('This delivery request is no longer open.')
    }

    const now = new Date()
    const revertStatus: OrderStatus =
      order.items.length > 0 &&
      order.items.every((item) => item.dealerId && item.sourcingStatus === 'assigned')
        ? 'dealer_assigned'
        : 'confirmed'

    await dbTx.transaction(async (tx) => {
      if (data.action === 'accept') {
        // A rider may only hold one accepted active delivery at a time, even
        // though dispatch can offer several orders in parallel.
        const otherActive = await tx
          .select({ id: orders.id, number: orders.number })
          .from(orders)
          .where(
            and(
              eq(orders.riderId, rider.id),
              ne(orders.id, order.id),
              inArray(orders.status, [
                'rider_assigned',
                'picked_up',
                'out_for_delivery',
              ]),
              eq(orders.riderAssignmentStatus, 'accepted'),
            ),
          )
          .limit(1)

        if (otherActive[0]) {
          throw new Error(
            `You already accepted delivery ${otherActive[0].number}. Complete or hand it back before accepting another order.`,
          )
        }

        await tx
          .update(orders)
          .set({
            riderAssignmentStatus: 'accepted',
            riderRespondedAt: now,
            updatedAt: now,
          })
          .where(eq(orders.id, order.id))

        await tx.insert(orderStatusHistory).values({
          id: nid('evt'),
          orderId: order.id,
          status: 'rider_assigned',
          fromStatus: 'rider_assigned',
          toStatus: 'rider_assigned',
          note: `Delivery request accepted by ${rider.name}`,
          actor: rider.name,
          actorId: user.id,
          actorRole: 'rider',
          createdAt: now,
        })

        await tx.insert(notifications).values({
          id: nid('notif'),
          type: 'rider',
          title: `Rider accepted order ${order.number}`,
          body: `${rider.name} accepted the delivery request for order ${order.number}.`,
          href: '/admin/orders',
          read: false,
          createdAt: now,
        })

        await tx
          .update(riders)
          .set({ status: 'busy', updatedAt: now })
          .where(eq(riders.id, rider.id))
      } else {
        await tx
          .update(orders)
          .set({
            riderId: null,
            status: revertStatus,
            riderAssignmentStatus: 'declined',
            riderRespondedAt: now,
            riderDeclineReason: data.reason?.trim() || 'Declined by rider',
            updatedAt: now,
          })
          .where(eq(orders.id, order.id))

        await tx.insert(orderStatusHistory).values({
          id: nid('evt'),
          orderId: order.id,
          status: revertStatus,
          fromStatus: order.status,
          toStatus: revertStatus,
          note: `Delivery request declined by ${rider.name}${data.reason ? `: ${data.reason.trim()}` : ''}. Order returned to dispatch.`,
          actor: rider.name,
          actorId: user.id,
          actorRole: 'rider',
          createdAt: now,
        })

        await tx.insert(notifications).values({
          id: nid('notif'),
          type: 'rider',
          title: `Rider declined order ${order.number}`,
          body: `${rider.name} declined the delivery request for order ${order.number}${data.reason ? `: ${data.reason.trim()}` : ''}. Reassign a rider.`,
          href: '/admin/orders',
          read: false,
          createdAt: now,
        })

        await tx
          .update(riders)
          .set({
            status: rider.available ? 'available' : 'offline',
            updatedAt: now,
          })
          .where(eq(riders.id, rider.id))
      }
    })

    await logAudit(
      rider.name,
      'orders',
      'edit',
      `Rider ${rider.name} ${data.action === 'accept' ? 'accepted' : 'declined'} delivery request for order ${order.number}${data.reason ? ` (${data.reason.trim()})` : ''}`,
    )

    return {
      success: true,
      action: data.action === 'accept' ? ('accepted' as const) : ('declined' as const),
    }
  })

export const createDeliveryProofUploadFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({


































export const createDeliveryProofUploadFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
Thought · 3.9s
src/server/operations/operations.functions.ts
        href: '/admin/accounts?tab=salary-account',        href: '/admin/accounts?tab=salary-account',
        read: false,        read: false,
        createdAt: now,        createdAt: now,
      })      })

      // Confirm to the rider that their request reached the admin queue.
      await tx.insert(notifications).values({
        id: nid('notif'),
        userId: user.id,
        type: 'finance',
        title: 'Settlement request sent to admin',
        body: `Your settlement request of Rs. ${(data.amount / 100).toFixed(2)} via ${RIDER_SETTLEMENT_METHOD_LABELS[data.paymentMethod]} is pending admin approval.`,
        href: '/rider/earnings',
        read: false,
        createdAt: now,
      })
    })

    await logAudit(
      rider.name,
    })

    await logAudit(
      rider.name,
Thought · 7.1s
src/components/panels/rider/delivery-countdown.tsx
import { useEffect, useState } from 'react'
import { Clock, TimerOff, Timer } from 'lucide-react'
import type { Order } from '#/server/operations/types'
import {
  formatDurationMinutes,
  getDeliveryDeadline,
  getDeliveryDurationMinutes,
} from '#/lib/delivery-time'
import { cn } from '#/lib/utils'

interface DeliveryCountdownProps {
  order: Pick<
    Order,
    | 'status'
    | 'createdAt'
    | 'confirmedAt'
    | 'deliveredAt'
    | 'deliveryScheduledFor'
  >
  className?: string
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [active])

  return now
}

/**
 * Rider-facing delivery timer. Counts down to the customer-selected window
 * (or confirmation + 45 minutes for express orders) and reports the actual
 * confirmation → delivery duration once completed.
 */
export function DeliveryCountdown({ order, className }: DeliveryCountdownProps) {
  const isCompleted = order.status === 'delivered'
  const isStopped =
    order.status === 'cancelled' ||
    order.status === 'returned' ||
    order.status === 'delivery_failed'
  const now = useNow(!isCompleted && !isStopped)

  if (isCompleted) {
    const minutes = getDeliveryDurationMinutes(order)
    if (minutes == null) return null
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400',
          className,
        )}
        title="Time from order confirmation to successful delivery"
      >
        <Timer className="h-3 w-3" />
        Delivered in {formatDurationMinutes(minutes)}
      </span>
    )
  }

  if (isStopped) return null

  const deadline = getDeliveryDeadline(order)
  if (!deadline) return null

  const diffMs = deadline.getTime() - now
  const isOverdue = diffMs < 0
  const minutes = Math.max(1, Math.round(Math.abs(diffMs) / 60_000))

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
        isOverdue
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : diffMs <= 15 * 60_000
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'border-border bg-muted/50 text-muted-foreground',
        className,
      )}
      title={
        isOverdue
          ? 'Delivery window has passed'
          : 'Time remaining until the delivery window'
      }
    >
      {isOverdue ? (
        <TimerOff className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isOverdue ? 'Overdue' : 'Due in'} {formatDurationMinutes(minutes)}
    </span>
  )
}

Thought · 3.4s
src/components/panels/rider/rider-dashboard.tsx
import {import {
  updateRiderDeliveryStatusFn,  updateRiderDeliveryStatusFn,
  toggleRiderAvailabilityFn,  toggleRiderAvailabilityFn,
  updateRiderLiveFn,  updateRiderLiveFn,
  respondToRiderAssignmentFn,
} from '#/server/operations/operations.functions'} from '#/server/operations/operations.functions'
import type { getRiderPortalFn } from '#/server/operations/operations.functions'import type { getRiderPortalFn } from '#/server/operations/operations.functions'
import {import {
  queueOutboxAction,  queueOutboxAction,
src/components/panels/rider/rider-dashboard.tsx
} from '#/lib/idb/outbox'} from '#/lib/idb/outbox'
import { useOnlineStatus, isNetworkError } from '#/hooks/use-online-status'import { useOnlineStatus, isNetworkError } from '#/hooks/use-online-status'
import type { Rider, Order } from '#/server/operations/types'import type { Rider, Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'import { formatNPR } from '#/lib/money'
import { formatOrderDeliveryTime } from '#/lib/delivery-time'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { getGoogleMapsUrl } from '#/lib/map-config'import { DeliveryCountdown } from './delivery-countdown'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Button } from '#/components/ui/button'import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader } from '#/components/ui/card'import {
import { Badge } from '#/components/ui/badge'
import {
src/components/panels/rider/rider-dashboard.tsx
  Loader2,  Loader2,
  Wifi,  Wifi,
  AlertTriangle,  AlertTriangle,
  Radio,  Radio,
  Check,
  X,
} from 'lucide-react'} from 'lucide-react'
import { toast } from 'sonner'import { toast } from 'sonner'
import { RiderDealerPickups } from './rider-dealer-pickups'import { RiderDealerPickups } from './rider-dealer-pickups'
import { DeliveryProofDialog } from './delivery-proof-dialog'import { DeliveryProofDialog } from './delivery-proof-dialog'
src/components/panels/rider/rider-dashboard.tsx
  data?: {  data?: {
    rider: Rider    rider: Rider
    orders: Order[]    orders: Order[]
    activeOrders: Order[]    activeOrders: Order[]
    pendingAssignments?: Order[]
    completedOrders: Order[]    completedOrders: Order[]
    stats: {    stats: {
      totalAssigned: number      totalAssigned: number
      activeCount: number      activeCount: number
      pendingCount?: number
      completedCount: number      completedCount: number
      cashOnHand: number      cashOnHand: number
      earnings: number      earnings: number
      deliveries: number      deliveries: number
src/components/panels/rider/rider-dashboard.tsx
    return map    return map
  }, [pendingActions])  }, [pendingActions])

  const { rider, orders } = portalData  const { rider, orders } = portalData
  const pendingAssignments = portalData.pendingAssignments ?? []

  // Set initial sync date from rider.updatedAt if available
  // Set initial sync date from rider.updatedAt if available  useEffect(() => {
  useEffect(() => {    if (rider.updatedAt) {
    if (rider.updatedAt) {
Thought · 2.6s
src/components/panels/rider/rider-dashboard.tsx
      })      })
    }    }
  }  }

  const handleRespondToAssignment = async (
    orderId: string,
    action: 'accept' | 'decline',
  ) => {
    if (pendingOrderIds.has(orderId)) return
    setPendingOrderIds((prev) => new Set(prev).add(orderId))
    try {
      await respondToRiderAssignmentFn({
        data: { orderId, action },
      })
      toast.success(
        action === 'accept'
          ? 'Delivery accepted. Head to the dealer for pickup.'
          : 'Delivery declined. Dispatch has been notified.',
      )
      await queryClient.invalidateQueries({
        queryKey: riderQueries.portal().queryKey,
      })
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${action} the delivery request`,
      )
    } finally {
      setPendingOrderIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }

  // Delivery status transitions: Start Delivery and Mark Delivered
  const handleUpdateStatus = async (
    orderId: string,
    targetStatus: 'picked_up' | 'out_for_delivery' | 'delivered',
  // Delivery status transitions: Start Delivery and Mark Delivered
  const handleUpdateStatus = async (
    orderId: string,
    targetStatus: 'picked_up' | 'out_for_delivery' | 'delivered',
Thought · 5.3s
src/components/panels/rider/rider-dashboard.tsx
          </CardContent>          </CardContent>
        </Card>        </Card>
      </div>      </div>

      {/* Pending delivery requests: dispatch may offer several, but only one
          can be accepted at a time. */}
      {pendingAssignments.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Delivery Requests
            </h3>
            <p className="text-xs text-muted-foreground">
              Accept one order at a time. Decline sends it back to dispatch.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAssignments.map((order) => {
              const isResponding = pendingOrderIds.has(order.id)
              return (
                <Card
                  key={order.id}
                  className="border-amber-500/40 bg-amber-500/[0.03]"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {order.number}
                          </span>
                          <Badge variant="warning" className="text-xs">
                            Awaiting response
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.address}, {order.city}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {formatNPR(order.total)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs font-normal gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {formatOrderDeliveryTime(order)}
                      </Badge>
                      <DeliveryCountdown order={order} />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          void handleRespondToAssignment(order.id, 'accept')
                        }
                        disabled={isResponding}
                        className="h-9 flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleRespondToAssignment(order.id, 'decline')
                        }
                        disabled={isResponding}
                        className="h-9 flex-1 gap-1.5 text-destructive"
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Orders Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
























      {/* Active Orders Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
Thought · 1.9s
src/components/panels/rider/rider-dashboard.tsx
            {/* Customer Name */}            {/* Customer Name */}
            <p className="text-sm font-semibold text-foreground mt-1.5">            <p className="text-sm font-semibold text-foreground mt-1.5">
              {order.customerName}              {order.customerName}
            </p>            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatOrderDeliveryTime(order)}
              </span>
              <DeliveryCountdown order={order} />
            </div>
          </div>
          {/* Amount & COD vs Prepaid Treatment */}
          </div>          <div className="text-right shrink-0">
          {/* Amount & COD vs Prepaid Treatment */}            <span className="font-mono text-sm font-bold text-foreground tabular-nums block">
          <div className="text-right shrink-0">
            <span className="font-mono text-sm font-bold text-foreground tabular-nums block">
Thought · 3.2s
src/components/panels/rider/rider-deliveries.tsx
import { useState } from 'react'import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'import { useRouter } from '@tanstack/react-router'
import { updateRiderDeliveryStatusFn } from '#/server/operations/operations.functions'import {

  updateRiderDeliveryStatusFn,
  respondToRiderAssignmentFn,
import { queueOutboxAction } from '#/lib/idb/outbox'} from '#/server/operations/operations.functions'
import type { Order } from '#/server/operations/types'import { queueOutboxAction } from '#/lib/idb/outbox'
import { formatNPR } from '#/lib/money'import type { Order } from '#/server/operations/types'
import { getGoogleMapsUrl } from '#/lib/map-config'import { formatNPR } from '#/lib/money'
import { getGoogleMapsUrl } from '#/lib/map-config'
src/components/panels/rider/rider-deliveries.tsx
} from '#/server/operations/operations.functions'} from '#/server/operations/operations.functions'
import { queueOutboxAction } from '#/lib/idb/outbox'import { queueOutboxAction } from '#/lib/idb/outbox'
import type { Order } from '#/server/operations/types'import type { Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'import { formatNPR } from '#/lib/money'
import { formatOrderDeliveryTime } from '#/lib/delivery-time'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { getGoogleMapsUrl } from '#/lib/map-config'import { DeliveryCountdown } from './delivery-countdown'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Button } from '#/components/ui/button'import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader } from '#/components/ui/card'import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
src/components/panels/rider/rider-deliveries.tsx
  MapPin,  MapPin,
  CheckCircle2,  CheckCircle2,
  Truck,  Truck,
  AlertTriangle,  AlertTriangle,
  Check,
  X,
} from 'lucide-react'} from 'lucide-react'
import { toast } from 'sonner'import { toast } from 'sonner'
import { RiderDealerPickups } from './rider-dealer-pickups'import { RiderDealerPickups } from './rider-dealer-pickups'
import { DeliveryProofDialog } from './delivery-proof-dialog'import { DeliveryProofDialog } from './delivery-proof-dialog'
src/components/panels/rider/rider-deliveries.tsx
}}

export function RiderDeliveries({ orders }: RiderDeliveriesProps) {export function RiderDeliveries({ orders }: RiderDeliveriesProps) {
  const router = useRouter()  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active')  const [filter, setFilter] = useState<

    'all' | 'requests' | 'active' | 'completed'
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)  >('active')
  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null)  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [failedOrderTarget, setFailedOrderTarget] = useState<Order | null>(null)  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null)
  const [failedReason, setFailedReason] = useState('')  const [failedOrderTarget, setFailedOrderTarget] = useState<Order | null>(null)
  const [failedReason, setFailedReason] = useState('')
src/components/panels/rider/rider-deliveries.tsx
  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null)  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null)
  const [failedOrderTarget, setFailedOrderTarget] = useState<Order | null>(null)  const [failedOrderTarget, setFailedOrderTarget] = useState<Order | null>(null)
  const [failedReason, setFailedReason] = useState('')  const [failedReason, setFailedReason] = useState('')

  const activeOrders = orders.filter((o) =>  const requestOrders = orders.filter(
    ['rider_assigned', 'picked_up', 'out_for_delivery'].includes(o.status),    (o) =>

      o.status === 'rider_assigned' &&
  )      o.riderAssignmentStatus === 'pending',
  const completedOrders = orders.filter((o) =>  )
    ['delivered', 'delivery_failed'].includes(o.status),  const activeOrders = orders.filter(
    (o) =>

      ['rider_assigned', 'picked_up', 'out_for_delivery'].includes(o.status) &&
  )      o.riderAssignmentStatus !== 'pending',
  )
  // Failed deliveries are deliberately excluded from "Done".
  const completedOrders = orders.filter((o) => o.status === 'delivered')

  const displayedOrders =
  const displayedOrders =    filter === 'requests'
    filter === 'active'      ? requestOrders
      ? activeOrders      : filter === 'active'
      : filter === 'completed'        ? activeOrders
        ? completedOrders        : filter === 'completed'
        : orders          ? completedOrders
          : orders

  const handleUpdateStatus = async (
  const handleUpdateStatus = async (    orderId: string,
    orderId: string,    status: 'picked_up' | 'out_for_delivery' | 'delivered' | 'delivery_failed',
    status: 'picked_up' | 'out_for_delivery' | 'delivered' | 'delivery_failed',
Thought · 1.6s
src/components/panels/rider/rider-deliveries.tsx
      setUpdatingOrderId(null)      setUpdatingOrderId(null)
    }    }
  }  }

  const handleRespond = async (
    orderId: string,
    action: 'accept' | 'decline',
  ) => {
    try {
      setUpdatingOrderId(orderId)
      await respondToRiderAssignmentFn({ data: { orderId, action } })
      toast.success(
        action === 'accept'
          ? 'Delivery accepted. Head to the dealer for pickup.'
          : 'Delivery declined. Dispatch has been notified.',
      )
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} delivery request`)
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleConfirmDelivery = async ({
    orderId,
    ageVerifiedAtDelivery,
    deliveryOtp,
  const handleConfirmDelivery = async ({
    orderId,
    ageVerifiedAtDelivery,
    deliveryOtp,
Thought · 2.4s
src/components/panels/rider/rider-deliveries.tsx
          value={filter}          value={filter}
          onValueChange={(v) => setFilter(v as any)}          onValueChange={(v) => setFilter(v as any)}
          className="w-full sm:w-auto"          className="w-full sm:w-auto"
        >        >
          <TabsList className="grid grid-cols-3 w-full sm:w-auto h-8">          <TabsList className="grid grid-cols-4 w-full sm:w-auto h-8">
            <TabsTrigger value="requests" className="text-xs">
              Requests ({requestOrders.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs">
            <TabsTrigger value="active" className="text-xs">              Active ({activeOrders.length})
              Active ({activeOrders.length})            </TabsTrigger>
            </TabsTrigger>            <TabsTrigger value="completed" className="text-xs">
            <TabsTrigger value="completed" className="text-xs">
Thought · 3.0s
src/components/panels/rider/rider-deliveries.tsx
            const isFailed = order.status === 'delivery_failed'            const isFailed = order.status === 'delivery_failed'
            const isOut = order.status === 'out_for_delivery'            const isOut = order.status === 'out_for_delivery'
            const isPickedUp = order.status === 'picked_up'            const isPickedUp = order.status === 'picked_up'
            const isRiderAssigned = order.status === 'rider_assigned'            const isRiderAssigned = order.status === 'rider_assigned'
            const isRequest =
              isRiderAssigned && order.riderAssignmentStatus === 'pending'
            const isCOD = order.paymentMethod === 'cod'
            const isCOD = order.paymentMethod === 'cod'            const isUpdating = updatingOrderId === order.id
            const isUpdating = updatingOrderId === order.id
            return (
            return (
src/components/panels/rider/rider-deliveries.tsx
                      </div>                      </div>
                      <p className="text-xs font-medium text-foreground mt-1">                      <p className="text-xs font-medium text-foreground mt-1">
                        {order.customerName}                        {order.customerName}
                      </p>                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {formatOrderDeliveryTime(order)}
                        </span>
                        <DeliveryCountdown order={order} />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-foreground">


                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-foreground">
Thought · 1.5s
Explored: 1 read
Thought · 1.9s
src/components/panels/rider/rider-deliveries.tsx
                        Call                        Call
                      </a>                      </a>
                    </Button>                    </Button>

                    {!isDelivered && !isFailed && (                    {isRequest && (
                      <>                      <>
                        <Button
                          size="sm"
                          onClick={() => void handleRespond(order.id, 'accept')}
                          disabled={isUpdating}
                          className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRespond(order.id, 'decline')}
                          disabled={isUpdating}
                          className="h-8 text-xs flex-1 text-destructive"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Decline
                        </Button>
                      </>
                    )}

                    {!isRequest && !isDelivered && !isFailed && (
                      <>
                        {isRiderAssigned && (
                          <Button
                            size="sm"
                            onClick={() =>




                        {isRiderAssigned && (
                          <Button
                            size="sm"
                            onClick={() =>
Thought · 1.2s
src/components/panels/rider/rider-deliveries.tsx
                                  : 'outline'                                  : 'outline'
                          }                          }
                          className="text-xs uppercase tracking-wider"                          className="text-xs uppercase tracking-wider"
                        >                        >
                          {order.status.replace(/_/g, ' ')}                          {isRequest

                            ? 'Awaiting response'
                            : order.status.replace(/_/g, ' ')}
                        </Badge>                        </Badge>
                      </div>                      </div>
                      <p className="text-xs font-medium text-foreground mt-1">                      <p className="text-xs font-medium text-foreground mt-1">
                        {order.customerName}                        {order.customerName}
Thought · 4.4s
src/components/panels/rider/rider-profile.tsx
import { useState } from 'react'import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'import { useRouter } from '@tanstack/react-router'
import { toggleRiderAvailabilityFn } from '#/server/operations/operations.functions'import { toggleRiderAvailabilityFn } from '#/server/operations/operations.functions'
import type { Rider } from '#/server/operations/types'import type { Rider } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'import { Badge } from '#/components/ui/badge'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'import { ConfirmDialog } from '#/components/shared/confirm-dialog'
src/components/panels/rider/rider-profile.tsx
  Phone,  Phone,
  Mail,  Mail,
  Power,  Power,
  LogOut,  LogOut,
  Wallet,
  BookOpen,
} from 'lucide-react'} from 'lucide-react'
import { toast } from 'sonner'import { toast } from 'sonner'

interface RiderProfileProps {interface RiderProfileProps {
src/components/panels/rider/rider-profile.tsx
  BookOpen,  BookOpen,
} from 'lucide-react'} from 'lucide-react'
import { toast } from 'sonner'import { toast } from 'sonner'

interface RiderLedgerEntry {
  lineId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  narration: string | null
}

interface RiderProfileProps {interface RiderProfileProps {
  rider: Rider  rider: Rider
  ledger?: {
    balance: {
      commissionPayable: number
      undepositedCodCash: number
      outstandingAdvances: number
    }
    entries: RiderLedgerEntry[]
  }
}}

export function RiderProfile({ rider }: RiderProfileProps) {export function RiderProfile({ rider, ledger }: RiderProfileProps) {
  const router = useRouter()  const router = useRouter()
  const [isTogglingAvail, setIsTogglingAvail] = useState(false)  const [isTogglingAvail, setIsTogglingAvail] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
Thought · 5.7s
src/components/panels/rider/rider-profile.tsx
          </div>          </div>
        </CardContent>        </CardContent>
      </Card>      </Card>

      {/* Read-only ledger */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            My Ledger (read-only)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <span className="block text-muted-foreground">
                Commission payable
              </span>
              <span className="font-mono font-semibold text-success">
                {formatNPR(ledger?.balance.commissionPayable ?? 0)}
              </span>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <span className="block text-muted-foreground">COD cash held</span>
              <span className="font-mono font-semibold text-warning">
                {formatNPR(ledger?.balance.undepositedCodCash ?? 0)}
              </span>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <span className="block text-muted-foreground">Advances</span>
              <span className="font-mono font-semibold text-foreground">
                {formatNPR(ledger?.balance.outstandingAdvances ?? 0)}
              </span>
            </div>
          </div>

          {!ledger || ledger.entries.length === 0 ? (
            <p className="text-muted-foreground">
              No ledger entries yet. Entries appear after deliveries and
              settlements are posted.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {ledger.entries.slice(0, 8).map((entry) => (
                <div
                  key={entry.lineId}
                  className="flex items-start justify-between gap-2 p-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono font-semibold text-foreground">
                        {entry.voucherNo ?? entry.voucherType}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(entry.postingDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">
                      {entry.narration ||
                        `${entry.accountCode} · ${entry.accountName}`}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      entry.debit > 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {entry.debit > 0 ? '+' : '-'}
                    {formatNPR(entry.debit > 0 ? entry.debit : entry.credit)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-muted-foreground">
            Ledger entries are posted by accounts and cannot be edited here.
          </p>
        </CardContent>
      </Card>

      {/* Password & Security */}
      <ChangePasswordCard userName={rider.name} userEmail={rider.email} />

      {/* Shift & Actions */}






























      {/* Password & Security */}
      <ChangePasswordCard userName={rider.name} userEmail={rider.email} />

      {/* Shift & Actions */}
Thought · 877ms
})})

function RiderProfilePage() {function RiderProfilePage() {
  const { data } = useSuspenseQuery(riderQueries.portal())  const { data } = useSuspenseQuery(riderQueries.portal())
  return <RiderProfile rider={data.rider} />  return <RiderProfile rider={data.rider} ledger={data.ledger} />
}
}
Thought · 3.4s
src/components/panels/orders/orders-panel.tsx
  OrderStatus,  OrderStatus,
  PaymentMethod,  PaymentMethod,
} from '#/server/operations/types'} from '#/server/operations/types'
import { formatNPR } from '#/lib/money'import { formatNPR } from '#/lib/money'
import { formatOrderDeliveryTime } from '#/lib/delivery-time'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { getGoogleMapsUrl } from '#/lib/map-config'import {
import {  calculateHaversineDistanceKm,
  calculateHaversineDistanceKm,  formatDistanceKm,
  formatDistanceKm,
src/components/panels/orders/orders-panel.tsx
                          </span>                          </span>
                          <span className="text-xs text-muted-foreground font-mono">                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(order.createdAt).toLocaleDateString()}                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {formatOrderDeliveryTime(order)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-foreground">
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-foreground">
Thought · 1.1s
$ grep -n "from 'lucide-react'" -B 40 src/components/panels/orders/orders-panel.tsx | grep -n "Clock\|lucide" | head
29:71-  Clock,
41:83:} from 'lucide-react'
Thought · 2.6s
src/components/panels/orders/orders-panel.tsx
                      >                      >
                        {selectedOrder.address}, {selectedOrder.city}                        {selectedOrder.address}, {selectedOrder.city}
                      </a>                      </a>
                    </div>                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>
                        Customer delivery time:{' '}
                        <strong className="font-medium text-foreground">
                          {formatOrderDeliveryTime(selectedOrder)}
                        </strong>
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>

                  </CardContent>
                </Card>

                <Card>
Compaction· 170.8K in · 2.0K out
Objective
Fix the listed Mezmani rider-app/website and dealer bugs: rider settlement notifications, delivery-time display, rider accept/decline flow, countdowns, ledger visibility, and dealer sourcing cost-price saving/display.
Requirements
RIDER APP > Settlement:
Minimize details in rider sections.
/rider/deliveries: failed status must not appear under Done.
Rider profile page shows ledger read-only.
Send notice to rider when settlement request is sent to admin.
Admin panel and rider dashboard must show the customer-selected delivery time.
Admin-assigned rider must accept or decline; notify admin panel.
Admin can assign multiple orders to a rider, but rider can accept only one at a time.
Rider order list sorted ASC by time.
Countdown system on order list; track delivery duration from order confirmation to successful delivery.
Dealer:
Show Cost price & MRP Price.
Admin cannot save sourcing item cost price on /admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91.
Cost price must show in /admin/accounts?tab=dealer-ledger using the constant declared in the dealer route.
No commit/push unless explicitly requested.
Decisions
Rider acceptance is modeled with orders.riderAssignmentStatus (pending|accepted|declined) rather than a new order status; null is treated as accepted for legacy rows.
New assignments set pending; legacy assigned rows are backfilled to accepted.
Rider may hold only one accepted active order; parallel offers remain pending until accepted/declined.
Delivery schedule stored as orders.deliverySlot + orders.deliveryScheduledFor; timestamps confirmedAt, deliveredAt; rider response metadata riderAssignedAt, riderRespondedAt, riderDeclineReason.
Countdown target = deliveryScheduledFor, falling back to confirmedAt (or createdAt) + 45 minutes.
Rider ledger exposed read-only via existing getRiderLedgerBalanceQuery + getPartyStatementQuery inside getRiderPortalFn.
Dealer form save bug fix: track separate itemsDirty state and pass isDirty={form.formState.isDirty || itemsDirty} (not yet implemented).
Dealer MRP is derived from product variants (liquorVariants.mrp / foodVariants.mrp) since dealer items are product-level (not yet implemented).
Work State
Completed
Added migration drizzle/0027_rider_acceptance_and_delivery_timing.sql and registered it in drizzle/meta/_journal.json (idx: 27, when: 1794500000000).
Added orders columns: delivery_slot, delivery_scheduled_for, confirmed_at, delivered_at, rider_assignment_status, rider_assigned_at, rider_responded_at, rider_decline_reason; indexes; backfills from order_status_history.
Updated Drizzle orders schema, Order type (RiderAssignmentStatus), and mapOrderRecord with history fallback for confirmedAt/deliveredAt.
Created src/lib/delivery-time.ts (resolveDeliverySchedule, formatOrderDeliveryTime, getDeliveryDeadline, getDeliveryDurationMinutes, formatDurationMinutes).
Persisted delivery schedule in createCustomerOrderFn; set confirmedAt in admin createOrderFn.
transitionOrderTx sets confirmedAt, deliveredAt, and pending rider assignment fields.
updateOrderFn rider assignment now sets pending + timestamps and clears response fields; unassign clears assignment status.
Blocked rider picked_up while riderAssignmentStatus === 'pending' in validateOrderTransition.
Added respondToRiderAssignmentFn with accept/decline, one-active-accepted-order enforcement, admin notifications, audit log, rider status recompute.
Added rider notification when a settlement request is submitted (depositRiderCashFn).
getRiderPortalFn now sorts orders ASC by delivery time, returns pendingAssignments, stats.pendingCount, and ledger (balance + 25 statement entries).
Created src/components/panels/rider/delivery-countdown.tsx.
Rider dashboard: added pending request cards with Accept/Decline, delivery time + countdown on active order cards.
Rider deliveries: added Requests tab, fixed Done to delivered only, added delivery time/countdown, Accept/Decline actions.
Rider profile: added read-only ledger card (balances + recent entries); route passes data.ledger.
Admin orders: table shows customer delivery time under date; order detail Customer Details card shows delivery time.
Active
Dealer form: fix dirty-state save bug and add MRP column/display.
Dealer ledger: show dealer item cost price (and MRP) in /admin/accounts?tab=dealer-ledger.
"Minimize details in rider sections" UI compaction not yet done.
Blocked
(none)
Next Move
Update dealer-form.tsx: add itemsDirty state, set on add/delete/row change, remove form.setValue('name', ...) hacks, pass combined isDirty, reset after save.
Extend AssignedItemDto/CatalogItemSummary with mrp; derive product MRP from active liquor/food variants in inventory.queries.ts; add MRP column in dealer form and MRP display in add-item dialog.
Add dealer catalog cost/MRP section to dealer-report-tab.tsx using adminQueries.dealer(selectedDealer.dealerId); show cost price and MRP.
Compact rider UI copy/sections where verbose (earnings/profile/deliveries) without removing functionality.
Run bunx tsc --noEmit, bun run lint, bun run check, and relevant tests (including src/db/migrations.test.ts); fix regressions.
Relevant Files
drizzle/0027_rider_acceptance_and_delivery_timing.sql: new migration.
src/db/schema/orders.ts: new order columns/indexes.
src/server/operations/types.ts: Order, RiderAssignmentStatus.
src/server/orders/order.queries.ts: mapOrderRecord timing mapping/fallback.
src/server/orders/order.transitions.ts: lifecycle timestamps + pending assignment.
src/server/orders/order.functions.ts: delivery schedule persistence.
src/server/operations/operations.functions.ts: updateOrderFn, respondToRiderAssignmentFn, getRiderPortalFn, depositRiderCashFn.
src/lib/order-status.ts: pickup gate for pending acceptance.
src/lib/delivery-time.ts: schedule/deadline/format helpers.
src/components/panels/rider/rider-dashboard.tsx: request cards, countdown, delivery time.
src/components/panels/rider/rider-deliveries.tsx: Requests tab, Done fix, respond actions.
src/components/panels/rider/rider-profile.tsx: read-only ledger card.
src/components/panels/rider/delivery-countdown.tsx: countdown component.
src/components/panels/orders/orders-panel.tsx: admin delivery-time display.
src/components/panels/dealers/dealer-form.tsx: remaining cost-price save + MRP work.
src/components/panels/accounts/tabs/dealer-report-tab.tsx: remaining dealer ledger cost/MRP display.
src/server/inventory/inventory.queries.ts: dealer item DTOs/MRP derivation.
Important Context
Working tree has a pre-existing unrelated modification: src/lib/firebase-admin.ts.
Branch: major-update/accounting-module; latest commit 1833fe8.
Dealer save bug root cause: form.setValue('name', form.getValues('name'), { shouldDirty: true }) does not dirty RHF because value equals default; FormHeader Save is disabled when !isDirty.
riderAssignmentStatus is nullable; only explicit 'pending' blocks pickup, so legacy/null rows still work.
Rider portal activeOrders excludes pending offers; orders includes all assigned orders sorted ASC.
getPartyStatementQuery requires partyType: 'rider' and partyId (rider id).
Admin notifications use notifications rows with userId: null.
Existing BatchDealerSettlementDialog already shows cost price but no MRP.
Migration test requires every .sql file registered and every Drizzle column present; run src/db/migrations.test.ts after schema changes.
Do not run DB migrations/pushes; owner applies SQL manually.
Thought · 1.2s
I'll continue with the dealer form fixes. Let me inspect the current state of the relevant files.
Explored: 2 reads
Thought · 1.1s
Explored: 3 reads, 1 search
Thought · 5.1s
Now I'll add MRP derivation to the inventory queries.
  dealerPriceHistory,  dealerPriceHistory,
  stockMovements,  stockMovements,
  liquorProducts,  liquorProducts,
  foodProducts,  foodProducts,
  liquorVariants,
  foodVariants,
  liquorCategories,  liquorCategories,
  foodCategories,  foodCategories,
  liquorBrands,  liquorBrands,
  foodBrands,  foodBrands,
Thought · 1.9s
  productName: string  productName: string
  categoryName?: string | null  categoryName?: string | null
  brandName?: string | null  brandName?: string | null
  costPrice?: number  costPrice?: number
  /** Representative MRP (minimum active variant MRP) in paisa. */
  mrp?: number | null
  isAvailable?: boolean
  isAvailable?: boolean  effectiveFrom?: string
  effectiveFrom?: string}
}

  catalogType: 'liquor' | 'food'  catalogType: 'liquor' | 'food'
  name: string  name: string
  categoryName?: string | null  categoryName?: string | null
  brandName?: string | null  brandName?: string | null
  /** Representative MRP (minimum active variant MRP) in paisa. */
  mrp?: number | null
}
}
type VariantMrpRow = { productId: string; mrp: number | null }

/** Pick the lowest positive MRP across a product's active variants. */
function pickProductMrp(rows: VariantMrpRow[]): number | null {
  let min: number | null = null
  for (const row of rows) {
    if (row.mrp == null || row.mrp <= 0) continue
    if (min == null || row.mrp < min) min = row.mrp
  }
  return min
}

function buildMrpMap(rows: VariantMrpRow[]): Map<string, number | null> {
  const grouped = new Map<string, VariantMrpRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.productId)
    if (list) list.push(row)
    else grouped.set(row.productId, [row])
  }
  const map = new Map<string, number | null>()
  for (const [productId, list] of grouped) {
    map.set(productId, pickProductMrp(list))
  }
  return map
}

export async function getAllDealersQuery(): Promise<DealerDto[]> {
  const [dealerRows, itemRows, liquorList, foodList, orderItemRows] =
    await Promise.all([
      db.select().from(dealers).orderBy(desc(dealers.createdAt)),


export async function getAllDealersQuery(): Promise<DealerDto[]> {
  const [dealerRows, itemRows, liquorList, foodList, orderItemRows] =
    await Promise.all([
      db.select().from(dealers).orderBy(desc(dealers.createdAt)),
Thought · 5.7s
  return map  return map
}}

export async function getAllDealersQuery(): Promise<DealerDto[]> {export async function getAllDealersQuery(): Promise<DealerDto[]> {
  const [dealerRows, itemRows, liquorList, foodList, orderItemRows] =  const [
    await Promise.all([
      db.select().from(dealers).orderBy(desc(dealers.createdAt)),    dealerRows,
      db.select().from(dealerItems),    itemRows,
      db
        .select({    liquorList,
          id: liquorProducts.id,    foodList,
          name: liquorProducts.name,    orderItemRows,
          categoryName: liquorCategories.name,    liquorMrpRows,
          brandName: liquorBrands.name,    foodMrpRows,
  ] = await Promise.all([
        })    db.select().from(dealers).orderBy(desc(dealers.createdAt)),
        .from(liquorProducts)    db.select().from(dealerItems),
        .leftJoin(    db
          liquorCategories,      .select({
          eq(liquorProducts.categoryId, liquorCategories.id),        id: liquorProducts.id,
        )        name: liquorProducts.name,
        .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id)),
      db        categoryName: liquorCategories.name,
        .select({        brandName: liquorBrands.name,
          id: foodProducts.id,
          name: foodProducts.name,      })
          categoryName: foodCategories.name,      .from(liquorProducts)
      .leftJoin(
          brandName: foodBrands.name,        liquorCategories,
        })        eq(liquorProducts.categoryId, liquorCategories.id),
      )
        .from(foodProducts)      .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id)),
        .leftJoin(    db
          foodCategories,      .select({
          eq(foodProducts.categoryId, foodCategories.id),        id: foodProducts.id,
        )        name: foodProducts.name,
        .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id)),
      db        categoryName: foodCategories.name,
        .select({        brandName: foodBrands.name,
          dealerId: orderItems.dealerId,
          sourcingStatus: orderItems.sourcingStatus,      })
        })      .from(foodProducts)
      .leftJoin(
        .from(orderItems)        foodCategories,
        .where(isNotNull(orderItems.dealerId)),
        eq(foodProducts.categoryId, foodCategories.id),
    ])      )
      .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id)),
    db
      .select({
        dealerId: orderItems.dealerId,
        sourcingStatus: orderItems.sourcingStatus,
      })
      .from(orderItems)
      .where(isNotNull(orderItems.dealerId)),
    db
      .select({ productId: liquorVariants.productId, mrp: liquorVariants.mrp })
      .from(liquorVariants)
      .where(eq(liquorVariants.isActive, true)),
    db
      .select({ productId: foodVariants.productId, mrp: foodVariants.mrp })
      .from(foodVariants)
      .where(eq(foodVariants.isActive, true)),
  ])

  // Map product metadata lookup  // Map product metadata lookup
  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))
  const foodMap = new Map(foodList.map((p) => [p.id, p]))  const foodMap = new Map(foodList.map((p) => [p.id, p]))
  const liquorMrpMap = buildMrpMap(liquorMrpRows)
  const foodMrpMap = buildMrpMap(foodMrpRows)

  // Group items by dealerId  // Group items by dealerId
  const itemsByDealer = new Map<string, AssignedItemDto[]>()  const itemsByDealer = new Map<string, AssignedItemDto[]>()
  for (const item of itemRows) {  for (const item of itemRows) {
Thought · 3.6s
    const list = itemsByDealer.get(item.dealerId) || []    const list = itemsByDealer.get(item.dealerId) || []
    let productName = 'Unknown Product'    let productName = 'Unknown Product'
    let categoryName: string | null = null    let categoryName: string | null = null
    let brandName: string | null = null    let brandName: string | null = null
    let mrp: number | null = null

    if (item.catalogType === 'liquor') {    if (item.catalogType === 'liquor') {
      const p = liquorMap.get(item.productId)      const p = liquorMap.get(item.productId)
      if (p) {      if (p) {
        productName = p.name        productName = p.name
        categoryName = p.categoryName ?? null        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null        brandName = p.brandName ?? null
      }      }
      mrp = liquorMrpMap.get(item.productId) ?? null
    } else {
    } else {      const p = foodMap.get(item.productId)
      const p = foodMap.get(item.productId)      if (p) {
      if (p) {        productName = p.name
        productName = p.name        categoryName = p.categoryName ?? null
        categoryName = p.categoryName ?? null        brandName = p.brandName ?? null
        brandName = p.brandName ?? null      }
      }      mrp = foodMrpMap.get(item.productId) ?? null
    }
    }
    list.push({
    list.push({      id: item.id,
      id: item.id,
 @@ -211,8 +214,9 @@
      productName,      productName,
      categoryName,      categoryName,
      brandName,      brandName,
      costPrice: item.costPrice,      costPrice: item.costPrice,
      mrp,
      isAvailable: item.isAvailable !== false,      isAvailable: item.isAvailable !== false,
      effectiveFrom: item.effectiveFrom.toISOString(),      effectiveFrom: item.effectiveFrom.toISOString(),
    })    })
    itemsByDealer.set(item.dealerId, list)    itemsByDealer.set(item.dealerId, list)
You've used today's free messages. They reset at 5:56 AM · 11/28/2026.
Upgrade to OpenCode Go → /connect · Switch model → /models
Build · DeepSeek V4.1 Flash Free · 11m 23s
# bug mezmani

## RIDER APP
> Settlement

## RIDER WEBSITE
> Minimize the details on rides harek section
> on `/rider/deliveries` route delivered `failed` status shows `done`.
> rider profile page shows ledger (Read only)
> send notice to `rider` while settlement request sent to admin
> fix customer delivery time (admin panel and rider dashboard should show
delivery time selected by the customer)
> admin assigned rider -> Rider can `accept` or `decline` the request or order.
Send notification to admin panel.
> allow admin to assign multiple orders to rider but can rider only accept one
order at one time.
> show orders list in rider panel with ASC(time).
> countdown system on the list of orders (also track the delivery time from
order confirm to successful delivery).

## Dealer
> Cost price & MRP Price
> `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
admin is unable to save sourcing items cost price
> cost price should be shown in the account
`https://mezmani.com/admin/accounts?tab=dealer-ledger` with the const declared
in the `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
route
Thought · 10.3s
Continuing the dealer fixes. Now updating getDealerByIdQuery and the catalog query with MRP.
  id: string,  id: string,
  tx?: DbTx,  tx?: DbTx,
): Promise<DealerDto | null> {): Promise<DealerDto | null> {
  const client = tx ?? db  const client = tx ?? db
  const [dealerRows, itemRows, liquorList, foodList] = await Promise.all([  const [dealerRows, itemRows, liquorList, foodList, liquorMrpRows, foodMrpRows] =
    client.select().from(dealers).where(eq(dealers.id, id)).limit(1),    await Promise.all([
    client.select().from(dealerItems).where(eq(dealerItems.dealerId, id)),
    client      client.select().from(dealers).where(eq(dealers.id, id)).limit(1),
      client.select().from(dealerItems).where(eq(dealerItems.dealerId, id)),
      .select({      client
        id: liquorProducts.id,        .select({
        name: liquorProducts.name,          id: liquorProducts.id,
        categoryName: liquorCategories.name,          name: liquorProducts.name,
        brandName: liquorBrands.name,          categoryName: liquorCategories.name,
      })          brandName: liquorBrands.name,
      .from(liquorProducts)        })
      .leftJoin(        .from(liquorProducts)
        liquorCategories,        .leftJoin(
        eq(liquorProducts.categoryId, liquorCategories.id),          liquorCategories,
      )
          eq(liquorProducts.categoryId, liquorCategories.id),
      .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id)),        )
    client
        .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id)),
      .select({      client
        id: foodProducts.id,        .select({
        name: foodProducts.name,          id: foodProducts.id,
        categoryName: foodCategories.name,          name: foodProducts.name,
        brandName: foodBrands.name,          categoryName: foodCategories.name,
      })          brandName: foodBrands.name,
      .from(foodProducts)        })
      .leftJoin(        .from(foodProducts)
        foodCategories,        .leftJoin(
        eq(foodProducts.categoryId, foodCategories.id),          foodCategories,
      )
          eq(foodProducts.categoryId, foodCategories.id),
      .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id)),        )
  ])
        .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id)),
      client
        .select({
          productId: liquorVariants.productId,
          mrp: liquorVariants.mrp,
        })
        .from(liquorVariants)
        .where(eq(liquorVariants.isActive, true)),
      client
        .select({ productId: foodVariants.productId, mrp: foodVariants.mrp })
        .from(foodVariants)
        .where(eq(foodVariants.isActive, true)),
    ])

  if (!dealerRows[0]) return null
  if (!dealerRows[0]) return null  const d = dealerRows[0]
  const d = dealerRows[0]
  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))
  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))  const foodMap = new Map(foodList.map((p) => [p.id, p]))
  const foodMap = new Map(foodList.map((p) => [p.id, p]))  const liquorMrpMap = buildMrpMap(liquorMrpRows)
  const foodMrpMap = buildMrpMap(foodMrpRows)

  const assigned: AssignedItemDto[] = itemRows.map((item) => {
  const assigned: AssignedItemDto[] = itemRows.map((item) => {    let productName = 'Unknown Product'
    let productName = 'Unknown Product'    let categoryName: string | null = null
    let categoryName: string | null = null    let brandName: string | null = null
    let brandName: string | null = null    let mrp: number | null = null

    if (item.catalogType === 'liquor') {
    if (item.catalogType === 'liquor') {      const p = liquorMap.get(item.productId)
      const p = liquorMap.get(item.productId)      if (p) {
      if (p) {        productName = p.name
        productName = p.name        categoryName = p.categoryName ?? null
        categoryName = p.categoryName ?? null        brandName = p.brandName ?? null
        brandName = p.brandName ?? null      }
      }      mrp = liquorMrpMap.get(item.productId) ?? null
    } else {
      const p = foodMap.get(item.productId)
    } else {      if (p) {
      const p = foodMap.get(item.productId)        productName = p.name
      if (p) {        categoryName = p.categoryName ?? null
        productName = p.name        brandName = p.brandName ?? null
        categoryName = p.categoryName ?? null      }
        brandName = p.brandName ?? null      mrp = foodMrpMap.get(item.productId) ?? null
      }    }

    }    return {
      id: item.id,
    return {
      id: item.id,
 @@ -345,8 +362,9 @@
      productName,      productName,
      categoryName,      categoryName,
      brandName,      brandName,
      costPrice: item.costPrice,      costPrice: item.costPrice,
      mrp,
      isAvailable: item.isAvailable !== false,      isAvailable: item.isAvailable !== false,
      effectiveFrom: item.effectiveFrom.toISOString(),      effectiveFrom: item.effectiveFrom.toISOString(),
    }    }
  })  })
Thought · 6.1s
  return all.filter((d) => dealerIds.includes(d.id))  return all.filter((d) => dealerIds.includes(d.id))
}}

export async function getAdminDealersWithCatalogQuery() {export async function getAdminDealersWithCatalogQuery() {
  const [dealersList, liquorList, foodList] = await Promise.all([  const [dealersList, liquorList, foodList, liquorMrpRows, foodMrpRows] =
    getAllDealersQuery(),    await Promise.all([
    db      getAllDealersQuery(),
      .select({      db
        id: liquorProducts.id,        .select({
        name: liquorProducts.name,          id: liquorProducts.id,
        categoryName: liquorCategories.name,          name: liquorProducts.name,
        brandName: liquorBrands.name,          categoryName: liquorCategories.name,
      })          brandName: liquorBrands.name,
      .from(liquorProducts)        })
      .leftJoin(        .from(liquorProducts)
        liquorCategories,        .leftJoin(
        eq(liquorProducts.categoryId, liquorCategories.id),          liquorCategories,
      )
          eq(liquorProducts.categoryId, liquorCategories.id),
      .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))        )
      .where(eq(liquorProducts.isActive, true))
        .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))
      .orderBy(liquorProducts.name),        .where(eq(liquorProducts.isActive, true))
    db        .orderBy(liquorProducts.name),
      .select({      db
        id: foodProducts.id,        .select({
        name: foodProducts.name,          id: foodProducts.id,
        categoryName: foodCategories.name,          name: foodProducts.name,
        brandName: foodBrands.name,          categoryName: foodCategories.name,
      })          brandName: foodBrands.name,
      .from(foodProducts)        })
      .leftJoin(        .from(foodProducts)
        foodCategories,        .leftJoin(
        eq(foodProducts.categoryId, foodCategories.id),          foodCategories,
      )
          eq(foodProducts.categoryId, foodCategories.id),
      .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id))        )
      .where(eq(foodProducts.isActive, true))
        .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id))
      .orderBy(foodProducts.name),        .where(eq(foodProducts.isActive, true))
  ])        .orderBy(foodProducts.name),
      db
        .select({
          productId: liquorVariants.productId,
          mrp: liquorVariants.mrp,
        })
        .from(liquorVariants)
        .where(eq(liquorVariants.isActive, true)),
      db
        .select({ productId: foodVariants.productId, mrp: foodVariants.mrp })
        .from(foodVariants)
        .where(eq(foodVariants.isActive, true)),
    ])

  const liquorMrpMap = buildMrpMap(liquorMrpRows)
  const foodMrpMap = buildMrpMap(foodMrpRows)

  const catalogItems: CatalogItemSummary[] = [
  const catalogItems: CatalogItemSummary[] = [    ...liquorList.map((l) => ({
    ...liquorList.map((l) => ({      id: l.id,
      id: l.id,      catalogType: 'liquor' as const,
      catalogType: 'liquor' as const,      name: l.name,
      name: l.name,      categoryName: l.categoryName ?? null,
      categoryName: l.categoryName ?? null,      brandName: l.brandName ?? null,
      brandName: l.brandName ?? null,      mrp: liquorMrpMap.get(l.id) ?? null,
    })),
    })),    ...foodList.map((g) => ({
    ...foodList.map((g) => ({      id: g.id,
      id: g.id,      catalogType: 'food' as const,
      catalogType: 'food' as const,      name: g.name,
      name: g.name,      categoryName: g.categoryName ?? null,
      categoryName: g.categoryName ?? null,      brandName: g.brandName ?? null,
      brandName: g.brandName ?? null,      mrp: foodMrpMap.get(g.id) ?? null,
    })),
    })),  ]
  ]
  return {
  return {
Thought · 3.2s
Now the dealer form: dirty-state fix, MRP column, and add-item MRP display.
src/components/panels/dealers/dealer-form.tsx
  catalogType: 'liquor' | 'food'  catalogType: 'liquor' | 'food'
  categoryName?: string | null  categoryName?: string | null
  brandName?: string | null  brandName?: string | null
  costPriceNpr: number  costPriceNpr: number
  mrpPaisa?: number | null
  isAvailable: boolean  isAvailable: boolean
}}

export interface DealerFormProps {export interface DealerFormProps {
src/components/panels/dealers/dealer-form.tsx
  const catalogItems = dealersData.catalogItems  const catalogItems = dealersData.catalogItems

  // Items table state  // Items table state
  const [items, setItems] = useState<SourcingItemRow[]>([])  const [items, setItems] = useState<SourcingItemRow[]>([])
  const [itemsDirty, setItemsDirty] = useState(false)
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [itemSearchQuery, setItemSearchQuery] = useState('')  const [itemCatalogFilter, setItemCatalogFilter] = useState<
  const [itemCatalogFilter, setItemCatalogFilter] = useState<    'all' | 'liquor' | 'food'
    'all' | 'liquor' | 'food'
src/components/panels/dealers/dealer-form.tsx
          catalogType: ai.catalogType,          catalogType: ai.catalogType,
          categoryName: ai.categoryName,          categoryName: ai.categoryName,
          brandName: ai.brandName,          brandName: ai.brandName,
          costPriceNpr: ai.costPrice ? fromPaisa(ai.costPrice) : 0,          costPriceNpr: ai.costPrice ? fromPaisa(ai.costPrice) : 0,
          mrpPaisa: ai.mrp ?? null,
          isAvailable: ai.isAvailable !== false,          isAvailable: ai.isAvailable !== false,
        }),        }),
      )      )
      setItems(rows)      setItems(rows)
      setItemsDirty(false)
    } else {    } else {
      form.reset({      form.reset({
        name: '',        name: '',
        pan: '',        pan: '',
You've used today's free messages. They reset at 5:56 AM · 11/28/2026.
Upgrade to OpenCode Go → /connect · Switch model → /models
Build · DeepSeek V4.1 Flash Free · 48.8s
# bug mezmani

## RIDER APP
> Settlement

## RIDER WEBSITE
> Minimize the details on rides harek section
> on `/rider/deliveries` route delivered `failed` status shows `done`.
> rider profile page shows ledger (Read only)
> send notice to `rider` while settlement request sent to admin
> fix customer delivery time (admin panel and rider dashboard should show
delivery time selected by the customer)
> admin assigned rider -> Rider can `accept` or `decline` the request or order.
Send notification to admin panel.
> allow admin to assign multiple orders to rider but can rider only accept one
order at one time.
> show orders list in rider panel with ASC(time).
> countdown system on the list of orders (also track the delivery time from
order confirm to successful delivery).

## Dealer
> Cost price & MRP Price
> `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
admin is unable to save sourcing items cost price
> cost price should be shown in the account
`https://mezmani.com/admin/accounts?tab=dealer-ledger` with the const declared
in the `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
route
Thought · 2.4s
src/components/panels/dealers/dealer-form.tsx
        lng: null,        lng: null,
        isActive: true,        isActive: true,
      })      })
      setItems([])      setItems([])
      setItemsDirty(false)
    }    }
  }, [existingDealer, form])  }, [existingDealer, form])

  // Catalog item lookup to add  // Catalog item lookup to add
src/components/panels/dealers/dealer-form.tsx
      catalogType: catItem.catalogType,      catalogType: catItem.catalogType,
      categoryName: catItem.categoryName,      categoryName: catItem.categoryName,
      brandName: catItem.brandName,      brandName: catItem.brandName,
      costPriceNpr: 0,      costPriceNpr: 0,
      mrpPaisa: catItem.mrp ?? null,
      isAvailable: true,      isAvailable: true,
    }    }
    setItems((prev) => [...prev, newRow])    setItems((prev) => [...prev, newRow])
    form.setValue('name', form.getValues('name'), { shouldDirty: true })    setItemsDirty(true)
    toast.success(`Added ${catItem.name} to sourcing list`)
  }    toast.success(`Added ${catItem.name} to sourcing list`)
  }
  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))  const handleDeleteItem = (index: number) => {
    form.setValue('name', form.getValues('name'), { shouldDirty: true })    setItems((prev) => prev.filter((_, i) => i !== index))
  }    setItemsDirty(true)

  const onSubmit = async (values: UpsertDealerInput) => {  }
    try {
  const onSubmit = async (values: UpsertDealerInput) => {
    try {
Thought · 2.6s
src/components/panels/dealers/dealer-form.tsx
      )      )
      await queryClient.invalidateQueries({      await queryClient.invalidateQueries({
        queryKey: adminQueries.dealers().queryKey,        queryKey: adminQueries.dealers().queryKey,
      })      })
      setItemsDirty(false)

      if (!dealerId && res.id) {      if (!dealerId && res.id) {
        navigate({ to: '/admin/dealers/$id', params: { id: res.id } })        navigate({ to: '/admin/dealers/$id', params: { id: res.id } })
      }      }
Thought · 8.4s
src/components/panels/dealers/dealer-form.tsx
        </div>        </div>
      ),      ),
    },    },
    {    {
      id: 'mrp',
      header: 'MRP (NPR)',
      width: '110px',
      align: 'right',
      renderCell: (row) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {row.mrpPaisa != null && row.mrpPaisa > 0
            ? `Rs. ${fromPaisa(row.mrpPaisa).toLocaleString('en-IN')}`
            : '—'}
        </span>
      ),
    },
    {
      id: 'costPrice',
      header: 'Cost Price (NPR)',
      id: 'costPrice',      width: '160px',
      header: 'Cost Price (NPR)',      renderCell: (row, _index, updateField) => (
      width: '160px',
      renderCell: (row, _index, updateField) => (
 @@ -380,11 +393,8 @@
            value={row.costPriceNpr || ''}            value={row.costPriceNpr || ''}
            onChange={(e) => {            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0              const val = parseFloat(e.target.value) || 0
              updateField('costPriceNpr', val)              updateField('costPriceNpr', val)
              form.setValue('name', form.getValues('name'), {
                shouldDirty: true,
              })
            }}
            placeholder="0"            }}
            className="h-7 text-xs font-mono tabular-nums w-28"            placeholder="0"
          />            className="h-7 text-xs font-mono tabular-nums w-28"
          />
 @@ -401,11 +411,8 @@
          <Checkbox          <Checkbox
            checked={row.isAvailable}            checked={row.isAvailable}
            onCheckedChange={(checked) => {            onCheckedChange={(checked) => {
              updateField('isAvailable', !!checked)              updateField('isAvailable', !!checked)
              form.setValue('name', form.getValues('name'), {
                shouldDirty: true,
              })
            }}
            aria-label="Item availability toggle"            }}
          />            aria-label="Item availability toggle"
        </div>          />
        </div>
Thought · 1.1s
src/components/panels/dealers/dealer-form.tsx
            ? 'active'            ? 'active'
            : 'inactive'            : 'inactive'
          : undefined          : undefined
      }      }
      isDirty={form.formState.isDirty}      isDirty={form.formState.isDirty || itemsDirty}
      isSubmitting={form.formState.isSubmitting}
      isSubmitting={form.formState.isSubmitting}      onSave={form.handleSubmit(onSubmit)}
      onSave={form.handleSubmit(onSubmit)}      saveLabel={existingDealer ? 'Save Dealer' : 'Register Dealer'}
      saveLabel={existingDealer ? 'Save Dealer' : 'Register Dealer'}      onDelete={
      onDelete={
src/components/panels/dealers/dealer-form.tsx
                  const copy = [...prev]                  const copy = [...prev]
                  copy[idx] = updated                  copy[idx] = updated
                  return copy                  return copy
                })                })
                setItemsDirty(true)
              }}              }}
              onRowDelete={handleDeleteItem}              onRowDelete={handleDeleteItem}
              emptyMessage="No catalog items configured for this dealer hub yet. Click 'Add Item' to link products."              emptyMessage="No catalog items configured for this dealer hub yet. Click 'Add Item' to link products."
            />            />
Thought · 2.4s
src/components/panels/dealers/dealer-form.tsx
                      </div>                      </div>
                      <div className="text-xs text-muted-foreground">                      <div className="text-xs text-muted-foreground">
                        {p.catalogType.toUpperCase()} ·{' '}                        {p.catalogType.toUpperCase()} ·{' '}
                        {p.categoryName || 'General'}                        {p.categoryName || 'General'}
                        {p.mrp != null && p.mrp > 0 ? (
                          <span className="ml-1.5 font-mono text-[10px]">
                            · MRP Rs. {fromPaisa(p.mrp).toLocaleString('en-IN')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      </div>                      type="button"
                    </div>
                    <Button
                      type="button"
Thought · 2.4s
Explored: 2 searches, 1 read
Thought · 3.1s
Explored: 1 read
Thought · 3.6s
src/components/panels/accounts/tabs/dealer-report-tab.tsx
    enabled: !!selectedDealer,    enabled: !!selectedDealer,
    placeholderData: (previous) => previous,    placeholderData: (previous) => previous,
  })  })

  const { data: dealerDetail } = useQuery({
    ...adminQueries.dealer(selectedDealer?.dealerId ?? '__none__'),
    enabled: !!selectedDealer,
  })

  const totalProcured = filteredDealers.reduce(
  const totalProcured = filteredDealers.reduce(    (sum, dealer) => sum + dealer.totalProcured,
    (sum, dealer) => sum + dealer.totalProcured,    0,
    0,  )
  )
Thought · 8.0s
src/components/panels/accounts/tabs/dealer-report-tab.tsx
              />              />
            </div>            </div>
          </div>          </div>

          {dealerDetail && dealerDetail.assignedItems.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    Catalog Sourcing — Cost &amp; MRP
                  </span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {dealerDetail.assignedItems.length} item
                    {dealerDetail.assignedItems.length === 1 ? '' : 's'} ·
                    negotiated dealer cost vs. catalog MRP
                  </span>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto click-scroll">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Catalog Item
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        Cost Price
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        MRP
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dealerDetail.assignedItems.map((item) => {
                      const cost = item.costPrice ?? 0
                      const mrp = item.mrp ?? null
                      const margin = mrp != null && mrp > 0 ? mrp - cost : null
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-1.5">
                            <span className="block font-medium text-foreground">
                              {item.productName}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {item.catalogType.toUpperCase()} ·{' '}
                              {item.categoryName || 'General'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {cost > 0 ? (
                              <MoneyText
                                paisa={cost}
                                className="text-xs font-semibold"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {mrp != null && mrp > 0 ? (
                              <MoneyText
                                paisa={mrp}
                                className="text-xs text-muted-foreground"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {margin != null ? (
                              <MoneyText
                                paisa={margin}
                                className={`text-xs font-semibold ${
                                  margin >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DataTable
            columns={statementColumns}
            data={filteredStatementRows}
            searchValue={statementSearch}


































          <DataTable
            columns={statementColumns}
            data={filteredStatementRows}
            searchValue={statementSearch}
You've used today's free messages. They reset at 5:56 AM · 11/28/2026.
Upgrade to OpenCode Go → /connect · Switch model → /models
Build · DeepSeek V4.1 Flash Free · 1m 17s
# bug mezmani

## RIDER APP
> Settlement

## RIDER WEBSITE
> Minimize the details on rides harek section
> on `/rider/deliveries` route delivered `failed` status shows `done`.
> rider profile page shows ledger (Read only)
> send notice to `rider` while settlement request sent to admin
> fix customer delivery time (admin panel and rider dashboard should show
delivery time selected by the customer)
> admin assigned rider -> Rider can `accept` or `decline` the request or order.
Send notification to admin panel.
> allow admin to assign multiple orders to rider but can rider only accept one
order at one time.
> show orders list in rider panel with ASC(time).
> countdown system on the list of orders (also track the delivery time from
order confirm to successful delivery).

## Dealer
> Cost price & MRP Price
> `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
admin is unable to save sourcing items cost price
> cost price should be shown in the account
`https://mezmani.com/admin/accounts?tab=dealer-ledger` with the const declared
in the `https://mezmani.com/admin/dealers/9a3fbf8e-6bcd-4bf5-a425-4c4dbceeca91`
route
You've used today's free messages. They reset at 5:56 AM · 11/28/2026.
Upgrade to OpenCode Go → /connect · Switch model → /models
Build · DeepSeek V4.1 Flash Free · 952ms
