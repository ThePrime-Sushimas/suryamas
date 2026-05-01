import { pool } from '../../config/db'
import {
  SupplierProduct, SupplierProductWithRelations, CreateSupplierProductDto,
  UpdateSupplierProductDto, SupplierProductListQuery, SupplierProductOption
} from './supplier-products.types'
import { mapSupplierProductFromDb, mapSupplierProductWithRelations, mapSupplierProductOption } from './supplier-products.mapper'
import { SUPPLIER_PRODUCT_SORT_FIELDS } from './supplier-products.constants'
import { SupplierProductValidationError } from './supplier-products.errors'

const RELATIONS_SELECT = `
  sp.*,
  s.id AS s_id, s.supplier_name, s.supplier_code, s.is_active AS s_is_active,
  p.id AS p_id, p.product_name, p.product_code, p.product_type, p.status AS p_status, p.default_purchase_unit
`
const RELATIONS_FROM = `
  FROM supplier_products sp
  LEFT JOIN suppliers s ON s.id = sp.supplier_id
  LEFT JOIN products p ON p.id = sp.product_id
`

function mapRowWithRelations(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    suppliers: row.s_id ? { id: row.s_id, supplier_name: row.supplier_name, supplier_code: row.supplier_code, is_active: row.s_is_active } : null,
    products: row.p_id ? { id: row.p_id, product_name: row.product_name, product_code: row.product_code, product_type: row.product_type, status: row.p_status, default_purchase_unit: row.default_purchase_unit } : null,
  }
}

export class SupplierProductsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: SupplierProductListQuery,
    includeRelations = false
  ): Promise<{ data: SupplierProduct[] | SupplierProductWithRelations[]; total: number }> {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!query?.include_deleted) conditions.push('sp.deleted_at IS NULL')
    if (query?.supplier_id) { params.push(query.supplier_id); conditions.push(`sp.supplier_id = $${idx}`); idx++ }
    if (query?.product_id) { params.push(query.product_id); conditions.push(`sp.product_id = $${idx}`); idx++ }
    if (query?.is_preferred !== undefined) { params.push(query.is_preferred); conditions.push(`sp.is_preferred = $${idx}`); idx++ }
    if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`sp.is_active = $${idx}`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortBy = query?.sort_by && SUPPLIER_PRODUCT_SORT_FIELDS.includes(query.sort_by as string) ? `sp.${query.sort_by}` : 'sp.created_at'
    const sortOrder = query?.sort_order === 'asc' ? 'ASC' : 'DESC'

    const selectFields = includeRelations ? RELATIONS_SELECT : 'sp.*'
    const fromClause = includeRelations ? RELATIONS_FROM : 'FROM supplier_products sp'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${selectFields} ${fromClause} ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM supplier_products sp ${where}`, params)
    ])

    let mappedData = includeRelations
      ? dataRes.rows.map((r: Record<string, unknown>) => mapSupplierProductWithRelations(mapRowWithRelations(r)))
      : dataRes.rows.map(mapSupplierProductFromDb)

    if (includeRelations && dataRes.rows.length > 0) {
      mappedData = await this.enrichWithCurrentPrices(mappedData as SupplierProductWithRelations[])
    }

    return { data: mappedData, total: countRes.rows[0].total }
  }

  async findById(id: string, includeRelations = false, includeDeleted = false): Promise<SupplierProduct | SupplierProductWithRelations | null> {
    const deletedFilter = includeDeleted ? '' : ' AND sp.deleted_at IS NULL'
    const selectFields = includeRelations ? RELATIONS_SELECT : 'sp.*'
    const fromClause = includeRelations ? RELATIONS_FROM : 'FROM supplier_products sp'

    const { rows } = await pool.query(`SELECT ${selectFields} ${fromClause} WHERE sp.id = $1${deletedFilter}`, [id])
    if (!rows[0]) return null

    return includeRelations
      ? mapSupplierProductWithRelations(mapRowWithRelations(rows[0]))
      : mapSupplierProductFromDb(rows[0])
  }

  async findBySupplier(supplierId: string, includeRelations = false): Promise<SupplierProduct[] | SupplierProductWithRelations[]> {
    const selectFields = includeRelations ? RELATIONS_SELECT : 'sp.*'
    const fromClause = includeRelations ? RELATIONS_FROM : 'FROM supplier_products sp'

    const { rows } = await pool.query(
      `SELECT ${selectFields} ${fromClause} WHERE sp.supplier_id = $1 AND sp.deleted_at IS NULL AND sp.is_active = true ORDER BY sp.is_preferred DESC, sp.price ASC`,
      [supplierId]
    )

    return includeRelations
      ? rows.map((r: Record<string, unknown>) => mapSupplierProductWithRelations(mapRowWithRelations(r)))
      : rows.map(mapSupplierProductFromDb)
  }

  async findByProduct(productId: string, includeRelations = false): Promise<SupplierProduct[] | SupplierProductWithRelations[]> {
    const selectFields = includeRelations ? RELATIONS_SELECT : 'sp.*'
    const fromClause = includeRelations ? RELATIONS_FROM : 'FROM supplier_products sp'

    const { rows } = await pool.query(
      `SELECT ${selectFields} ${fromClause} WHERE sp.product_id = $1 AND sp.deleted_at IS NULL AND sp.is_active = true ORDER BY sp.is_preferred DESC, sp.price ASC`,
      [productId]
    )

    return includeRelations
      ? rows.map((r: Record<string, unknown>) => mapSupplierProductWithRelations(mapRowWithRelations(r)))
      : rows.map(mapSupplierProductFromDb)
  }

  async findBySupplierAndProduct(supplierId: string, productId: string, excludeId?: string): Promise<SupplierProduct | null> {
    const params: string[] = [supplierId, productId]
    let query = 'SELECT * FROM supplier_products WHERE supplier_id = $1 AND product_id = $2 AND deleted_at IS NULL'
    if (excludeId) { params.push(excludeId); query += ' AND id != $3' }
    const { rows } = await pool.query(query, params)
    return rows[0] ? mapSupplierProductFromDb(rows[0]) : null
  }

  async countPreferredByProduct(productId: string, excludeId?: string): Promise<number> {
    const params: string[] = [productId]
    let query = 'SELECT COUNT(*)::int AS cnt FROM supplier_products WHERE product_id = $1 AND is_preferred = true AND is_active = true AND deleted_at IS NULL'
    if (excludeId) { params.push(excludeId); query += ' AND id != $2' }
    const { rows } = await pool.query(query, params)
    return rows[0].cnt
  }

  async create(data: CreateSupplierProductDto & { created_by?: string; updated_by?: string }): Promise<SupplierProduct> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const { rows } = await pool.query(
      `INSERT INTO supplier_products (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return mapSupplierProductFromDb(rows[0])
  }

  async updateById(id: string, updates: UpdateSupplierProductDto & { updated_by?: string }): Promise<SupplierProduct | null> {
    const fullUpdates = { ...updates, updated_at: new Date().toISOString() }
    const keys = Object.keys(fullUpdates)
    const values = Object.values(fullUpdates)
    const { rows } = await pool.query(
      `UPDATE supplier_products SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    return rows[0] ? mapSupplierProductFromDb(rows[0]) : null
  }

  async delete(id: string): Promise<void> {
    await pool.query('UPDATE supplier_products SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL', [id])
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (!ids?.length) throw new SupplierProductValidationError('IDs array cannot be empty')
    await pool.query('UPDATE supplier_products SET deleted_at = NOW(), is_active = false WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL', [ids])
  }

  async restore(id: string): Promise<SupplierProduct | null> {
    const { rows } = await pool.query(
      'UPDATE supplier_products SET deleted_at = NULL, is_active = true, updated_at = NOW() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    )
    return rows[0] ? mapSupplierProductFromDb(rows[0]) : null
  }

  async bulkRestore(ids: string[]): Promise<void> {
    if (!ids?.length) throw new SupplierProductValidationError('IDs array cannot be empty')
    await pool.query('UPDATE supplier_products SET deleted_at = NULL, is_active = true, updated_at = NOW() WHERE id = ANY($1::uuid[]) AND deleted_at IS NOT NULL', [ids])
  }

  async getActiveOptions(): Promise<SupplierProductOption[]> {
    const { rows } = await pool.query(
      `SELECT sp.id, sp.price, sp.currency, s.supplier_name, p.product_name
       FROM supplier_products sp
       LEFT JOIN suppliers s ON s.id = sp.supplier_id
       LEFT JOIN products p ON p.id = sp.product_id
       WHERE sp.is_active = true AND sp.deleted_at IS NULL
       ORDER BY s.supplier_name, p.product_name`
    )
    return rows.map((r: Record<string, unknown>) => mapSupplierProductOption({
      ...r,
      suppliers: { supplier_name: r.supplier_name },
      products: { product_name: r.product_name },
    }))
  }

  private async enrichWithCurrentPrices(supplierProducts: SupplierProductWithRelations[]): Promise<SupplierProductWithRelations[]> {
    if (!supplierProducts.length) return supplierProducts

    const today = new Date().toISOString().split('T')[0]
    const supplierIds = supplierProducts.map(sp => sp.supplier_id)
    const productIds = supplierProducts.map(sp => sp.product_id)

    const { rows: pricelists } = await pool.query(
      `SELECT pl.supplier_id, pl.product_id, pl.price, pl.currency, pl.uom_id, mu.unit_name
       FROM pricelists pl
       LEFT JOIN product_uoms pu ON pu.id = pl.uom_id
       LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE pl.status = 'APPROVED' AND pl.is_active = true AND pl.deleted_at IS NULL
         AND pl.valid_from <= $1 AND (pl.valid_to IS NULL OR pl.valid_to >= $1)
         AND pl.supplier_id = ANY($2::uuid[]) AND pl.product_id = ANY($3::uuid[])`,
      [today, supplierIds, productIds]
    )

    const priceMap = new Map<string, { price: number; currency: string; unit: string }>()
    for (const p of pricelists) {
      const key = `${p.supplier_id}-${p.product_id}`
      if (!priceMap.has(key)) {
        priceMap.set(key, { price: parseFloat(p.price), currency: p.currency, unit: p.unit_name || '' })
      }
    }

    return supplierProducts.map(sp => {
      const currentPrice = priceMap.get(`${sp.supplier_id}-${sp.product_id}`)
      return { ...sp, current_price: currentPrice?.price, current_currency: currentPrice?.currency, current_unit: currentPrice?.unit }
    })
  }
}

export const supplierProductsRepository = new SupplierProductsRepository()
