/** Compact Rp axis labels for recharts (jt / rb). */
export function formatChartAxisRp(value: number | string): string {
  const n = Number(value)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}
