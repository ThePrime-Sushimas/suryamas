import { pool } from '../../config/db'
import { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../products/products.types'

export class ProductUomsRepository {
  async findByProductId(productId: string, includeDeleted = false): Promise<ProductUom[]> {
    const deletedFilter = includeDeleted ? '' : ' AND pu.is_deleted = false'
    const { rows } = await pool.query(
      `SELECT pu.*, mu.id AS mu_id, mu.unit_name AS mu_unit_name, mu.metric_type AS mu_metric_type
       FROM product_uoms pu
       LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE pu.product_id = $1${deletedFilter}
       ORDER BY pu.is_base_unit DESC`,
      [productId]
    )
    return rows.map((r: Record<string, unknown>) => ({
      ...r,
      metric_units: r.mu_id ? { id: r.mu_id, unit_name: r.mu_unit_name, metric_type: r.mu_metric_type } : null,
    })) as unknown as ProductUom[]
  }

  async findByProductIdAndMetricUnit(productId: string, metricUnitId: string): Promise<ProductUom | null> {
    const { rows } = await pool.query(
      'SELECT * FROM product_uoms WHERE product_id = $1 AND metric_unit_id = $2 AND is_deleted = false',
      [productId, metricUnitId]
    )
    return rows[0] ?? null
  }

  async findById(id: string, includeDeleted = false): Promise<ProductUom | null> {
    const deletedFilter = includeDeleted ? '' : ' AND is_deleted = false'
    const { rows } = await pool.query(`SELECT * FROM product_uoms WHERE id = $1${deletedFilter}`, [id])
    return rows[0] ?? null
  }

  async findBaseUom(productId: string): Promise<ProductUom | null> {
    const { rows } = await pool.query(
      'SELECT * FROM product_uoms WHERE product_id = $1 AND is_base_unit = true AND is_deleted = false LIMIT 1',
      [productId]
    )
    return rows[0] ?? null
  }

  async create(data: CreateProductUomDto & { product_id: string; created_by?: string; updated_by?: string }): Promise<ProductUom> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const { rows } = await pool.query(
      `INSERT INTO product_uoms (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: string, updates: UpdateProductUomDto & { updated_by?: string }): Promise<ProductUom | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE product_uoms SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await pool.query('UPDATE product_uoms SET is_deleted = true WHERE id = $1', [id])
  }

  async restore(id: string): Promise<ProductUom | null> {
    const { rows } = await pool.query('UPDATE product_uoms SET is_deleted = false WHERE id = $1 RETURNING *', [id])
    return rows[0] ?? null
  }

  async findDefaultByProduct(productId: string, field: 'is_default_stock_unit' | 'is_default_purchase_unit' | 'is_default_transfer_unit'): Promise<ProductUom | null> {
    const { rows } = await pool.query(
      `SELECT * FROM product_uoms WHERE product_id = $1 AND ${field} = true AND is_deleted = false LIMIT 1`,
      [productId]
    )
    return rows[0] ?? null
  }
}

export const productUomsRepository = new ProductUomsRepository()
