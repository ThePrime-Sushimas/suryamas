import { pool } from '../../config/db'
import { PaymentTerm, CreatePaymentTermDto, UpdatePaymentTermDto, CalculationType } from './payment-terms.types'
import { mapPaymentTermFromDb } from './payment-terms.mapper'

export class PaymentTermsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { is_active?: boolean; calculation_type?: CalculationType; search?: string },
    includeDeleted = false
  ): Promise<{ data: PaymentTerm[]; total: number }> {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!includeDeleted) conditions.push('deleted_at IS NULL')
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    if (filter?.calculation_type) { params.push(filter.calculation_type); conditions.push(`calculation_type = $${idx}`); idx++ }
    if (filter?.search) { params.push(`%${filter.search}%`); conditions.push(`(term_code ILIKE $${idx} OR term_name ILIKE $${idx} OR description ILIKE $${idx})`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortField = sort?.field === 'id' ? 'id_payment_term' : (sort?.field || 'term_name')
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM payment_terms ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM payment_terms ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapPaymentTermFromDb), total: countRes.rows[0].total }
  }

  async findById(id: number, includeDeleted = false): Promise<PaymentTerm | null> {
    const condition = includeDeleted ? '' : ' AND deleted_at IS NULL'
    const { rows } = await pool.query(`SELECT * FROM payment_terms WHERE id_payment_term = $1${condition}`, [id])
    return rows[0] ? mapPaymentTermFromDb(rows[0]) : null
  }

  async findByTermCode(code: string): Promise<PaymentTerm | null> {
    const { rows } = await pool.query('SELECT * FROM payment_terms WHERE term_code = $1 AND deleted_at IS NULL', [code])
    return rows[0] ? mapPaymentTermFromDb(rows[0]) : null
  }

  async create(data: CreatePaymentTermDto & { created_by?: string }): Promise<PaymentTerm> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const { rows } = await pool.query(
      `INSERT INTO payment_terms (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return mapPaymentTermFromDb(rows[0])
  }

  async updateById(id: number, updates: UpdatePaymentTermDto): Promise<PaymentTerm | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE payment_terms SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id_payment_term = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id]
    )
    return rows[0] ? mapPaymentTermFromDb(rows[0]) : null
  }

  async delete(id: number, userId?: string): Promise<void> {
    await pool.query('UPDATE payment_terms SET deleted_at = NOW(), deleted_by = $1 WHERE id_payment_term = $2', [userId || null, id])
  }

  async restore(id: number): Promise<void> {
    await pool.query('UPDATE payment_terms SET deleted_at = NULL, deleted_by = NULL WHERE id_payment_term = $1', [id])
  }

  async minimalActive(): Promise<{ id: number; term_name: string }[]> {
    const { rows } = await pool.query(
      "SELECT id_payment_term, term_name FROM payment_terms WHERE is_active = true AND deleted_at IS NULL ORDER BY term_name LIMIT 1000"
    )
    return rows.map((r: { id_payment_term: number; term_name: string }) => ({ id: r.id_payment_term, term_name: r.term_name }))
  }
}

export const paymentTermsRepository = new PaymentTermsRepository()
