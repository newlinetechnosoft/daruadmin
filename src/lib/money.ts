/**
 * Money helpers for Nepal Rupee (NPR) represented as integer paisa (1 NPR = 100 paisa).
 * Always store and calculate in paisa to avoid floating-point issues.
 */

export function toPaisa(rupees: number): number {
  return Math.round(rupees * 100)
}

export function fromPaisa(paisa: number): number {
  return paisa / 100
}

export const toRupees = fromPaisa

const nprFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'NPR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatNPR(paisa: number): string {
  const rupees = fromPaisa(paisa)
  // Format with Rs. symbol and Indian number grouping (lakhs, crores)
  const formatted = nprFormatter.format(rupees).replace(/NPR\s?/, 'Rs. ')
  return formatted
}
