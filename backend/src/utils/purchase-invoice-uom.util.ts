/**
 * Purchase invoice qty/UOM — align with pricelist UOM (e.g. Kilogram), not stock UOM (e.g. Gram).
 * conversion_factor = base units per 1 unit of that UOM (see CODING_PATTERNS).
 */

export type ProductUomConversion = {
  unit_name: string
  conversion_factor: number
}

const UOM_ALIASES: Record<string, string> = {
  kg: 'kilogram',
  kilo: 'kilogram',
  kilogram: 'kilogram',
  g: 'gram',
  gr: 'gram',
  gram: 'gram',
}

export function normalizeUomName(name: string): string {
  const key = name.trim().toLowerCase()
  return UOM_ALIASES[key] ?? key
}

/**
 * Append pricelist billing UOM when missing from active product_uoms batch.
 * Caller must pass pricelist from batchLookupBySupplier (active product_uoms only).
 * conversion_factor = base units per 1 unit of that UOM (relative to product base, e.g. Gram).
 */
export function mergePricelistUomForConversion(
  uoms: ProductUomConversion[],
  pricelist: { uom_name: string; conversion_factor: number } | undefined,
): ProductUomConversion[] {
  if (!pricelist?.uom_name?.trim()) return uoms
  const key = normalizeUomName(pricelist.uom_name)
  if (uoms.some((u) => normalizeUomName(u.unit_name) === key)) return uoms
  const cf = Number(pricelist.conversion_factor)
  if (!(cf > 0)) return uoms
  return [...uoms, { unit_name: pricelist.uom_name.trim(), conversion_factor: cf }]
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
