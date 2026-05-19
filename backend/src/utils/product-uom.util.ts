import { BusinessRuleError } from './errors.base'

export type ProductUomEntry = {
  unit_name: string
  conversion_factor: number
  is_base_unit: boolean
}

export type ProductUomsMap = Map<string, ProductUomEntry[]>

export type ProductUomBatchRow = {
  product_id: string
  unit_name: string
  conversion_factor: number
  is_base_unit: boolean
}

/**
 * conversion_factor = berapa base unit dalam 1 unit ini (bukan sebaliknya).
 * @see .amazonq/rules/memory-bank/CODING_PATTERNS.md — UOM & Cost Calculation Contract
 */
export function buildProductUomsMap(rows: ProductUomBatchRow[]): ProductUomsMap {
  const map: ProductUomsMap = new Map()
  for (const row of rows) {
    if (!map.has(row.product_id)) map.set(row.product_id, [])
    map.get(row.product_id)!.push({
      unit_name: row.unit_name,
      conversion_factor: row.conversion_factor,
      is_base_unit: row.is_base_unit,
    })
  }
  return map
}

export function resolveBaseUom(uoms: ProductUomEntry[], fallbackUom: string): string {
  return uoms.find((u) => u.is_base_unit)?.unit_name ?? fallbackUom
}

type ToBaseQtyOptions = {
  /** 'warn' = log + raw qty; 'throw' = BusinessRuleError (untuk write path seperti GR→GP) */
  onMissing?: 'warn' | 'throw'
  productLabel?: string
}

export function toBaseQty(
  productId: string,
  uomName: string,
  qty: number,
  uomsMap: ProductUomsMap,
  options: ToBaseQtyOptions = {},
): number {
  const { onMissing = 'warn', productLabel = productId } = options
  const productUoms = uomsMap.get(productId)
  if (!productUoms?.length) {
    if (onMissing === 'throw') {
      throw new BusinessRuleError(
        `Satuan produk belum disetup untuk "${productLabel}". Konfigurasi UOM produk terlebih dahulu.`,
      )
    }
    console.warn(`[toBaseQty] No UOMs found for product ${productId}, using raw qty ${qty}`)
    return qty
  }
  const match = productUoms.find((u) => u.unit_name === uomName)
  if (!match) {
    if (onMissing === 'throw') {
      throw new BusinessRuleError(`Satuan "${uomName}" tidak ditemukan untuk "${productLabel}".`)
    }
    console.warn(`[toBaseQty] UOM "${uomName}" not found for product ${productId}, using raw qty ${qty}`)
    return qty
  }
  return qty * match.conversion_factor
}

/** Normalize qty to product base unit — throws if UOM setup missing (safe for DB writes). */
export function toProductBaseQty(
  productId: string,
  qty: number,
  uomName: string,
  uomsMap: ProductUomsMap,
  productLabel?: string,
): { qty: number; uom: string } {
  const productUoms = uomsMap.get(productId) ?? []
  const baseUom = resolveBaseUom(productUoms, uomName)
  const baseQty = toBaseQty(productId, uomName, qty, uomsMap, {
    onMissing: 'throw',
    productLabel: productLabel ?? productId,
  })
  return { qty: baseQty, uom: baseUom }
}
