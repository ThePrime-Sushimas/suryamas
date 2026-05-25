/**
 * Mirror backend computeGrLineInvoiceTotal — preview total invoice di form GR.
 */

const UOM_ALIASES: Record<string, string> = {
  kg: 'kilogram',
  kilo: 'kilogram',
  kilogram: 'kilogram',
  g: 'gram',
  gr: 'gram',
  gram: 'gram',
}

function normalizeUom(name: string): string {
  const key = name.trim().toLowerCase()
  return UOM_ALIASES[key] ?? key
}

export type ProductUomForInvoice = {
  unit_name: string
  conversion_factor: number
}

export type GrLineInvoiceFields = {
  qty_po_uom: number
  qty_received: number
  uom_po: string
  uom_received: string
  unit_price_invoice: number
  qty_rejected?: number
}

function findUom(uoms: ProductUomForInvoice[], unitName: string): ProductUomForInvoice | undefined {
  const key = normalizeUom(unitName)
  return uoms.find((u) => normalizeUom(u.unit_name) === key)
}

function toBaseQty(qty: number, uomName: string, uoms: ProductUomForInvoice[]): number {
  const match = findUom(uoms, uomName)
  if (!match) return qty
  return qty * match.conversion_factor
}

function kgFactor(uoms: ProductUomForInvoice[]): number | null {
  const kg = findUom(uoms, 'kilogram')
  const cf = kg ? Number(kg.conversion_factor) : 0
  return cf > 0 ? cf : null
}

export function computeGrLineInvoiceTotal(
  line: GrLineInvoiceFields,
  productUoms: ProductUomForInvoice[],
): number {
  const qtyAccepted = Number(line.qty_po_uom) - (line.qty_rejected ?? 0)
  const unitPrice = Number(line.unit_price_invoice) || 0
  if (qtyAccepted <= 0 || unitPrice <= 0) return 0

  if (normalizeUom(line.uom_po) === normalizeUom(line.uom_received)) {
    return qtyAccepted * unitPrice
  }

  const kg = kgFactor(productUoms)
  if (!kg) return qtyAccepted * unitPrice

  const receivedBase = toBaseQty(Number(line.qty_received), line.uom_received, productUoms)
  if (receivedBase <= 0) return qtyAccepted * unitPrice

  return (receivedBase / kg) * unitPrice
}

/** Label satuan harga invoice di form (dual UOM → biasanya per KG dari pricelist). */
export function invoiceUnitPriceLabel(
  line: Pick<GrLineInvoiceFields, 'uom_po' | 'uom_received'>,
  pricelistUom?: string | null,
): string {
  if (normalizeUom(line.uom_po) !== normalizeUom(line.uom_received)) {
    return pricelistUom?.trim() || 'Kilogram'
  }
  return line.uom_po
}
