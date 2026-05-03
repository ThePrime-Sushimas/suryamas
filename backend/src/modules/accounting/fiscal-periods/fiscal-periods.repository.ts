import { pool } from '../../../config/db'
import { FiscalPeriod, CreateFiscalPeriodDto, UpdateFiscalPeriodDto, FiscalPeriodFilter, SortParams } from './fiscal-periods.types'
import { FiscalPeriodErrors, FiscalPeriodError } from './fiscal-periods.errors'
import { FiscalPeriodsConfig, defaultConfig } from './fiscal-periods.config'
import { logInfo } from '../../../config/logger'

const VALID_SORT_FIELDS = ['period', 'fiscal_year', 'period_start', 'period_end', 'is_open', 'created_at']
const FP_INSERT_FIELDS = ['company_id', 'period', 'period_start', 'period_end', 'is_adjustment_allowed', 'is_year_end', 'fiscal_year', 'created_by', 'updated_by', 'created_at', 'updated_at'] as const
const FP_UPDATE_FIELDS = ['period', 'period_start', 'period_end', 'is_open', 'is_adjustment_allowed', 'is_year_end', 'closed_at', 'closed_by', 'close_reason', 'deleted_at', 'deleted_by', 'updated_by', 'updated_at'] as const

export class FiscalPeriodsRepository {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: FiscalPeriodsConfig

  constructor(config: FiscalPeriodsConfig = defaultConfig) {
    this.config = config
    this.cleanupTimer = setInterval(() => this.cleanupExpiredCache(), this.config.cache.cleanupInterval)
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    let cleaned = 0
    for (const [key, entry] of this.cache.entries()) { if (now - entry.timestamp > entry.ttl) { this.cache.delete(key); cleaned++ } }
    if (cleaned > 0) logInfo('Cache cleanup', { cleaned, remaining: this.cache.size })
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

  private buildConditions(companyId: string, filter?: FiscalPeriodFilter, search?: string) {
    const conditions: string[] = ['company_id = $1']
    const params: (string | boolean | number)[] = [companyId]
    let idx = 2

    if (filter?.show_deleted) conditions.push('deleted_at IS NOT NULL')
    else conditions.push('deleted_at IS NULL')

    if (filter?.fiscal_year !== undefined) { params.push(filter.fiscal_year); conditions.push(`fiscal_year = $${idx}`); idx++ }
    if (typeof filter?.is_open === 'boolean') { params.push(filter.is_open); conditions.push(`is_open = $${idx}`); idx++ }
    if (filter?.period) { params.push(filter.period); conditions.push(`period = $${idx}`); idx++ }
    if (filter?.q || search) {
      const term = (filter?.q || search || '').replace(/[%_\\]/g, '\\$&')
      params.push(`%${term}%`)
      conditions.push(`period ILIKE $${idx}`); idx++
    }

    return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
  }

  async findAll(companyId: string, pagination: { limit: number; offset: number }, sort?: SortParams, filter?: FiscalPeriodFilter): Promise<{ data: FiscalPeriod[]; total: number }> {
    if (!companyId?.trim()) throw FiscalPeriodErrors.VALIDATION_ERROR('companyId', 'Company ID is required')

    const cacheKey = this.getCacheKey('list', { companyId, offset: pagination.offset, limit: pagination.limit, sort, filter })
    const cached = this.getFromCache<{ data: FiscalPeriod[]; total: number }>(cacheKey)
    if (cached) return cached

    try {
      const { where, params, idx } = this.buildConditions(companyId, filter)
      const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? sort.field : (filter?.show_deleted ? 'deleted_at' : 'period')
      const sortOrder = filter?.show_deleted ? 'DESC' : (sort?.order === 'asc' ? 'ASC' : 'DESC')

      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM fiscal_periods ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM fiscal_periods ${where}`, params)
      ])

      const result = { data: dataRes.rows, total: countRes.rows[0].total }
      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      if (error instanceof FiscalPeriodError) throw error
      throw FiscalPeriodErrors.REPOSITORY_ERROR('findAll', (error as Error).message)
    }
  }

  async findById(id: string, companyId: string): Promise<FiscalPeriod | null> {
    if (!id?.trim() || !companyId?.trim()) throw FiscalPeriodErrors.VALIDATION_ERROR('id_or_companyId', 'ID and Company ID are required')

    const cacheKey = this.getCacheKey('detail', { id, companyId })
    const cached = this.getFromCache<FiscalPeriod>(cacheKey)
    if (cached) return cached

    const { rows } = await pool.query('SELECT * FROM fiscal_periods WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId])
    if (rows[0]) this.setCache(cacheKey, rows[0])
    return rows[0] ?? null
  }

  async findByCompanyAndPeriod(companyId: string, period: string): Promise<FiscalPeriod | null> {
    if (!companyId?.trim() || !period?.trim()) return null
    const cacheKey = this.getCacheKey('period', { companyId, period })
    const cached = this.getFromCache<FiscalPeriod>(cacheKey)
    if (cached) return cached

    const { rows } = await pool.query('SELECT * FROM fiscal_periods WHERE company_id = $1 AND period = $2 AND deleted_at IS NULL', [companyId, period])
    if (rows[0]) this.setCache(cacheKey, rows[0], 120000)
    return rows[0] ?? null
  }

  async findByDate(companyId: string, date: string): Promise<FiscalPeriod | null> {
    if (!companyId?.trim() || !date?.trim()) return null
    const cacheKey = this.getCacheKey('period_by_date', { companyId, date })
    const cached = this.getFromCache<FiscalPeriod>(cacheKey)
    if (cached) return cached

    const { rows } = await pool.query(
      'SELECT * FROM fiscal_periods WHERE company_id = $1 AND period_start <= $2 AND period_end >= $2 AND deleted_at IS NULL',
      [companyId, date]
    )
    if (rows[0]) this.setCache(cacheKey, rows[0])
    return rows[0] ?? null
  }

  async findByIds(companyId: string, ids: string[]): Promise<FiscalPeriod[]> {
    if (!companyId?.trim() || !ids?.length) return []
    const { rows } = await pool.query('SELECT * FROM fiscal_periods WHERE company_id = $1 AND deleted_at IS NULL AND id = ANY($2::uuid[])', [companyId, ids])
    return rows
  }

  async findAnyByCompanyAndPeriod(companyId: string, period: string): Promise<FiscalPeriod | null> {
    if (!companyId?.trim() || !period?.trim()) return null
    const { rows } = await pool.query('SELECT * FROM fiscal_periods WHERE company_id = $1 AND period = $2 ORDER BY created_at DESC LIMIT 1', [companyId, period])
    return rows[0] ?? null
  }

  async restoreWithUpdate(id: string, companyId: string, updates: UpdateFiscalPeriodDto & { updated_by: string }): Promise<FiscalPeriod> {
    const fullUpdates: Record<string, unknown> = { ...updates, deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() }
    const keys = FP_UPDATE_FIELDS.filter(k => fullUpdates[k] !== undefined)
    const values = keys.map(k => fullUpdates[k])
    const { rows } = await pool.query(
      `UPDATE fiscal_periods SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2} RETURNING *`,
      [...values, id, companyId]
    )
    this.invalidateCache()
    return rows[0]
  }

  async create(data: CreateFiscalPeriodDto & { company_id: string }, userId: string): Promise<FiscalPeriod> {
    if (!userId?.trim()) throw FiscalPeriodErrors.VALIDATION_ERROR('userId', 'User ID is required')
    try {
      const insertData: Record<string, unknown> = {
        company_id: data.company_id, period: data.period, period_start: data.period_start, period_end: data.period_end,
        is_adjustment_allowed: data.is_adjustment_allowed, is_year_end: data.is_year_end,
        fiscal_year: parseInt(data.period.substring(0, 4)),
        created_by: userId, updated_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }
      const keys = FP_INSERT_FIELDS.filter(k => insertData[k] !== undefined)
      const values = keys.map(k => insertData[k])
      const { rows } = await pool.query(
        `INSERT INTO fiscal_periods (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        values
      )
      this.invalidateCache()
      logInfo('Fiscal period created', { period_id: rows[0].id, period: rows[0].period })
      return rows[0]
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') throw FiscalPeriodErrors.PERIOD_EXISTS(data.period, data.company_id)
      if (error instanceof FiscalPeriodError) throw error
      throw FiscalPeriodErrors.REPOSITORY_ERROR('create', (error as Error).message)
    }
  }

  async update(id: string, companyId: string, updates: UpdateFiscalPeriodDto & { updated_by: string }): Promise<FiscalPeriod | null> {
    const fullUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
    const keys = FP_UPDATE_FIELDS.filter(k => fullUpdates[k] !== undefined)
    const values = keys.map(k => fullUpdates[k])
    const { rows } = await pool.query(
      `UPDATE fiscal_periods SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2} RETURNING *`,
      [...values, id, companyId]
    )
    if (rows[0]) this.invalidateCache()
    return rows[0] ?? null
  }

  async closePeriod(id: string, companyId: string, userId: string, reason?: string): Promise<FiscalPeriod | null> {
    const { rows } = await pool.query(
      'UPDATE fiscal_periods SET is_open = false, closed_at = NOW(), closed_by = $1, close_reason = $2, updated_at = NOW(), updated_by = $1 WHERE id = $3 AND company_id = $4 AND is_open = true RETURNING *',
      [userId, reason || null, id, companyId]
    )
    if (!rows[0]) throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED()
    this.invalidateCache()
    return rows[0]
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<void> {
    await pool.query(
      'UPDATE fiscal_periods SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 AND is_open = true',
      [userId, id, companyId]
    )
    this.invalidateCache()
  }

  async bulkDelete(companyId: string, ids: string[], userId: string): Promise<void> {
    await pool.query(
      'UPDATE fiscal_periods SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE company_id = $2 AND is_open = true AND id = ANY($3::uuid[])',
      [userId, companyId, ids]
    )
    this.invalidateCache()
  }

  async restore(id: string, companyId: string): Promise<void> {
    await pool.query(
      'UPDATE fiscal_periods SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NOT NULL',
      [id, companyId]
    )
    this.invalidateCache()
  }

  async bulkRestore(companyId: string, ids: string[]): Promise<void> {
    await pool.query(
      'UPDATE fiscal_periods SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE company_id = $1 AND deleted_at IS NOT NULL AND id = ANY($2::uuid[])',
      [companyId, ids]
    )
    this.invalidateCache()
  }

  async exportData(companyId: string, filter?: FiscalPeriodFilter, limit = 10000): Promise<FiscalPeriod[]> {
    const safeLimit = Math.min(limit, this.config.limits.export)
    const conditions: string[] = ['company_id = $1', 'deleted_at IS NULL']
    const params: (string | boolean | number)[] = [companyId]
    let idx = 2
    if (filter?.fiscal_year) { params.push(filter.fiscal_year); conditions.push(`fiscal_year = $${idx}`); idx++ }
    if (typeof filter?.is_open === 'boolean') { params.push(filter.is_open); conditions.push(`is_open = $${idx}`); idx++ }
    params.push(safeLimit)
    const { rows } = await pool.query(`SELECT * FROM fiscal_periods WHERE ${conditions.join(' AND ')} ORDER BY period DESC LIMIT $${idx}`, params)
    return rows
  }

  // ============================================================================
  // FISCAL CLOSING QUERIES
  // ============================================================================

  /**
   * Get Revenue & Expense account balances for a period (POSTED journals only)
   */
  async getRevenueExpenseSummary(companyId: string, periodStart: string, periodEnd: string): Promise<{
    accounts: Array<{ account_id: string; account_code: string; account_name: string; account_type: string; total_debit: number; total_credit: number }>
    posted_count: number
    pending_count: number
  }> {
    const [accountsRes, postedRes, pendingRes] = await Promise.all([
      pool.query(
        `SELECT glv.account_id, glv.account_code, glv.account_name, glv.account_type,
                SUM(glv.debit_amount)::numeric AS total_debit,
                SUM(glv.credit_amount)::numeric AS total_credit
         FROM general_ledger_view glv
         WHERE glv.company_id = $1
           AND glv.account_type IN ('REVENUE', 'EXPENSE')
           AND glv.journal_date >= $2::date
           AND glv.journal_date <= $3::date
           AND (glv.source_module IS NULL OR glv.source_module != 'FISCAL_CLOSING')
         GROUP BY glv.account_id, glv.account_code, glv.account_name, glv.account_type
         HAVING SUM(glv.debit_amount) != 0 OR SUM(glv.credit_amount) != 0
         ORDER BY glv.account_code`,
        [companyId, periodStart, periodEnd]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT jh.id)::int AS count FROM journal_headers jh
         WHERE jh.company_id = $1 AND jh.status = 'POSTED' AND jh.deleted_at IS NULL
           AND jh.journal_date >= $2::date AND jh.journal_date <= $3::date`,
        [companyId, periodStart, periodEnd]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT jh.id)::int AS count FROM journal_headers jh
         WHERE jh.company_id = $1 AND jh.status IN ('DRAFT', 'SUBMITTED', 'APPROVED') AND jh.deleted_at IS NULL
           AND jh.journal_date >= $2::date AND jh.journal_date <= $3::date`,
        [companyId, periodStart, periodEnd]
      ),
    ])

    return {
      accounts: accountsRes.rows.map(r => ({
        account_id: r.account_id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,
        total_debit: Number(r.total_debit),
        total_credit: Number(r.total_credit),
      })),
      posted_count: postedRes.rows[0].count,
      pending_count: pendingRes.rows[0].count,
    }
  }

  /**
   * Check if a closing journal already exists for a period
   */
  async hasClosingJournal(companyId: string, period: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM journal_headers
       WHERE company_id = $1 AND period = $2 AND source_module = 'FISCAL_CLOSING' AND deleted_at IS NULL
       LIMIT 1`,
      [companyId, period]
    )
    return rows.length > 0
  }

  /**
   * Get default Retained Earnings account (310202 - RE current period)
   */
  async getDefaultRetainedEarningsAccount(companyId: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM chart_of_accounts
       WHERE company_id = $1 AND account_code = '310202' AND is_active = true AND deleted_at IS NULL
       LIMIT 1`,
      [companyId]
    )
    return rows[0]?.id || null
  }

  destroy(): void {
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null }
    this.cache.clear()
  }
}

export const fiscalPeriodsRepository = new FiscalPeriodsRepository()
