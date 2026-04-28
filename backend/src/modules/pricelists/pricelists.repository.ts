import { pool } from '../../config/db'
import { Pricelist, PricelistWithRelations, CreatePricelistDto, UpdatePricelistDto, PricelistListQuery, PricelistLookup } from './pricelists.types'

const DETAIL_SELECT = `
  pl.*,
  s.supplier_name, s.supplier_code,
  p.product_name, p.product_code,
  mu.unit_name AS uom_name
`
const DETAIL_FROM = `
  FROM pricelists pl
  LEFT JOIN suppliers s ON s.id = pl.supplier_id
  LEFT JOIN products p ON p.id = pl.product_id
  LEFT JOIN product_uoms pu ON pu.id = pl.uom_id
  LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
`

function mapWithRelations(row: Record<string, unknown>): PricelistWithRelations {
  return {
    ...row,
    supplier_name: row.supplier_name || 'Unknown',
    product_name: row.product_name || 'Unknown',
    uom_name: row.uom_name || 'Unknown',
    supplier: row.supplier_name ? { id: row.supplier_id, supplier_code: row.supplier_code, supplier_name: row.supplier_name } : undefined,
    product: row.product_name ? { id: row.product_id, product_code: row.product_code, product_name: row.product_name } : undefined,
  } as unknown as PricelistWithRelations
}

const VALID_SORT_FIELDS = ['created_at', 'price', 'valid_from', 'valid_to', 'status']

export class PricelistsRepository {
  async findAll(pagination: { limit: number; offset: number }, query?: PricelistListQuery): Promise<{ data: PricelistWithRelations[]; total: number }> {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!query?.include_deleted) conditions.push('pl.deleted_at IS NULL')
    if (query?.supplier_id) { params.push(query.supplier_id); conditions.push(`pl.supplier_id = $${idx}`); idx++ }
    if (query?.product_id) { params.push(query.product_id); conditions.push(`pl.product_id = $${idx}`); idx++ }
    if (query?.status) { params.push(query.status); conditions.push(`pl.status = $${idx}`); idx++ }
    if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`pl.is_active = $${idx}`); idx++ }
    if (query?.search) { params.push(`%${query.search}%`); conditions.push(`s.supplier_name ILIKE $${idx}`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortBy = query?.sort_by && VALID_SORT_FIELDS.includes(query.sort_by) ? `pl.${query.sort_by}` : 'pl.created_at'
    const sortOrder = query?.sort_order === 'asc' ? 'ASC' : 'DESC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${DETAIL_FROM} ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapWithRelations), total: countRes.rows[0].total }
  }

  async findById(id: string): Promise<PricelistWithRelations | null> {
    const { rows } = await pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} WHERE pl.id = $1 AND pl.deleted_at IS NULL`, [id])
    return rows[0] ? mapWithRelations(rows[0]) : null
  }

  async findActiveDuplicate(companyId: string, supplierId: string, productId: string, uomId: string): Promise<Pricelist | null> {
    const { rows } = await pool.query(
      "SELECT * FROM pricelists WHERE company_id = $1 AND supplier_id = $2 AND product_id = $3 AND uom_id = $4 AND is_active = true AND status = 'APPROVED' AND deleted_at IS NULL",
      [companyId, supplierId, productId, uomId]
    )
    return rows[0] ?? null
  }

  async getProductName(productId: string): Promise<string> {
    const { rows } = await pool.query('SELECT product_name FROM products WHERE id = $1', [productId])
    return rows[0]?.product_name || 'unknown'
  }

  async create(data: CreatePricelistDto): Promise<Pricelist> {
    const insertData: Record<string, unknown> = {
      company_id: data.company_id, supplier_id: data.supplier_id, product_id: data.product_id,
      uom_id: data.uom_id, price: data.price, currency: data.currency || 'IDR',
      valid_from: data.valid_from, valid_to: data.valid_to,
      is_active: data.is_active ?? true, status: 'APPROVED', created_by: data.created_by,
    }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO pricelists (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: string, updates: UpdatePricelistDto & { updated_by?: string }): Promise<Pricelist | null> {
    const fullUpdates = { ...updates, updated_at: new Date().toISOString() }
    const keys = Object.keys(fullUpdates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(fullUpdates)
    const { rows } = await pool.query(
      `UPDATE pricelists SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'EXPIRED'): Promise<Pricelist | null> {
    const { rows } = await pool.query(
      'UPDATE pricelists SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [status, id]
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    await pool.query(
      'UPDATE pricelists SET deleted_at = NOW(), is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL',
      [userId || null, id]
    )
  }

  async restorePricelist(id: string, userId?: string): Promise<Pricelist> {
    const { rows: deleted } = await pool.query('SELECT * FROM pricelists WHERE id = $1 AND deleted_at IS NOT NULL', [id])
    if (!deleted[0]) throw new Error('Deleted pricelist not found')

    const duplicate = await this.findActiveDuplicate(deleted[0].company_id, deleted[0].supplier_id, deleted[0].product_id, deleted[0].uom_id)
    if (duplicate) throw new Error('Cannot restore: An active pricelist already exists for this supplier-product-uom combination')

    const { rows } = await pool.query(
      'UPDATE pricelists SET deleted_at = NULL, is_active = true, updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NOT NULL RETURNING *',
      [userId || null, id]
    )
    return rows[0]
  }

  async lookupPrice(lookup: PricelistLookup): Promise<Pricelist | null> {
    const targetDate = lookup.date || new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(
      `SELECT * FROM pricelists
       WHERE supplier_id = $1 AND product_id = $2 AND uom_id = $3
         AND status = 'APPROVED' AND is_active = true AND deleted_at IS NULL
         AND valid_from <= $4 AND (valid_to IS NULL OR valid_to >= $4)
       ORDER BY valid_from DESC LIMIT 1`,
      [lookup.supplier_id, lookup.product_id, lookup.uom_id, targetDate]
    )
    return rows[0] ?? null
  }

  async expireOldPricelists(): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(
      `UPDATE pricelists SET status = 'EXPIRED', is_active = false, updated_at = NOW()
       WHERE status = 'APPROVED' AND valid_to IS NOT NULL AND valid_to < $1 AND deleted_at IS NULL
       RETURNING id`,
      [today]
    )
    return rows.length
  }
}

export const pricelistsRepository = new PricelistsRepository()
