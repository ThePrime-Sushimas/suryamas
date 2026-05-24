import { pool } from '../../config/db'
import type { PoolClient } from 'pg'

export interface OutputTemplateRow {
  id: string
  product_id: string
  output_product_id: string
  output_product_name: string
  output_product_code: string
  output_uom: string
  suggested_pct: number | null
  sort_order: number
  notes: string | null
  bears_cost: boolean
}

export interface UpsertOutputTemplateDto {
  output_product_id: string
  output_uom: string
  suggested_pct?: number | null
  sort_order?: number
  notes?: string | null
  bears_cost?: boolean
}

export class ProductOutputTemplateRepository {
  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Get full template for a product (joined with product name)
  async findByProductId(productId: string): Promise<OutputTemplateRow[]> {
    const { rows } = await pool.query(
      `SELECT
         pot.id,
         pot.product_id,
         pot.output_product_id,
         p.product_name AS output_product_name,
         p.product_code AS output_product_code,
         pot.output_uom,
         pot.suggested_pct,
         pot.sort_order,
         pot.notes,
         pot.bears_cost
       FROM product_output_templates pot
       JOIN products p ON p.id = pot.output_product_id
       WHERE pot.product_id = $1
         AND p.is_deleted = false
       ORDER BY pot.sort_order, pot.created_at`,
      [productId]
    )
    return rows
  }

  // Batch fetch templates for multiple products (used in GP detail load)
  async findByProductIds(productIds: string[]): Promise<Record<string, OutputTemplateRow[]>> {
    if (productIds.length === 0) return {}

    const { rows } = await pool.query(
      `SELECT
         pot.id,
         pot.product_id,
         pot.output_product_id,
         p.product_name AS output_product_name,
         p.product_code AS output_product_code,
         pot.output_uom,
         pot.suggested_pct,
         pot.sort_order,
         pot.notes,
         pot.bears_cost
       FROM product_output_templates pot
       JOIN products p ON p.id = pot.output_product_id
       WHERE pot.product_id = ANY($1::uuid[])
         AND p.is_deleted = false
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

  // Replace entire template for a product (delete + insert)
  async replaceTemplate(
    client: PoolClient,
    productId: string,
    items: UpsertOutputTemplateDto[],
    userId: string
  ): Promise<void> {
    await client.query(
      'DELETE FROM product_output_templates WHERE product_id = $1',
      [productId]
    )

    if (items.length === 0) return

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const [i, item] of items.entries()) {
      valueRows.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6})`)
      params.push(
        productId,
        item.output_product_id,
        item.output_uom,
        item.suggested_pct ?? null,
        item.sort_order ?? i,
        item.bears_cost ?? true,
        userId
      )
      idx += 7
    }

    await client.query(
      `INSERT INTO product_output_templates
         (product_id, output_product_id, output_uom, suggested_pct, sort_order, bears_cost, created_by)
       VALUES ${valueRows.join(', ')}`,
      params
    )
  }
}

export const productOutputTemplateRepository = new ProductOutputTemplateRepository()