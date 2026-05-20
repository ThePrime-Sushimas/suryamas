/**
 * Purchase invoice qty/UOM — align with pricelist UOM (e.g. Kilogram), not stock UOM (e.g. Gram).
 * conversion_factor = base units per 1 unit of that UOM (see CODING_PATTERNS).
 */

export type ProductUomConversion = {
  unit_name: string
  conversion_factor: number
}

export function normalizeUomName(name: string): string {
  return name.trim().toLowerCase()
}

export function findUomConversionFactor(
  uoms: ProductUomConversion[],
  unitName: string,
): number | null {
  const key = normalizeUomName(unitName)
  const found = uoms.find((u) => normalizeUomName(u.unit_name) === key)
  if (!found || Number(found.conversion_factor) <= 0) return null
  return Number(found.conversion_factor)
}

/** qty in target UOM = qty in source × (cf_source / cf_target) */
export function convertQtyBetweenUoms(
  qty: number,
  fromUnitName: string,
  toUnitName: string,
  uoms: ProductUomConversion[],
): number {
  if (!qty || normalizeUomName(fromUnitName) === normalizeUomName(toUnitName)) return qty
  const cfFrom = findUomConversionFactor(uoms, fromUnitName)
  const cfTo = findUomConversionFactor(uoms, toUnitName)
  if (cfFrom == null || cfTo == null) return qty
  return qty * (cfFrom / cfTo)
}

export function resolveInvoiceUom(
  pricelistUomName: string | null | undefined,
  uomPo: string,
  uomReceived: string,
): string {
  return pricelistUomName?.trim() || uomPo?.trim() || uomReceived?.trim() || ''
}

export function defaultQtyInvoicedInInvoiceUom(input: {
  qty_received: number
  uom_received: string
  qty_po_uom: number
  uom_po: string
  uom_invoice: string
  product_uoms: ProductUomConversion[]
}): number {
  const { qty_received, uom_received, qty_po_uom, uom_po, uom_invoice, product_uoms } = input
  if (normalizeUomName(uom_invoice) === normalizeUomName(uom_received)) {
    return qty_received
  }
  if (normalizeUomName(uom_invoice) === normalizeUomName(uom_po)) {
    return qty_po_uom
  }
  return convertQtyBetweenUoms(qty_received, uom_received, uom_invoice, product_uoms)
}

export function qtyReceivedInInvoiceUom(input: {
  qty_received: number
  uom_received: string
  uom_invoice: string
  product_uoms: ProductUomConversion[]
}): number {
  return convertQtyBetweenUoms(
    input.qty_received,
    input.uom_received,
    input.uom_invoice,
    input.product_uoms,
  )
}

/** Legacy rows saved as qty_invoiced = raw qty_received (Gram) while price is per KG */
export function normalizeQtyInvoicedForDisplay(input: {
  qty_invoiced: number
  qty_received: number
  uom_received: string
  uom_invoice: string
  product_uoms: ProductUomConversion[]
}): number {
  const { qty_invoiced, qty_received, uom_received, uom_invoice, product_uoms } = input
  if (normalizeUomName(uom_received) === normalizeUomName(uom_invoice)) {
    return qty_invoiced
  }
  const receivedInInvoiceUom = qtyReceivedInInvoiceUom({
    qty_received,
    uom_received,
    uom_invoice,
    product_uoms,
  })
  if (Math.abs(qty_invoiced - qty_received) < 0.0001) {
    return receivedInInvoiceUom
  }
  return qty_invoiced
}
