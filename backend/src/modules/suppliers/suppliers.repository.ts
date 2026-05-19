import { pool } from '../../config/db'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, SupplierOption } from './suppliers.types'
import { mapSupplierResponse, mapSupplierOption } from './suppliers.mapper'
import { SupplierValidationError } from './suppliers.errors'

export class SuppliersRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: SupplierListQuery
  ): Promise<{ data: Supplier[]; total: number }> {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!query?.include_deleted) conditions.push('s.deleted_at IS NULL')
    if (query?.search) { params.push(`%${query.search}%`); conditions.push(`(s.supplier_code ILIKE $${idx} OR s.supplier_name ILIKE $${idx})`); idx++ }
    if (query?.supplier_type) { params.push(query.supplier_type); conditions.push(`s.supplier_type = $${idx}`); idx++ }
    if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`s.is_active = $${idx}`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const VALID_SORT_FIELDS = ['supplier_name', 'supplier_code', 'supplier_type', 'created_at', 'is_active']
    const sortBy = query?.sort_by && VALID_SORT_FIELDS.includes(query.sort_by) ? query.sort_by : 'supplier_name'
    const sortOrder = query?.sort_order === 'desc' ? 'DESC' : 'ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT s.*, pt.days AS payment_term_days, pt.term_name AS payment_term_name FROM suppliers s LEFT JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM suppliers s LEFT JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapSupplierResponse), total: countRes.rows[0].total }
  }

  async findById(id: string, includeDeleted = false): Promise<Supplier | null> {
    const condition = includeDeleted ? '' : ' AND s.deleted_at IS NULL'
    const { rows } = await pool.query(
      `SELECT s.*, pt.days AS payment_term_days, pt.term_name AS payment_term_name
       FROM suppliers s
       LEFT JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id
       WHERE s.id = $1${condition}`,
      [id],
    )
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
    const requiresInvoice = data.requires_invoice ?? true
    if (requiresInvoice === false && !data.invoice_bypass_reason) {
      throw new SupplierValidationError(
        'invoice_bypass_reason is required when requires_invoice is false',
        { invoice_bypass_reason: { required: true } },
      )
    }
    const insertData: Record<string, unknown> = {
      ...data,
      lead_time_days: data.lead_time_days ?? 1,
      minimum_order: data.minimum_order ?? 0,
      is_active: data.is_active ?? true,
      requires_invoice: requiresInvoice,
      default_tax_rate: data.default_tax_rate ?? 11,
      invoice_bypass_reason: requiresInvoice === false ? data.invoice_bypass_reason : null,
    }
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
