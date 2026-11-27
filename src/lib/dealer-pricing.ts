/**
 * Shared dealer sourcing pricing constants and helpers used by both the
 * dealer configuration form and the accounts dealer-ledger tab.
 */
export const DEALER_COST_PRICE_LABEL = 'Cost Price'

/**
 * Computes dealer margin in paisa (MRP minus negotiated cost price).
 * Returns null when MRP is missing or non-positive.
 */
export function computeDealerMarginPaisa(
  mrpPaisa?: number | null,
  costPricePaisa?: number | null,
): number | null {
  if (mrpPaisa == null || mrpPaisa <= 0) return null
  return mrpPaisa - (costPricePaisa ?? 0)
}
