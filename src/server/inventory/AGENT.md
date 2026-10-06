# src/server/inventory — dealers, dealer stock, stock movements

**Read when:** dealers, per-dealer stock, stock adjustments, low-stock alerts, stock reports.
**Conventions:** `src/server/AGENT.md` · **Tables:** `src/db/AGENT.md`.

## Model (assumption — confirm with owner)
- There is **no warehouse**. Stock lives **per dealer** in `dealer_stock` (`catalogType`, `variantId`, `qty`, `costPrice`). Company stock = sum over dealers.
- Dealers: name, contact, PAN, address, `lat`, `lng`, `isActive`. Manager picks a dealer **near the order location with stock**.
- `stock_movements` is **append-only**: `catalogType`, `variantId`, `dealerId`, `delta`, `type` (`purchase | sale | adjustment | return | wastage`), `refType/refId`, `createdBy`. `dealer_stock.qty` is a cached sum updated in the same transaction.
- **Reserve** on dealer assignment, **finalize** on delivery, **release** on cancel/failed. Prevent overselling with conditional updates (`WHERE qty >= :n`) or `SELECT … FOR UPDATE` inside `dbTx`.
- Distance: haversine in `#/lib/geo` (PostGIS not needed at this scale).

## Functions
| Function | Roles | Purpose | Status |
|---|---|---|---|
| `listDealers`, `getDealer` | admin, manager | Read (manager sees limited fields) | ⬜ |
| `upsertDealer`, `setDealerActive` | admin | CRUD / activate-deactivate | ⬜ |
| `adjustStock` | admin, manager | Manual adjustment with reason | ⬜ |
| `setDealerStock` / `receiveStock` | admin, manager | Record purchase/restock | ⬜ |
| `listStockMovements`, `getStockOverview`, `lowStockAlerts` | admin, manager | Tracking + alerts | ⬜ |
| internal: `reserveStock`, `releaseStock`, `finalizeStock` | (called by orders) | Transactional helpers, not exposed | ⬜ |

## Assumptions to confirm
- Stock per dealer vs company-owned bulk stock.
- Low-stock threshold per variant (default configurable).

## Status: ⬜ not started
