import { pool } from '../../config/db'
import { PaymentMethod, CreatePaymentMethodDto, UpdatePaymentMethodDto, PaymentMethodWithDetails } from './payment-methods.types'
import { logError, logInfo } from '../../config/logger'

interface FilterParams {
  payment_type?: string
  is_active?: boolean
  requires_bank_account?: boolean
  search?: string
}

const DETAIL_SELECT = `
  pm.*,
  ba.account_number AS ba_account_number, ba.account_name AS ba_account_name,
  bk.bank_code, bk.bank_name,
  coa.account_code AS coa_code, coa.account_name AS coa_name, coa.account_type AS coa_type,
  fcoa.account_code AS fee_coa_code, fcoa.account_name AS fee_coa_name, fcoa.account_type AS fee_coa_type,
  flcoa.account_code AS fee_liability_coa_code, flcoa.account_name AS fee_liability_coa_name
`
const DETAIL_FROM = `
  FROM payment_methods pm
  LEFT JOIN bank_accounts ba ON ba.id = pm.bank_account_id
  LEFT JOIN banks bk ON bk.id = ba.bank_id
  LEFT JOIN chart_of_accounts coa ON coa.id = pm.coa_account_id
  LEFT JOIN chart_of_accounts fcoa ON fcoa.id = pm.fee_coa_account_id
  LEFT JOIN chart_of_accounts flcoa ON flcoa.id = pm.fee_liability_coa_account_id
`

function mapDetail(row: Record<string, unknown>): PaymentMethodWithDetails {
  return {
    ...row,
    bank_code: row.bank_code, bank_name: row.bank_name,
    account_number: row.ba_account_number, account_name: row.ba_account_name,
    coa_code: row.coa_code, coa_name: row.coa_name, coa_type: row.coa_type,
    fee_coa_code: row.fee_coa_code, fee_coa_name: row.fee_coa_name, fee_coa_type: row.fee_coa_type,
    fee_liability_coa_code: row.fee_liability_coa_code, fee_liability_coa_name: row.fee_liability_coa_name,
  } as unknown as PaymentMethodWithDetails
}

const VALID_SORT_FIELDS = ['sort_order', 'code', 'name', 'payment_type', 'is_active', 'created_at']

export class PaymentMethodsRepository {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) return cached.data as T
    this.cache.delete(key)
    return null
  }

  private setCache<T>(key: string, data: T, ttl = this.CACHE_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  private invalidateCache(pattern?: string): void {
    if (pattern) { for (const key of this.cache.keys()) { if (key.includes(pattern)) this.cache.delete(key) } }
    else this.cache.clear()
  }

  async findAll(
    companyId: string, pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }, filter?: FilterParams
  ): Promise<{ data: PaymentMethodWithDetails[]; total: number }> {
    const conditions: string[] = ['pm.company_id = $1', 'pm.deleted_at IS NULL']
    const params: (string | boolean)[] = [companyId]
    let idx = 2

    if (filter?.payment_type) { params.push(filter.payment_type); conditions.push(`pm.payment_type = $${idx}`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`pm.is_active = $${idx}`); idx++ }
    if (filter?.requires_bank_account !== undefined) { params.push(filter.requires_bank_account); conditions.push(`pm.requires_bank_account = $${idx}`); idx++ }
    if (filter?.search) { params.push(`%${filter.search}%`); conditions.push(`(pm.code ILIKE $${idx} OR pm.name ILIKE $${idx})`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`
    const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? `pm.${sort.field}` : 'pm.sort_order'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'
    const extraOrder = sortField === 'pm.sort_order' ? ', pm.code ASC' : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY ${sortField} ${sortOrder}${extraOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM payment_methods pm ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapDetail), total: countRes.rows[0].total }
  }

  async findById(id: number): Promise<PaymentMethodWithDetails | null> {
    const { rows } = await pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} WHERE pm.id = $1 AND pm.deleted_at IS NULL`, [id])
    return rows[0] ? mapDetail(rows[0]) : null
  }

  async findByCode(companyId: string, code: string): Promise<PaymentMethod | null> {
    const { rows } = await pool.query('SELECT * FROM payment_methods WHERE company_id = $1 AND code = $2 AND deleted_at IS NULL', [companyId, code.toUpperCase()])
    return rows[0] ?? null
  }

  async findByCodeExcludeId(companyId: string, code: string, excludeId: number): Promise<PaymentMethod | null> {
    const { rows } = await pool.query('SELECT * FROM payment_methods WHERE company_id = $1 AND code = $2 AND id != $3 AND deleted_at IS NULL', [companyId, code.toUpperCase(), excludeId])
    return rows[0] ?? null
  }

  async findDefault(companyId: string): Promise<PaymentMethod | null> {
    const { rows } = await pool.query('SELECT * FROM payment_methods WHERE company_id = $1 AND is_default = true AND is_active = true AND deleted_at IS NULL', [companyId])
    return rows[0] ?? null
  }

  async findByBankAccountId(bankAccountId: number): Promise<PaymentMethod | null> {
    const { rows } = await pool.query('SELECT * FROM payment_methods WHERE bank_account_id = $1 AND deleted_at IS NULL', [bankAccountId])
    return rows[0] ?? null
  }

  async create(data: CreatePaymentMethodDto, userId: string): Promise<PaymentMethod> {
    const insertData = { ...data, code: data.code.toUpperCase(), created_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO payment_methods (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    logInfo('Payment method created in repository', { id: rows[0].id, code: rows[0].code, company_id: rows[0].company_id, user_id: userId })
    this.invalidateCache(data.company_id)
    return rows[0]
  }

  async update(id: number, updates: UpdatePaymentMethodDto): Promise<PaymentMethod | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    const fullUpdates = { ...updates, updated_at: new Date().toISOString() }
    const keys = Object.keys(fullUpdates)
    const values = Object.values(fullUpdates)
    const { rows } = await pool.query(
      `UPDATE payment_methods SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    if (rows[0]) this.invalidateCache(rows[0].company_id)
    return rows[0] ?? null
  }

  async updateWithUser(id: number, updates: UpdatePaymentMethodDto, userId: string): Promise<PaymentMethod | null> {
    return this.update(id, { ...updates, updated_by: userId } as UpdatePaymentMethodDto)
  }

  async softDelete(id: number, userId: string): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Payment method not found')
    await pool.query('UPDATE payment_methods SET deleted_at = NOW(), deleted_by = $1, is_active = false, is_default = false WHERE id = $2', [userId, id])
    this.invalidateCache(existing.company_id)
  }

  async unsetDefault(companyId: string, excludeId?: number): Promise<void> {
    const params: (string | number)[] = [companyId]
    let query = 'UPDATE payment_methods SET is_default = false, updated_at = NOW() WHERE company_id = $1 AND is_default = true'
    if (excludeId) { params.push(excludeId); query += ' AND id != $2' }
    await pool.query(query, params)
    this.invalidateCache(companyId)
  }

  async bulkUpdateStatus(ids: number[], isActive: boolean, userId: string): Promise<void> {
    await pool.query('UPDATE payment_methods SET is_active = $1, updated_at = NOW(), updated_by = $2 WHERE id = ANY($3::int[])', [isActive, userId, ids])
    this.invalidateCache()
  }

  async bulkDelete(ids: number[], userId: string): Promise<void> {
    await pool.query('UPDATE payment_methods SET deleted_at = NOW(), deleted_by = $1, is_active = false, is_default = false WHERE id = ANY($2::int[])', [userId, ids])
    this.invalidateCache()
  }

  async exportData(companyId: string, filter?: FilterParams, limit = 10000): Promise<PaymentMethodWithDetails[]> {
    const conditions: string[] = ['pm.company_id = $1', 'pm.deleted_at IS NULL']
    const params: (string | boolean | number)[] = [companyId]
    let idx = 2

    if (filter?.payment_type) { params.push(filter.payment_type); conditions.push(`pm.payment_type = $${idx}`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`pm.is_active = $${idx}`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`
    params.push(limit)

    const { rows } = await pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY pm.sort_order ASC, pm.code ASC LIMIT $${idx}`, params)
    return rows.map(mapDetail)
  }

  async getOptions(companyId: string): Promise<PaymentMethodWithDetails[]> {
    const { rows } = await pool.query(
      `SELECT ${DETAIL_SELECT} ${DETAIL_FROM} WHERE pm.company_id = $1 AND pm.is_active = true AND pm.deleted_at IS NULL ORDER BY pm.sort_order ASC, pm.code ASC`,
      [companyId]
    )
    return rows.map(mapDetail)
  }

  async companyExists(companyId: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM companies WHERE id = $1', [companyId])
    return rows[0].cnt > 0
  }

  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await callback()
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async findBankAccount(bankAccountId: number): Promise<{ id: number; is_active: boolean; owner_type: string; owner_id: string } | null> {
    const { rows } = await pool.query('SELECT id, is_active, owner_type, owner_id FROM bank_accounts WHERE id = $1 AND deleted_at IS NULL', [bankAccountId])
    return rows[0] ?? null
  }

  async findCoaAccount(coaAccountId: string): Promise<{ id: string; account_code: string; account_type: string; is_postable: boolean; company_id: string } | null> {
    const { rows } = await pool.query('SELECT id, account_code, account_type, is_postable, company_id FROM chart_of_accounts WHERE id = $1 AND deleted_at IS NULL', [coaAccountId])
    return rows[0] ?? null
  }
}

export const paymentMethodsRepository = new PaymentMethodsRepository()
