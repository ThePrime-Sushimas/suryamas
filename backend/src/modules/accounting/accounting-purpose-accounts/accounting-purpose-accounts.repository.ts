import { pool } from '../../../config/db'
import { AccountingPurposeAccount, CreateAccountingPurposeAccountDTO, UpdateAccountingPurposeAccountDTO, AccountingPurposeAccountWithDetails } from './accounting-purpose-accounts.types'
import { logError } from '../../../config/logger'

interface FilterParams {
  purpose_id?: string; side?: string; is_required?: boolean; is_active?: boolean; account_type?: string
}

const VALID_SORT_FIELDS = ['priority', 'side', 'created_at', 'updated_at', 'is_active', 'is_required']
const DETAIL_SELECT = `
  apa.*, ap.purpose_name, ap.purpose_code,
  coa.account_code, coa.account_name, coa.account_type, coa.normal_balance
`
const DETAIL_FROM = `
  FROM accounting_purpose_accounts apa
  JOIN accounting_purposes ap ON ap.id = apa.purpose_id
  JOIN chart_of_accounts coa ON coa.id = apa.account_id
`
const APA_INSERT_FIELDS = ['purpose_id', 'account_id', 'company_id', 'side', 'priority', 'is_required', 'is_auto', 'is_active', 'created_by', 'updated_by', 'created_at', 'updated_at'] as const
const APA_UPDATE_FIELDS = ['side', 'priority', 'is_required', 'is_auto', 'is_active', 'updated_by', 'updated_at', 'deleted_at', 'deleted_by'] as const

export class AccountingPurposeAccountsRepository {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private getFromCache<T>(key: string): T | null {
    const c = this.cache.get(key); if (c && Date.now() - c.timestamp < c.ttl) return c.data as T; if (c) this.cache.delete(key); return null
  }
  private setCache<T>(key: string, data: T, ttl = this.CACHE_TTL): void { this.cache.set(key, { data, timestamp: Date.now(), ttl }) }
  private invalidateCache(): void { this.cache.clear() }

  private buildConditions(companyId: string, filter?: FilterParams, deleted = false) {
    const conditions: string[] = ['apa.company_id = $1']
    const params: (string | boolean)[] = [companyId]
    let idx = 2

    if (deleted) conditions.push('apa.deleted_at IS NOT NULL')
    else conditions.push('apa.deleted_at IS NULL')

    if (filter?.purpose_id) { params.push(filter.purpose_id); conditions.push(`apa.purpose_id = $${idx}`); idx++ }
    if (filter?.side) { params.push(filter.side); conditions.push(`apa.side = $${idx}`); idx++ }
    if (filter?.is_required !== undefined) { params.push(filter.is_required); conditions.push(`apa.is_required = $${idx}`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`apa.is_active = $${idx}`); idx++ }
    if (filter?.account_type) { params.push(filter.account_type); conditions.push(`coa.account_type = $${idx}`); idx++ }

    return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
  }

  async findAll(companyId: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: FilterParams): Promise<{ data: AccountingPurposeAccountWithDetails[]; total: number }> {
    const { where, params, idx } = this.buildConditions(companyId, filter)
    const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? `apa.${sort.field}` : 'apa.priority'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'
    const extraOrder = sortField === 'apa.priority' ? ', apa.side ASC' : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY ${sortField} ${sortOrder}${extraOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${DETAIL_FROM} ${where}`, params)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findDeleted(companyId: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: FilterParams): Promise<{ data: AccountingPurposeAccountWithDetails[]; total: number }> {
    const { where, params, idx } = this.buildConditions(companyId, filter, true)
    const validDeletedSort = ['deleted_at', 'priority', 'side', 'created_at']
    const sortField = sort?.field && validDeletedSort.includes(sort.field) ? `apa.${sort.field}` : 'apa.deleted_at'
    const sortOrder = sort?.order === 'asc' ? 'ASC' : 'DESC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${DETAIL_FROM} ${where}`, params)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string): Promise<AccountingPurposeAccount | null> {
    const { rows } = await pool.query('SELECT * FROM accounting_purpose_accounts WHERE id = $1', [id])
    return rows[0] ?? null
  }

  async findByPurposeAndAccount(purposeId: string, accountId: string, side: string): Promise<AccountingPurposeAccount | null> {
    const { rows } = await pool.query(
      'SELECT * FROM accounting_purpose_accounts WHERE purpose_id = $1 AND account_id = $2 AND side = $3',
      [purposeId, accountId, side]
    )
    return rows[0] ?? null
  }

  async getNextPriority(purposeId: string, side: string): Promise<number> {
    const { rows } = await pool.query(
      'SELECT priority FROM accounting_purpose_accounts WHERE purpose_id = $1 AND side = $2 ORDER BY priority DESC LIMIT 1',
      [purposeId, side]
    )
    return rows.length > 0 ? rows[0].priority + 1 : 1
  }

  async create(data: CreateAccountingPurposeAccountDTO, companyId: string, userId: string): Promise<AccountingPurposeAccount | null> {
    const now = new Date().toISOString()
    const priority = data.priority || await this.getNextPriority(data.purpose_id, data.side)
    const insertData: Record<string, unknown> = {
      ...data, company_id: companyId, priority, is_required: data.is_required ?? true,
      is_auto: data.is_auto ?? true, created_by: userId, updated_by: userId, created_at: now, updated_at: now
    }
    const keys = APA_INSERT_FIELDS.filter(k => insertData[k] !== undefined)
    const values = keys.map(k => insertData[k])

    const { rows } = await pool.query(
      `INSERT INTO accounting_purpose_accounts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    this.invalidateCache()
    return rows[0]
  }

  async update(id: string, updates: UpdateAccountingPurposeAccountDTO): Promise<AccountingPurposeAccount | null> {
    const fullUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
    const keys = APA_UPDATE_FIELDS.filter(k => fullUpdates[k] !== undefined)
    if (!keys.length) return this.findById(id)
    const values = keys.map(k => fullUpdates[k])

    const { rows } = await pool.query(
      `UPDATE accounting_purpose_accounts SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    if (rows[0]) this.invalidateCache()
    return rows[0] ?? null
  }

  async delete(id: string, userId: string): Promise<void> {
    await pool.query('UPDATE accounting_purpose_accounts SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2', [userId, id])
    this.invalidateCache()
  }

  async bulkCreate(
    purposeId: string,
    accounts: Array<{ account_id: string; side: 'DEBIT' | 'CREDIT'; is_required?: boolean; is_auto?: boolean; priority?: number }>,
    companyId: string, userId: string
  ): Promise<AccountingPurposeAccount[]> {
    if (!accounts.length) return []
    const now = new Date().toISOString()
    const prepared = await Promise.all(accounts.map(async (a) => ({
      purpose_id: purposeId, account_id: a.account_id, company_id: companyId, side: a.side,
      priority: a.priority || await this.getNextPriority(purposeId, a.side),
      is_required: a.is_required ?? true, is_auto: a.is_auto ?? true,
      created_by: userId, updated_by: userId, created_at: now, updated_at: now
    })))

    const keys = [...APA_INSERT_FIELDS]
    const placeholders = prepared.map((_, i) => `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`).join(', ')
    const values = prepared.flatMap(p => keys.map(k => (p as Record<string, unknown>)[k] ?? null))

    const { rows } = await pool.query(`INSERT INTO accounting_purpose_accounts (${keys.join(', ')}) VALUES ${placeholders} RETURNING *`, values)
    this.invalidateCache()
    return rows
  }

  async bulkRemove(purposeId: string, accountIds: string[], userId: string): Promise<void> {
    await pool.query(
      'UPDATE accounting_purpose_accounts SET deleted_at = NOW(), deleted_by = $1 WHERE purpose_id = $2 AND account_id = ANY($3::uuid[])',
      [userId, purposeId, accountIds]
    )
    this.invalidateCache()
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean): Promise<void> {
    await pool.query('UPDATE accounting_purpose_accounts SET is_active = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])', [isActive, ids])
    this.invalidateCache()
  }

  async exportData(companyId: string, filter?: FilterParams, limit = 10000): Promise<AccountingPurposeAccountWithDetails[]> {
    const { where, params } = this.buildConditions(companyId, filter)
    const { rows } = await pool.query(
      `SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY apa.priority ASC LIMIT $${params.length + 1}`,
      [...params, limit]
    )
    return rows
  }

  async restore(id: string, userId: string): Promise<void> {
    await pool.query('UPDATE accounting_purpose_accounts SET deleted_at = NULL, deleted_by = NULL, updated_by = $1, updated_at = NOW() WHERE id = $2', [userId, id])
    this.invalidateCache()
  }

  async findCoaAccount(accountId: string, companyId: string): Promise<{ id: string; account_code: string; account_type: string; normal_balance: string; is_postable: boolean } | null> {
    const { rows } = await pool.query(
      'SELECT id, account_code, account_type, normal_balance, is_postable FROM chart_of_accounts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [accountId, companyId]
    )
    return rows[0] ?? null
  }

  async findCoaAccountById(accountId: string): Promise<{ account_type: string; normal_balance: string } | null> {
    const { rows } = await pool.query('SELECT account_type, normal_balance FROM chart_of_accounts WHERE id = $1', [accountId])
    return rows[0] ?? null
  }

  async purposeExists(purposeId: string, companyId: string): Promise<boolean> {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM accounting_purposes WHERE id = $1 AND company_id = $2 AND (is_deleted IS NULL OR is_deleted = false)",
      [purposeId, companyId]
    )
    return rows[0].cnt > 0
  }

  async findPurposeByCode(purposeCode: string, companyId: string): Promise<{ id: string } | null> {
    const { rows } = await pool.query(
      'SELECT id FROM accounting_purposes WHERE purpose_code = $1 AND company_id = $2',
      [purposeCode, companyId]
    )
    return rows[0] ?? null
  }
}

export const accountingPurposeAccountsRepository = new AccountingPurposeAccountsRepository()
