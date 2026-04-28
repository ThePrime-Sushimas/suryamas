import { pool } from '../../../config/db'
import { AccountingPurpose, CreateAccountingPurposeDTO, UpdateAccountingPurposeDTO, FilterParams, SortParams } from './accounting-purposes.types'
import { AccountingPurposeErrors, AccountingPurposeError } from './accounting-purposes.errors'
import { AccountingPurposesConfig, defaultConfig } from './accounting-purposes.config'
import { logError, logInfo } from '../../../config/logger'

const VALID_SORT_FIELDS = ['purpose_code', 'purpose_name', 'applied_to', 'is_active', 'created_at', 'updated_at']
const AP_INSERT_FIELDS = ['company_id', 'purpose_code', 'purpose_name', 'description', 'applied_to', 'is_active', 'is_system', 'created_by', 'updated_by', 'created_at', 'updated_at'] as const
const AP_UPDATE_FIELDS = ['purpose_name', 'description', 'applied_to', 'is_active', 'is_deleted', 'deleted_at', 'deleted_by', 'updated_by', 'updated_at'] as const

export class AccountingPurposesRepository {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: AccountingPurposesConfig

  constructor(config: AccountingPurposesConfig = defaultConfig) {
    this.config = config
    this.cleanupTimer = setInterval(() => this.cleanupExpiredCache(), this.config.cache.cleanupInterval)
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) { if (now - entry.timestamp > entry.ttl) this.cache.delete(key) }
    if (this.cache.size > this.config.cache.maxSize) {
      const sorted = [...this.cache.entries()].sort(([, a], [, b]) => a.timestamp - b.timestamp)
      const toRemove = this.cache.size - this.config.cache.maxSize
      for (let i = 0; i < toRemove; i++) this.cache.delete(sorted[i][0])
    }
  }

  private getCacheKey(prefix: string, params: Record<string, unknown>): string {
    return `${prefix}:${JSON.stringify(Object.keys(params).sort().reduce((o, k) => ({ ...o, [k]: params[k] }), {}))}`
  }
  private getFromCache<T>(key: string): T | null {
    const c = this.cache.get(key); if (c && Date.now() - c.timestamp < c.ttl) return c.data as T; if (c) this.cache.delete(key); return null
  }
  private setCache<T>(key: string, data: T, ttl = this.config.cache.ttl): void { this.cache.set(key, { data, timestamp: Date.now(), ttl }) }
  private invalidateCache(pattern?: string): void {
    if (pattern) { for (const k of this.cache.keys()) { if (k.startsWith(pattern)) this.cache.delete(k) } } else this.cache.clear()
  }

  private buildConditions(companyId: string, filter?: FilterParams) {
    const conditions: string[] = ['company_id = $1']
    const params: (string | boolean)[] = [companyId]
    let idx = 2

    if (filter?.show_deleted) conditions.push('is_deleted = true')
    else conditions.push('(is_deleted IS NULL OR is_deleted = false)')

    if (filter?.applied_to) { params.push(filter.applied_to); conditions.push(`applied_to = $${idx}`); idx++ }
    if (typeof filter?.is_active === 'boolean') { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    if (filter?.q) {
      const term = filter.q.replace(/[%_\\]/g, '\\$&')
      params.push(`%${term}%`)
      conditions.push(`(purpose_name ILIKE $${idx} OR purpose_code ILIKE $${idx})`)
      idx++
    }

    return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
  }

  async findAll(companyId: string, pagination: { limit: number; offset: number }, sort?: SortParams, filter?: FilterParams): Promise<{ data: AccountingPurpose[]; total: number }> {
    if (!companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('companyId', 'Company ID is required')

    const cacheKey = this.getCacheKey('list', { companyId, offset: pagination.offset, limit: pagination.limit, sort, filter })
    const cached = this.getFromCache<{ data: AccountingPurpose[]; total: number }>(cacheKey)
    if (cached) return cached

    try {
      const { where, params, idx } = this.buildConditions(companyId, filter)
      const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? sort.field : 'purpose_code'
      const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM accounting_purposes ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM accounting_purposes ${where}`, params)
      ])

      const result = { data: dataRes.rows, total: countRes.rows[0].total }
      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      if (error instanceof AccountingPurposeError) throw error
      throw AccountingPurposeErrors.REPOSITORY_ERROR('findAll', error as Error)
    }
  }

  async findById(id: string, companyId: string): Promise<AccountingPurpose | null> {
    if (!id?.trim() || !companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('id_or_companyId', 'ID and Company ID are required')

    const cacheKey = this.getCacheKey('detail', { id, companyId })
    const cached = this.getFromCache<AccountingPurpose>(cacheKey)
    if (cached) return cached

    const { rows } = await pool.query('SELECT * FROM accounting_purposes WHERE id = $1 AND company_id = $2', [id, companyId])
    if (rows[0]) this.setCache(cacheKey, rows[0])
    return rows[0] ?? null
  }

  async findByIds(companyId: string, ids: string[]): Promise<AccountingPurpose[]> {
    if (!companyId?.trim() || !ids?.length) return []
    const { rows } = await pool.query('SELECT * FROM accounting_purposes WHERE company_id = $1 AND id = ANY($2::uuid[])', [companyId, ids])
    return rows
  }

  async findByCode(companyId: string, code: string): Promise<AccountingPurpose | null> {
    if (!code?.trim() || !companyId?.trim()) return null

    const cacheKey = this.getCacheKey('code', { companyId, code })
    const cached = this.getFromCache<AccountingPurpose>(cacheKey)
    if (cached) return cached

    const { rows } = await pool.query('SELECT * FROM accounting_purposes WHERE company_id = $1 AND purpose_code = $2', [companyId, code])
    if (rows[0]) this.setCache(cacheKey, rows[0], 120000)
    return rows[0] ?? null
  }

  async create(data: CreateAccountingPurposeDTO, userId: string): Promise<AccountingPurpose> {
    if (!userId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')

    try {
      const now = new Date().toISOString()
      const insertData: Record<string, unknown> = { ...data, is_system: false, created_by: userId, updated_by: userId, created_at: now, updated_at: now }
      const keys = AP_INSERT_FIELDS.filter(k => insertData[k] !== undefined)
      const values = keys.map(k => insertData[k])

      const { rows } = await pool.query(
        `INSERT INTO accounting_purposes (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        values
      )

      this.invalidateCache('list:')
      this.invalidateCache('code:')
      this.invalidateCache('filter-options:')
      logInfo('Accounting purpose created', { purpose_id: rows[0].id, purpose_code: rows[0].purpose_code })
      return rows[0]
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') throw AccountingPurposeErrors.CODE_EXISTS(data.purpose_code, data.company_id)
      if (error instanceof AccountingPurposeError) throw error
      throw AccountingPurposeErrors.REPOSITORY_ERROR('create', error as Error)
    }
  }

  async update(id: string, companyId: string, updates: UpdateAccountingPurposeDTO & { updated_by: string }): Promise<AccountingPurpose | null> {
    if (!id?.trim() || !companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')

    const fullUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
    const keys = AP_UPDATE_FIELDS.filter(k => fullUpdates[k] !== undefined)
    if (!keys.length) return this.findById(id, companyId)
    const values = keys.map(k => fullUpdates[k])

    const { rows } = await pool.query(
      `UPDATE accounting_purposes SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2} RETURNING *`,
      [...values, id, companyId]
    )

    if (rows[0]) { this.invalidateCache('list:'); this.invalidateCache('code:'); this.invalidateCache('detail:'); this.invalidateCache('filter-options:') }
    return rows[0] ?? null
  }

  async delete(id: string, companyId: string): Promise<void> {
    if (!id?.trim() || !companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')
    await pool.query(
      'UPDATE accounting_purposes SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND company_id = $2 AND is_system = false',
      [id, companyId]
    )
    this.invalidateCache()
  }

  async bulkUpdateStatus(companyId: string, ids: string[], updateData: { is_active: boolean; updated_by: string }): Promise<void> {
    if (!companyId?.trim() || !ids?.length) throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Company ID and IDs array are required')
    if (ids.length > this.config.limits.bulkUpdate) throw AccountingPurposeErrors.BULK_OPERATION_LIMIT_EXCEEDED('update', this.config.limits.bulkUpdate, ids.length)

    await pool.query(
      'UPDATE accounting_purposes SET is_active = $1, updated_by = $2, updated_at = NOW() WHERE company_id = $3 AND is_system = false AND id = ANY($4::uuid[])',
      [updateData.is_active, updateData.updated_by, companyId, ids]
    )
    this.invalidateCache('list:')
    this.invalidateCache('code:')
  }

  async bulkDelete(companyId: string, ids: string[]): Promise<void> {
    if (!companyId?.trim() || !ids?.length) throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Company ID and IDs array are required')
    if (ids.length > this.config.limits.bulkDelete) throw AccountingPurposeErrors.BULK_OPERATION_LIMIT_EXCEEDED('delete', this.config.limits.bulkDelete, ids.length)

    await pool.query(
      'UPDATE accounting_purposes SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE company_id = $1 AND is_system = false AND id = ANY($2::uuid[])',
      [companyId, ids]
    )
    this.invalidateCache('list:')
    this.invalidateCache('code:')
  }

  async restore(id: string, companyId: string): Promise<void> {
    if (!id?.trim() || !companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')
    await pool.query(
      'UPDATE accounting_purposes SET is_deleted = false, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = $1 AND company_id = $2 AND is_deleted = true',
      [id, companyId]
    )
    this.invalidateCache()
  }

  async bulkRestore(companyId: string, ids: string[]): Promise<void> {
    if (!companyId?.trim() || !ids?.length) throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Company ID and IDs array are required')
    await pool.query(
      'UPDATE accounting_purposes SET is_deleted = false, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE company_id = $1 AND is_deleted = true AND id = ANY($2::uuid[])',
      [companyId, ids]
    )
    this.invalidateCache('list:')
    this.invalidateCache('code:')
  }

  async exportData(companyId: string, filter?: FilterParams, limit?: number): Promise<AccountingPurpose[]> {
    if (!companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('companyId', 'Company ID is required')
    const safeLimit = Math.min(limit || this.config.limits.export, this.config.limits.export)

    const conditions: string[] = ['company_id = $1']
    const params: (string | boolean | number)[] = [companyId]
    let idx = 2
    if (filter?.applied_to) { params.push(filter.applied_to); conditions.push(`applied_to = $${idx}`); idx++ }
    if (typeof filter?.is_active === 'boolean') { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    params.push(safeLimit)

    const { rows } = await pool.query(
      `SELECT * FROM accounting_purposes WHERE ${conditions.join(' AND ')} ORDER BY purpose_code ASC LIMIT $${idx}`,
      params
    )
    return rows
  }

  async getFilterOptions(companyId: string): Promise<{ applied_to_types: string[] }> {
    if (!companyId?.trim()) throw AccountingPurposeErrors.VALIDATION_ERROR('companyId', 'Company ID is required')

    const cacheKey = this.getCacheKey('filter-options', { companyId })
    const cached = this.getFromCache<{ applied_to_types: string[] }>(cacheKey)
    if (cached) return cached

    const { rows } = await pool.query('SELECT applied_to FROM accounting_purposes WHERE company_id = $1', [companyId])
    const result = { applied_to_types: [...new Set(rows.map((r: { applied_to: string }) => r.applied_to).filter(Boolean))] }
    this.setCache(cacheKey, result, 300000)
    return result
  }

  destroy(): void {
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null }
    this.cache.clear()
  }
}

export const accountingPurposesRepository = new AccountingPurposesRepository()
