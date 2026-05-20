export function calcChangePct(oldPrice: number | null, newPrice: number): number | null {
  if (oldPrice === null || oldPrice === 0) return null
  return Math.round(((newPrice - oldPrice) / oldPrice) * 100 * 100) / 100
}

export function calcChangeAmount(oldPrice: number | null, newPrice: number): number | null {
  if (oldPrice === null) return null
  return Math.round((newPrice - oldPrice) * 10000) / 10000
}

export function pricesNearlyEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance
}

/** Prior price points embedded per change row for mini sparklines (design: ~7–30). */
export const SPARKLINE_HISTORY_POINTS = 12
