/**
 * GR dual-UOM → purchase invoice operational pricing.
 * Uses actual GR conversion (qty_received / qty_po_uom), not product_uoms master.
 *
 * @see .amazonq/docs/GR_UOM_CONVERSION_DESIGN.md — Purchase Invoice section
 */

export type GrLinePricingInput = {
  qty_received: number
  qty_po_uom?: number | null
  unit_price_invoice?: number | null
  unit_price_po?: number | null
}

export type GrLinePricingContext = GrLinePricingInput & {
  conversion_factor?: number | null
}

/** Unit price per uom_received — (qty_po_uom × price per uom_po) / qty_received. */
export function deriveInvoiceUnitPricePerReceivedUom(line: GrLinePricingInput): number {
  const qtyReceived = Number(line.qty_received)
  const qtyPoUom = Number(line.qty_po_uom ?? line.qty_received)
  const pricePerPoUom = Number(line.unit_price_invoice ?? line.unit_price_po ?? 0)
  if (qtyReceived <= 0 || pricePerPoUom <= 0) return 0
  return (qtyPoUom * pricePerPoUom) / qtyReceived
}

/** PO contract price per uom_received (excludes GR invoice override). */
export function derivePoUnitPricePerReceivedUom(
  line: Pick<GrLinePricingInput, 'qty_received' | 'qty_po_uom' | 'unit_price_po'>,
): number {
  return deriveInvoiceUnitPricePerReceivedUom({
    ...line,
    unit_price_invoice: null,
  })
}

/** PO qty for this receipt in operational UOM; falls back when conversion_factor is null. */
export function derivePoQtyInReceivedUom(line: {
  qty_received: number
  qty_po_uom?: number | null
  conversion_factor?: number | null
}): number {
  const qtyReceived = Number(line.qty_received)
  const qtyPoUom = Number(line.qty_po_uom ?? qtyReceived)
  const factor = Number(line.conversion_factor ?? (qtyPoUom > 0 ? qtyReceived / qtyPoUom : 1))
  if (qtyPoUom <= 0) return qtyReceived
  return qtyPoUom * factor
}

export function enrichGrLineInvoicePricing(line: GrLinePricingContext) {
  return {
    unit_price_po_operational: derivePoUnitPricePerReceivedUom(line),
    unit_price_invoice_operational: deriveInvoiceUnitPricePerReceivedUom(line),
    qty_po_operational: derivePoQtyInReceivedUom(line),
  }
}
