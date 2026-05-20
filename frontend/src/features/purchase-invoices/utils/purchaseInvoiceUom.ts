/**
 * Mirror of backend purchase-invoice-uom.util — invoice qty in pricelist UOM (e.g. KG).
 */

import { normalizeUomName } from "@/lib/uomNormalize"

export type ProductUomConversion = {
  unit_name: string
  conversion_factor: number
}

export { normalizeUomName }

/** Pricelist row must be from batch-lookup (active product_uoms only). CF = base units per 1 billing UOM. */
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

function findUomConversionFactor(
  uoms: ProductUomConversion[],
  unitName: string,
): number | null {
  const key = normalizeUomName(unitName)
  const found = uoms.find((u) => normalizeUomName(u.unit_name) === key)
  if (!found || Number(found.conversion_factor) <= 0) return null
  return Number(found.conversion_factor)
}

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
  return pricelistUomName?.trim() || uomPo?.trim() || uomReceived?.trim() || ""
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

/** Correct legacy rows where qty_invoiced was saved as raw GR qty (Gram) not invoice UOM (KG) */
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

export function buildProductUomsMap(
  rows: Array<{ product_id: string; unit_name: string; conversion_factor: number }>,
): Record<string, ProductUomConversion[]> {
  const map: Record<string, ProductUomConversion[]> = {}
  for (const row of rows) {
    if (!map[row.product_id]) map[row.product_id] = []
    map[row.product_id].push({
      unit_name: row.unit_name,
      conversion_factor: Number(row.conversion_factor),
    })
  }
  return map
}
