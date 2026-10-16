/**
 * Nepal Tax & VAT Calculation Utilities.
 * In Nepal, retail prices for consumer goods (especially liquor & FMCG) are VAT-inclusive (13%).
 * All calculations work in integer paisa.
 */

export const DEFAULT_NEPAL_VAT_RATE = 13 // 13%

/**
 * Extracts the 13% VAT component from a VAT-inclusive gross amount.
 * Formula: vatAmount = Math.round(grossPaisa * (vatRate / (100 + vatRate)))
 * e.g., For Rs 113 (11300 paisa), VAT = 1300 paisa (Rs 13), Net = 10000 paisa (Rs 100).
 */
export function vatFromInclusive(
  grossPaisa: number,
  vatRate: number = DEFAULT_NEPAL_VAT_RATE,
): number {
  if (grossPaisa <= 0 || vatRate <= 0) return 0
  return Math.round((grossPaisa * vatRate) / (100 + vatRate))
}

/**
 * Extracts the taxable net amount before VAT from a VAT-inclusive gross amount.
 */
export function netFromInclusive(
  grossPaisa: number,
  vatRate: number = DEFAULT_NEPAL_VAT_RATE,
): number {
  if (grossPaisa <= 0) return 0
  return grossPaisa - vatFromInclusive(grossPaisa, vatRate)
}

/**
 * Computes full tax breakdown for an invoice or order line.
 */
export function calculateTaxBreakdown(
  grossPaisa: number,
  vatRate: number = DEFAULT_NEPAL_VAT_RATE,
) {
  const vatAmount = vatFromInclusive(grossPaisa, vatRate)
  const netAmount = grossPaisa - vatAmount
  return {
    grossPaisa,
    netPaisa: netAmount,
    vatPaisa: vatAmount,
    vatRate,
  }
}
