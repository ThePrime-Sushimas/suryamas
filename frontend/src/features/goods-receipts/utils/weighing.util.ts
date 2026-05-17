/** Line uses operational / stock UOM (hasil timbang) distinct from PO purchase UOM. */
export function lineHasWeighing(line: {
  uom_po?: string | null
  uom_received?: string | null
  uom?: string | null
  conversion_factor?: number | null
}): boolean {
  const uomPo = (line.uom_po ?? line.uom ?? '').trim()
  const uomRec = (line.uom_received ?? line.uom ?? '').trim()
  if (uomPo && uomRec && uomPo !== uomRec) return true
  const cf = Number(line.conversion_factor ?? 1)
  return Math.abs(cf - 1) > 0.0001
}

export function formatWeighingQty(qty: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(qty)
}
