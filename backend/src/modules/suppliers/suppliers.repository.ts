import { pool } from '../../config/db'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, SupplierOption } from './suppliers.types'
import { mapSupplierResponse, mapSupplierOption } from './suppliers.mapper'

export class SuppliersRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: SupplierListQuery
  ): Promise<{ data: Supplier[]; total: number }> {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!query?.include_deleted) conditions.push('deleted_at IS NULL')
    if (query?.search) { params.push(`%${query.search}%`); conditions.push(`(supplier_code ILIKE $${idx} OR supplier_name ILIKE $${idx})`); idx++ }
    if (query?.supplier_type) { params.push(query.supplier_type); conditions.push(`supplier_type = $${idx}`); idx++ }
    if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`is_active = $${idx}`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const VALID_SORT_FIELDS = ['supplier_name', 'supplier_code', 'supplier_type', 'created_at', 'is_active']
    const sortBy = query?.sort_by && VALID_SORT_FIELDS.includes(query.sort_by) ? query.sort_by : 'supplier_name'
    const sortOrder = query?.sort_order === 'desc' ? 'DESC' : 'ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM suppliers ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM suppliers ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapSupplierResponse), total: countRes.rows[0].total }
  }

  async findById(id: string, includeDeleted = false): Promise<Supplier | null> {
    const condition = includeDeleted ? '' : ' AND deleted_at IS NULL'
    const { rows } = await pool.query(`SELECT * FROM suppliers WHERE id = $1${condition}`, [id])
    return rows[0] ? mapSupplierResponse(rows[0]) : null
  }

  async findByCode(code: string, excludeId?: string): Promise<Supplier | null> {
    const params: string[] = [code]
    let query = 'SELECT * FROM suppliers WHERE supplier_code = $1 AND deleted_at IS NULL'
    if (excludeId) { params.push(excludeId); query += ` AND id != $2` }
    const { rows } = await pool.query(query, params)
    return rows[0] ? mapSupplierResponse(rows[0]) : null
  }

  async create(data: CreateSupplierDto & { created_by?: string }): Promise<Supplier> {
    const insertData: Record<string, unknown> = { ...data, lead_time_days: data.lead_time_days ?? 1, minimum_order: data.minimum_order ?? 0, is_active: data.is_active ?? true }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO suppliers (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return mapSupplierResponse(rows[0])
  }

  async updateById(id: string, updates: UpdateSupplierDto & { updated_by?: string }): Promise<Supplier | null> {
    const fullUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
    const keys = Object.keys(fullUpdates)
    const values = Object.values(fullUpdates)
    const { rows } = await pool.query(
      `UPDATE suppliers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id]
    )
    return rows[0] ? mapSupplierResponse(rows[0]) : null
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    await pool.query(
      'UPDATE suppliers SET deleted_at = NOW(), is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL',
      [userId || null, id]
    )
  }

  async restore(id: string, userId?: string): Promise<Supplier | null> {
    const { rows } = await pool.query(
      'UPDATE suppliers SET deleted_at = NULL, is_active = true, updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NOT NULL RETURNING *',
      [userId || null, id]
    )
    return rows[0] ? mapSupplierResponse(rows[0]) : null
  }

  async getActiveOptions(): Promise<SupplierOption[]> {
    const { rows } = await pool.query("SELECT id, supplier_name FROM suppliers WHERE is_active = true AND deleted_at IS NULL ORDER BY supplier_name")
    return rows.map(mapSupplierOption)
  }
}

export const suppliersRepository = new SuppliersRepository()
