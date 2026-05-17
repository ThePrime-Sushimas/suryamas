import { pool } from '../../config/db'
import type { OutputTemplateRow } from '../goods-processing/goods-processing.types'

export class ProductOutputTemplateRepository {
  /**
   * Fetch output templates for a list of product IDs.
   * Returns a map of product_id → OutputTemplateRow[]
   */
  async findByProductIds(productIds: string[]): Promise<Record<string, OutputTemplateRow[]>> {
    if (productIds.length === 0) return {}

    const { rows } = await pool.query<
      OutputTemplateRow & { product_id: string }
    >(
      `SELECT
         pot.id,
         pot.product_id,
         pot.output_product_id,
         p.product_name   AS output_product_name,
         p.product_code   AS output_product_code,
         pot.output_uom,
         pot.suggested_pct,
         pot.sort_order,
         pot.notes
       FROM product_output_templates pot
       JOIN products p ON p.id = pot.output_product_id
       WHERE pot.product_id = ANY($1::uuid[])
       ORDER BY pot.product_id, pot.sort_order`,
      [productIds]
    )

    const result: Record<string, OutputTemplateRow[]> = {}
    for (const row of rows) {
      if (!result[row.product_id]) result[row.product_id] = []
      result[row.product_id].push(row)
    }
    return result
  }
}

export const productOutputTemplateRepository = new ProductOutputTemplateRepository()
