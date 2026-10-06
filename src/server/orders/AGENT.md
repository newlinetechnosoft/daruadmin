# src/server/orders — orders, assignment, rider actions, status machine

**Read when:** checkout/place order, order lists, confirming/cancelling, assigning dealer or rider, rider delivery actions, order notifications.
**Conventions:** `src/server/AGENT.md` · **State machine code:** `#/lib/order-status.ts` (`src/lib/AGENT.md`) · **Ledger effects:** `finance/AGENT.md` · **Stock effects:** `inventory/AGENT.md`.

## Business flow
1. Customer `placeOrder` (COD). 2. Manager gets notification, `confirmOrder`. 3. Manager `suggestDealers` (nearest by haversine **with stock**) → `assignDealer`. 4. Manager `assignRider` (manual) → rider notified. 5. Rider `markPickedUp` → `markOutForDelivery` → `markDelivered` (cash collected). 6. Rider hands cash to manager (finance) · manager settles dealer (finance).

## State machine (defined once in `#/lib/order-status.ts`; never set `status` directly)
```
pending → confirmed → dealer_assigned → rider_assigned → picked_up → out_for_delivery → delivered
   └──────────────┴───────────┴──────────────┘ → cancelled   (only before picked_up)
out_for_delivery → delivery_failed → returned | out_for_delivery (reschedule)
```
Each transition: checks actor role + ownership, writes `order_status_history` (actor, from, to, note, time), and applies side effects **in the same `dbTx` transaction** (stock, ledger, notifications).

## placeOrder (single transaction, idempotent)
Input: items `[{catalogType, variantId, qty}]`, address id/snapshot + lat/lng, 18+ confirmation, idempotency key. Steps: auth customer → load variants from DB (**ignore client prices**) → check availability → compute subtotal, VAT (`#/lib/tax`), delivery fee (from settings), total → insert order + items (snapshots) + history → `notify` managers. Return order number.

## Delivery rules
- Rider sees/acts only on orders where `riderId = me`.
- `markDelivered`: records `cashCollected` (must equal total for COD, otherwise require note), `ageVerifiedAtDelivery` (required for liquor orders), creates `cash_collections` row, triggers ledger posting + stock finalization.
- `markDeliveryFailed`: reason required; stock returned or kept per manager decision.
- Customers can cancel only before `picked_up`.

## Functions
| Function | Roles | Purpose | Status |
|---|---|---|---|
| `placeOrder` | customer | Validate, re-price, create order | ⬜ |
| `listMyOrders`, `getMyOrder`, `cancelMyOrder` | customer | Own orders | ⬜ |
| `listOrders`, `getOrder` | admin, manager | Filtered/paginated list, detail with history | ⬜ |
| `confirmOrder`, `cancelOrder` | admin, manager | Transitions | ⬜ |
| `suggestDealers(orderId)` | admin, manager | Distance-sorted dealers with stock check | ⬜ |
| `assignDealer`, `assignRider` | admin, manager | Assign (reserves stock) + notify rider | ⬜ |
| `listMyAssignedOrders`, `getMyAssignedOrder` | rider | Own assigned orders | ⬜ |
| `markPickedUp`, `markOutForDelivery`, `markDelivered`, `markDeliveryFailed` | rider | Delivery status | ⬜ |

## Assumptions to confirm
- Delivery fee: flat, configurable (default). Service-area limits unspecified.
- Auto-assignment is out of scope (manual only).

## Status: ⬜ not started
