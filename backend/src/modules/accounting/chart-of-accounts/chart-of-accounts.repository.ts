import { pool } from '../../../config/db'
import { ChartOfAccount, CreateChartOfAccountDTO, UpdateChartOfAccountDTO, ChartOfAccountTreeNode } from './chart-of-accounts.types'

const VALID_SORT_FIELDS = ['account_code', 'account_name', 'account_type', 'level', 'sort_order', 'created_at', 'updated_at']

export interface CoaFilter {
  account_type?: string; account_subtype?: string; is_header?: boolean;
  is_postable?: boolean; is_active?: boolean; parent_account_id?: string; show_deleted?: boolean
}

const COA_INSERT_FIELDS = ['company_id', 'branch_id', 'account_code', 'account_name', 'account_type', 'account_subtype', 'parent_account_id', 'level', 'sort_order', 'is_header', 'is_postable', 'is_active', 'normal_balance', 'currency_code', 'description', 'created_by', 'updated_by', 'created_at', 'updated_at'] as const
const COA_UPDATE_FIELDS = ['account_name', 'account_type', 'account_subtype', 'parent_account_id', 'level', 'sort_order', 'is_header', 'is_postable', 'is_active', 'normal_balance', 'currency_code', 'description', 'updated_by', 'updated_at'] as const

export class ChartOfAccountsRepository {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) return cached.data as T
    this.cache.delete(key); return null
  }
  private setCache<T>(key: string, data: T, ttl = this.CACHE_TTL): void { this.cache.set(key, { data, timestamp: Date.now(), ttl }) }
  private invalidateCache(pattern?: string): void {
    if (pattern) { for (const key of this.cache.keys()) { if (key.includes(pattern)) this.cache.delete(key) } }
    else this.cache.clear()
  }

  private buildConditions(companyId: string, filter?: CoaFilter, search?: string) {
    const conditions: string[] = ['company_id = $1']
    const params: (string | boolean)[] = [companyId]
    let idx = 2

    if (filter?.show_deleted) { conditions.push('deleted_at IS NOT NULL') }
    else { conditions.push('deleted_at IS NULL') }

    if (filter?.account_type) { params.push(filter.account_type); conditions.push(`account_type = $${idx}`); idx++ }
    if (filter?.account_subtype) { params.push(filter.account_subtype); conditions.push(`account_subtype = $${idx}`); idx++ }
    if (filter?.is_header !== undefined) { params.push(filter.is_header); conditions.push(`is_header = $${idx}`); idx++ }
    if (filter?.is_postable !== undefined) { params.push(filter.is_postable); conditions.push(`is_postable = $${idx}`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    if (filter?.parent_account_id) { params.push(filter.parent_account_id); conditions.push(`parent_account_id = $${idx}`); idx++ }
    if (search) { params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`); conditions.push(`(account_name ILIKE $${idx} OR account_code ILIKE $${idx})`); idx++ }

    return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
  }

  async findAll(companyId: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: CoaFilter): Promise<{ data: ChartOfAccount[]; total: number }> {
    const { where, params, idx } = this.buildConditions(companyId, filter)
    const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? sort.field : 'account_code'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM chart_of_accounts ${where} ORDER BY ${sortField} ${sortOrder}, id ASC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM chart_of_accounts ${where}`, params)
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(companyId: string, searchTerm: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: CoaFilter): Promise<{ data: ChartOfAccount[]; total: number }> {
    const { where, params, idx } = this.buildConditions(companyId, { ...filter, show_deleted: false }, searchTerm)
    const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? sort.field : 'level'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'
    const extraOrder = sortField === 'level' ? ', sort_order ASC, account_code ASC' : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM chart_of_accounts ${where} ORDER BY ${sortField} ${sortOrder}${extraOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM chart_of_accounts ${where}`, params)
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findTree(companyId: string, maxDepth?: number, filter?: CoaFilter): Promise<ChartOfAccountTreeNode[]> {
    const cacheKey = `tree:${companyId}:${maxDepth || 'all'}:${JSON.stringify(filter || {})}`
    const cached = this.getFromCache<ChartOfAccountTreeNode[]>(cacheKey)
    if (cached) return cached

    const conditions: string[] = ['company_id = $1']
    const params: (string | boolean | number)[] = [companyId]
    let idx = 2

    if (filter?.show_deleted) { conditions.push('deleted_at IS NOT NULL') }
    else { conditions.push('deleted_at IS NULL'); conditions.push('is_active = true') }

    if (maxDepth && maxDepth > 0) { params.push(maxDepth); conditions.push(`level <= $${idx}`); idx++ }

    const { rows } = await pool.query(
      `SELECT * FROM chart_of_accounts WHERE ${conditions.join(' AND ')} ORDER BY level ASC, sort_order ASC, account_code ASC`,
      params
    )

    const tree = this.buildTreeOptimized(rows)
    this.setCache(cacheKey, tree)
    return tree
  }

  private buildTreeOptimized(accounts: ChartOfAccount[]): ChartOfAccountTreeNode[] {
    if (!accounts.length) return []
    const accountMap = new Map<string, ChartOfAccountTreeNode>()
    const roots: ChartOfAccountTreeNode[] = []

    for (const a of accounts) accountMap.set(a.id, { ...a, children: [] })
    for (const a of accounts) {
      const node = accountMap.get(a.id)!
      if (a.parent_account_id) { accountMap.get(a.parent_account_id)?.children?.push(node) }
      else roots.push(node)
    }

    const sortNodes = (nodes: ChartOfAccountTreeNode[]) => {
      nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.account_code.localeCompare(b.account_code))
      nodes.forEach(n => { if (n.children?.length) sortNodes(n.children) })
    }
    sortNodes(roots)
    return roots
  }

  async create(data: CreateChartOfAccountDTO, userId: string): Promise<ChartOfAccount | null> {
    const now = new Date().toISOString()
    const insertData: Record<string, unknown> = { ...data, created_by: userId, updated_by: userId, created_at: now, updated_at: now }
    const keys = COA_INSERT_FIELDS.filter(k => insertData[k] !== undefined)
    const values = keys.map(k => insertData[k])
    const { rows } = await pool.query(
      `INSERT INTO chart_of_accounts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    this.invalidateCache(`tree:${data.company_id}`)
    this.invalidateCache(data.company_id)
    return rows[0]
  }

  async findById(id: string): Promise<ChartOfAccount | null> {
    const { rows } = await pool.query('SELECT * FROM chart_of_accounts WHERE id = $1', [id])
    return rows[0] ?? null
  }

  async findByIds(ids: string[]): Promise<ChartOfAccount[]> {
    if (!ids.length) return []
    const { rows } = await pool.query('SELECT * FROM chart_of_accounts WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL', [ids])
    return rows
  }

  async validateMany(accountIds: string[], companyId: string, requirePostable = true): Promise<Map<string, { valid: boolean; account?: ChartOfAccount; error?: string }>> {
    if (!accountIds.length) return new Map()
    const accounts = await this.findByIds(accountIds)
    const accountMap = new Map(accounts.map(a => [a.id, a]))
    const result = new Map<string, { valid: boolean; account?: ChartOfAccount; error?: string }>()

    for (const id of accountIds) {
      const account = accountMap.get(id)
      if (!account) { result.set(id, { valid: false, error: 'Account not found' }); continue }
      if (account.company_id !== companyId) { result.set(id, { valid: false, error: 'Account does not belong to this company' }); continue }
      if (!account.is_active) { result.set(id, { valid: false, error: 'Account is not active' }); continue }
      if (requirePostable && !account.is_postable) { result.set(id, { valid: false, error: `Account ${account.account_code} is not postable` }); continue }
      result.set(id, { valid: true, account })
    }
    return result
  }

  async findByCode(companyId: string, code: string): Promise<ChartOfAccount | null> {
    const { rows } = await pool.query('SELECT * FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 AND deleted_at IS NULL', [companyId, code.toUpperCase()])
    return rows[0] ?? null
  }

  async update(id: string, updates: UpdateChartOfAccountDTO): Promise<ChartOfAccount | null> {
    const fullUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
    const keys = COA_UPDATE_FIELDS.filter(k => fullUpdates[k] !== undefined)
    if (!keys.length) return this.findById(id)
    const values = keys.map(k => fullUpdates[k])
    const { rows } = await pool.query(
      `UPDATE chart_of_accounts SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    if (rows[0]) {
      this.invalidateCache(`tree:${rows[0].company_id}`)
      this.invalidateCache(rows[0].company_id)
    }
    return rows[0] ?? null
  }

  async delete(id: string, userId: string): Promise<void> {
    await pool.query('UPDATE chart_of_accounts SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2', [userId, id])
    this.invalidateCache()
  }

  async hasChildren(id: string): Promise<boolean> {
    const cacheKey = `hasChildren:${id}`
    const cached = this.getFromCache<boolean>(cacheKey)
    if (cached !== null) return cached
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM chart_of_accounts WHERE parent_account_id = $1 AND deleted_at IS NULL', [id])
    const result = rows[0].cnt > 0
    this.setCache(cacheKey, result, 2 * 60 * 1000)
    return result
  }

  async checkCircularReference(accountId: string, parentId: string): Promise<boolean> {
    if (accountId === parentId) return true
    let currentParentId: string | null = parentId
    const visited = new Set<string>()

    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === accountId) return true
      visited.add(currentParentId)
      const res: { rows: Array<{ parent_account_id: string | null }> } = await pool.query('SELECT parent_account_id FROM chart_of_accounts WHERE id = $1 AND deleted_at IS NULL', [currentParentId])
      currentParentId = res.rows[0]?.parent_account_id ?? null
    }
    return false
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean): Promise<void> {
    await pool.query('UPDATE chart_of_accounts SET is_active = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])', [isActive, ids])
    this.invalidateCache()
  }

  async bulkDelete(ids: string[], userId: string): Promise<void> {
    await pool.query('UPDATE chart_of_accounts SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])', [userId, ids])
    this.invalidateCache()
  }

  async restore(id: string, userId: string): Promise<void> {
    await pool.query('UPDATE chart_of_accounts SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2', [userId, id])
    this.invalidateCache()
  }

  async bulkRestore(ids: string[], userId: string): Promise<void> {
    await pool.query('UPDATE chart_of_accounts SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW(), updated_by = $1 WHERE id = ANY($2::uuid[])', [userId, ids])
    this.invalidateCache()
  }

  async exportData(companyId: string, filter?: { account_type?: string; is_active?: boolean }, limit = 10000): Promise<ChartOfAccount[]> {
    const conditions: string[] = ['company_id = $1', 'deleted_at IS NULL']
    const params: (string | boolean | number)[] = [companyId]
    let idx = 2
    if (filter?.account_type) { params.push(filter.account_type); conditions.push(`account_type = $${idx}`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    const { rows } = await pool.query(`SELECT * FROM chart_of_accounts WHERE ${conditions.join(' AND ')} ORDER BY level ASC, account_code ASC LIMIT $${idx}`, [...params, limit])
    return rows
  }

  async getFilterOptions(companyId: string): Promise<{ account_types: string[]; account_subtypes: string[] }> {
    const { rows } = await pool.query('SELECT account_type, account_subtype FROM chart_of_accounts WHERE company_id = $1 AND deleted_at IS NULL', [companyId])
    return {
      account_types: [...new Set(rows.map((r: { account_type: string }) => r.account_type).filter(Boolean))],
      account_subtypes: [...new Set(rows.map((r: { account_subtype: string }) => r.account_subtype).filter(Boolean))],
    }
  }
}

export const chartOfAccountsRepository = new ChartOfAccountsRepository()
