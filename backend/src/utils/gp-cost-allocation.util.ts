import type { ProductUomsMap } from './product-uom.util'
import { normalizeUomName } from './purchase-invoice-uom.util'
import { toBaseQty } from './product-uom.util'

export type GrLineCostBasis = {
  product_id: string
  qty_po_uom: number
  qty_received: number
  uom_po: string
  uom_received: string
  qty_rejected?: number
}

/**
 * GR/PI amount is often qty_po × unit_price (PO/commercial UOM) while stock uses qty_received
 * (e.g. Gram). Convert both sides to product base unit before scaling — never divide gram by
 * raw "7" kg or "2" ekor counts (that inflates cost ×1000).
 */
export function scaleDualUomCostFromPoQtyBasis(
  amount: number,
  basis: GrLineCostBasis,
  uomsMap: ProductUomsMap,
): number {
  if (amount <= 0) return 0
  if (normalizeUomName(basis.uom_po) === normalizeUomName(basis.uom_received)) {
    return amount
  }
  const qtyAcceptedPo = Number(basis.qty_po_uom) - (basis.qty_rejected ?? 0)
  if (qtyAcceptedPo <= 0) return amount

  const label = basis.product_id
  const poBaseQty = toBaseQty(basis.product_id, basis.uom_po, qtyAcceptedPo, uomsMap, {
    onMissing: 'throw',
    productLabel: label,
  })
  const receivedBase = toBaseQty(basis.product_id, basis.uom_received, Number(basis.qty_received), uomsMap, {
    onMissing: 'throw',
    productLabel: label,
  })
  if (poBaseQty <= 0 || receivedBase <= 0) return amount
  if (Math.abs(poBaseQty - receivedBase) < 0.0001) return amount
  return amount * (receivedBase / poBaseQty)
}

export type GrLineInvoiceQty = GrLineCostBasis & {
  unit_price_invoice: number
}

export type GrLineInputCost = GrLineInvoiceQty & {
  total_price_invoice: number
}

function kgConversionFactor(productId: string, uomsMap: ProductUomsMap): number | null {
  const uoms = uomsMap.get(productId)
  if (!uoms?.length) return null
  const kg = uoms.find((u) => normalizeUomName(u.unit_name) === 'kilogram')
  const cf = kg ? Number(kg.conversion_factor) : 0
  return cf > 0 ? cf : null
}

/**
 * Total nilai invoice baris GR — dipakai saat simpan GR, GP confirm, dan PI post.
 * Dual UOM (mis. beli Ekor, timbang Gram): `unit_price_invoice` = harga per KG (pricelist/supplier),
 * bukan qty_po × harga.
 */
export function computeGrLineInvoiceTotal(
  line: GrLineInvoiceQty,
  uomsMap: ProductUomsMap,
): number {
  const qtyAccepted = Number(line.qty_po_uom) - (line.qty_rejected ?? 0)
  const unitPrice = Number(line.unit_price_invoice) || 0
  if (qtyAccepted <= 0 || unitPrice <= 0) return 0

  if (normalizeUomName(line.uom_po) === normalizeUomName(line.uom_received)) {
    return qtyAccepted * unitPrice
  }

  const kgFactor = kgConversionFactor(line.product_id, uomsMap)
  if (!kgFactor) return qtyAccepted * unitPrice

  const receivedBase = toBaseQty(
    line.product_id,
    line.uom_received,
    Number(line.qty_received),
    uomsMap,
    { onMissing: 'throw', productLabel: line.product_id },
  )
  if (receivedBase <= 0) return qtyAccepted * unitPrice

  // Dual UOM: harga invoice = per KG (pricelist/supplier), bukan qty PO × harga
  return (receivedBase / kgFactor) * unitPrice
}

/** Modal input GP/PI — hitung ulang dari field GR (abaikan total tersimpan jika salah). */
export function resolveGpInputCostFromGrLine(
  gr: GrLineInputCost,
  uomsMap: ProductUomsMap,
): number {
  return computeGrLineInvoiceTotal(gr, uomsMap)
}

export type BearsCostMap = Map<string, boolean>

export function buildBearsCostMap(
  templates: Array<{ output_product_id: string; bears_cost: boolean }>,
): BearsCostMap {
  const map = new Map<string, boolean>()
  for (const t of templates) {
    map.set(t.output_product_id, t.bears_cost)
  }
  return map
}

/**
 * - No output template on input product → all outputs bear cost (pass-through).
 * - Template exists → only rows listed with bears_cost=true bear cost; unknown outputs default false.
 */
export function outputBearsCost(bearsCostMap: BearsCostMap, outputProductId: string): boolean {
  if (bearsCostMap.size === 0) return true
  return bearsCostMap.get(outputProductId) ?? false
}

export type OutputQtyForCost = {
  product_id: string
  qty_output: number
  uom: string
  actual_qty: number | null
  actual_uom: string | null
}

/** Base qty for cost pool — mirrors goods-processing.repository confirm paths. */
export function outputBaseQtyForCost(
  out: OutputQtyForCost,
  uomsMap: ProductUomsMap,
  options?: { onMissing?: 'warn' | 'throw'; productLabel?: string },
): number {
  const qty = out.actual_qty != null ? Number(out.actual_qty) : Number(out.qty_output)
  const uom = out.actual_uom != null ? out.actual_uom : out.uom
  return toBaseQty(out.product_id, uom, qty, uomsMap, options)
}

export type AllocatedGpOutputCost<T extends OutputQtyForCost> = {
  output: T
  baseQty: number
  allocatedCost: number
  /** Cost per product base unit (matches stock_movements.qty in base UOM). */
  unitCost: number
}

/**
 * Spread invoice line subtotal across GP outputs that bear cost, by base qty.
 * Non-bearing outputs get zero cost. Last cost-bearing row absorbs rounding remainder.
 */
export function allocateLineCostToGpOutputs<T extends OutputQtyForCost & { output_sort_order?: number }>(
  lineSubtotal: number,
  outputs: T[],
  bearsCostMap: BearsCostMap,
  uomsMap: ProductUomsMap,
): AllocatedGpOutputCost<T>[] {
  const sorted = [...outputs].sort(
    (a, b) => Number(a.output_sort_order ?? 0) - Number(b.output_sort_order ?? 0),
  )

  const entries = sorted.map((out) => {
    const bearsCost = outputBearsCost(bearsCostMap, out.product_id)
    const baseQty = bearsCost
      ? outputBaseQtyForCost(out, uomsMap, { onMissing: 'throw', productLabel: out.product_id })
      : 0
    return { out, bearsCost, baseQty }
  })

  const costBearing = entries.filter((e) => e.bearsCost && e.baseQty > 0)
  const totalBase = costBearing.reduce((s, e) => s + e.baseQty, 0)

  const costByRef = new Map<T, { allocatedCost: number; unitCost: number }>()
  let allocated = 0

  for (let i = 0; i < costBearing.length; i++) {
    const e = costBearing[i]
    let allocatedCost = 0
    if (totalBase > 0) {
      if (i === costBearing.length - 1) {
        allocatedCost = lineSubtotal - allocated
      } else {
        allocatedCost = Math.round(lineSubtotal * (e.baseQty / totalBase))
        allocated += allocatedCost
      }
    }
    const unitCost = e.baseQty > 0 ? allocatedCost / e.baseQty : 0
    costByRef.set(e.out, { allocatedCost, unitCost })
  }

  for (const e of entries) {
    if (!e.bearsCost) {
      costByRef.set(e.out, { allocatedCost: 0, unitCost: 0 })
    }
  }

  return sorted.map((out) => {
    const c = costByRef.get(out)!
    const bearsCost = outputBearsCost(bearsCostMap, out.product_id)
    const baseQty = bearsCost ? outputBaseQtyForCost(out, uomsMap, { onMissing: 'throw' }) : 0
    return {
      output: out,
      baseQty,
      allocatedCost: c.allocatedCost,
      unitCost: c.unitCost,
    }
  })
}
