import { supabase } from '../../../config/supabase'
import { ChartOfAccount, CreateChartOfAccountDTO, UpdateChartOfAccountDTO, ChartOfAccountTreeNode } from './chart-of-accounts.types'
import { logError, logInfo } from '../../../config/logger'

interface TransactionContext {
  client: any // Supabase transaction client
}

export class ChartOfAccountsRepository {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private getCacheKey(prefix: string, ...args: string[]): string {
    return `${prefix}:${args.join(':')}`
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T
    }
    this.cache.delete(key)
    return null
  }

  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  private invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  async withTransaction<T>(callback: (trx: TransactionContext) => Promise<T>): Promise<T> {
    // Note: Supabase doesn't have explicit transactions, but we can simulate with error handling
    // In a real implementation, you'd use a proper transaction-capable client
    try {
      const result = await callback({ client: supabase })
      return result
    } catch (error) {
      logError('Transaction failed', { error: (error as Error).message })
      throw error
    }
  }

  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    trx?: TransactionContext
  ): Promise<{ data: ChartOfAccount[]; total: number }> {
    const client = trx?.client || supabase
    
    // Validate company access
    if (!companyId || typeof companyId !== 'string') {
      throw new Error('Invalid company ID')
    }

    let query = client
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', companyId)
    
    let countQuery = client
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
    
    // Handle deleted records filter
    if (filter?.show_deleted) {
      query = query.not('deleted_at', 'is', null)
      countQuery = countQuery.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
      countQuery = countQuery.is('deleted_at', null)
    }
    
    if (filter) {
      if (filter.account_type) {
        query = query.eq('account_type', filter.account_type)
        countQuery = countQuery.eq('account_type', filter.account_type)
      }
      if (filter.account_subtype) {
        query = query.eq('account_subtype', filter.account_subtype)
        countQuery = countQuery.eq('account_subtype', filter.account_subtype)
      }
      if (filter.is_header !== undefined) {
        query = query.eq('is_header', filter.is_header)
        countQuery = countQuery.eq('is_header', filter.is_header)
      }
      if (filter.is_postable !== undefined) {
        query = query.eq('is_postable', filter.is_postable)
        countQuery = countQuery.eq('is_postable', filter.is_postable)
      }
      if (filter.is_active !== undefined) {
        query = query.eq('is_active', filter.is_active)
        countQuery = countQuery.eq('is_active', filter.is_active)
      }
      if (filter.parent_account_id) {
        query = query.eq('parent_account_id', filter.parent_account_id)
        countQuery = countQuery.eq('parent_account_id', filter.parent_account_id)
      }
    }
    
    if (sort) {
      const validFields = ['account_code', 'account_name', 'account_type', 'level', 'sort_order', 'created_at', 'updated_at']
      if (validFields.includes(sort.field)) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      }
    } else {
      query = query.order('level', { ascending: true }).order('sort_order', { ascending: true }).order('account_code', { ascending: true })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('No accounts found for this company')
      } else if (error.code === '42501') {
        throw new Error('Access denied to chart of accounts')
      } else {
        throw new Error('Failed to load chart of accounts')
      }
    }
    if (countError) {
      throw new Error('Failed to count chart of accounts')
    }
    
    return { data: data || [], total: count || 0 }
  }

  async search(
    companyId: string,
    searchTerm: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    trx?: TransactionContext
  ): Promise<{ data: ChartOfAccount[]; total: number }> {
    const client = trx?.client || supabase
    
    // Sanitize search term to prevent injection
    const sanitizedSearchTerm = searchTerm?.replace(/[%_\\]/g, '\\$&') || ''
    
    let query = client
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
    
    let countQuery = client
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null)
    
    if (sanitizedSearchTerm && sanitizedSearchTerm.trim()) {
      const searchPattern = `%${sanitizedSearchTerm}%`
      query = query.or(`account_name.ilike.${searchPattern},account_code.ilike.${searchPattern}`)
      countQuery = countQuery.or(`account_name.ilike.${searchPattern},account_code.ilike.${searchPattern}`)
    }
    
    if (filter) {
      if (filter.account_type) {
        query = query.eq('account_type', filter.account_type)
        countQuery = countQuery.eq('account_type', filter.account_type)
      }
      if (filter.is_active !== undefined) {
        query = query.eq('is_active', filter.is_active)
        countQuery = countQuery.eq('is_active', filter.is_active)
      }
    }
    
    if (sort) {
      const validFields = ['account_code', 'account_name', 'account_type', 'level', 'sort_order', 'created_at']
      if (validFields.includes(sort.field)) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      }
    } else {
      query = query.order('level', { ascending: true }).order('sort_order', { ascending: true }).order('account_code', { ascending: true })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])
  
    if (error) {
      logError('Repository search error', { error: error.message })
      if (error.code === 'PGRST116') {
        throw new Error('No accounts found matching your search')
      } else if (error.code === '42501') {
        throw new Error('Access denied to search accounts')
      } else {
        throw new Error('Search failed. Please try again')
      }
    }
    if (countError) {
      logError('Repository count error', { error: countError.message })
      throw new Error('Failed to count search results')
    }
    
    return { data: data || [], total: count || 0 }
  }

  async findTree(companyId: string, maxDepth?: number, filter?: any, trx?: TransactionContext): Promise<ChartOfAccountTreeNode[]> {
    const cacheKey = this.getCacheKey('tree', companyId, String(maxDepth || 'all'), JSON.stringify(filter || {}))
    const cached = this.getFromCache<ChartOfAccountTreeNode[]>(cacheKey)
    if (cached) {
      return cached
    }

    const client = trx?.client || supabase
    let query = client
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', companyId)

    // Handle deleted records filter
    if (filter?.show_deleted) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    // Only show active accounts if not showing deleted
    if (!filter?.show_deleted) {
      query = query.eq('is_active', true)
    }

    if (maxDepth && maxDepth > 0) {
      query = query.lte('level', maxDepth)
    }

    const { data, error } = await query.order('level', { ascending: true }).order('sort_order', { ascending: true }).order('account_code', { ascending: true })

    if (error) {
      logError('Failed to fetch tree data', { error: error.message, companyId })
      if (error.code === 'PGRST116') {
        throw new Error('No chart of accounts found for this company')
      } else if (error.code === '42501') {
        throw new Error('Access denied to view chart of accounts')
      } else {
        throw new Error('Failed to load chart of accounts tree')
      }
    }
    
    const tree = this.buildTreeOptimized(data || [])
    this.setCache(cacheKey, tree)
    return tree
  }

  private buildTreeOptimized(accounts: ChartOfAccount[]): ChartOfAccountTreeNode[] {
    if (accounts.length === 0) return []
    
    // Use Map for O(1) lookups instead of O(n)
    const accountMap = new Map<string, ChartOfAccountTreeNode>()
    const rootAccounts: ChartOfAccountTreeNode[] = []

    // First pass: create all nodes
    for (const account of accounts) {
      const node: ChartOfAccountTreeNode = { ...account, children: [] }
      accountMap.set(account.id, node)
    }

    // Second pass: build hierarchy
    for (const account of accounts) {
      const node = accountMap.get(account.id)!
      
      if (account.parent_account_id) {
        const parent = accountMap.get(account.parent_account_id)
        if (parent && parent.children) {
          parent.children.push(node)
        }
      } else {
        rootAccounts.push(node)
      }
    }

    // Sort children recursively
    const sortNodes = (nodes: ChartOfAccountTreeNode[]) => {
      nodes.sort((a, b) => {
        // Sort by sort_order first, then by account_code
        if (a.sort_order !== b.sort_order) {
          return (a.sort_order || 0) - (b.sort_order || 0)
        }
        return a.account_code.localeCompare(b.account_code)
      })
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortNodes(node.children)
        }
      })
    }

    sortNodes(rootAccounts)
    return rootAccounts
  }

  async create(data: CreateChartOfAccountDTO, userId: string, trx?: TransactionContext): Promise<ChartOfAccount | null> {
    const client = trx?.client || supabase
    const { data: account, error } = await client
      .from('chart_of_accounts')
      .insert({
        ...data,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logError('Repository create error', { 
        error: error.message, 
        code: error.code,
        account_code: data.account_code,
        company_id: data.company_id
      })
      throw error
    }
    
    this.invalidateCache(`tree:${data.company_id}`)
    this.invalidateCache(data.company_id)
    this.invalidateCache('tree')
    return account
  }

  async findById(id: string, trx?: TransactionContext): Promise<ChartOfAccount | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('chart_of_accounts')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByCode(companyId: string, code: string, trx?: TransactionContext): Promise<ChartOfAccount | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('account_code', code.toUpperCase())
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, updates: UpdateChartOfAccountDTO, trx?: TransactionContext): Promise<ChartOfAccount | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('chart_of_accounts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logError('Repository update error', { error: error.message, code: error.code })
      throw error
    }
    
    if (data) {
      this.invalidateCache(`tree:${data.company_id}`)
      this.invalidateCache(data.company_id)
      this.invalidateCache('tree')
    }
    return data
  }

  async delete(id: string, userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('chart_of_accounts')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async hasChildren(id: string, trx?: TransactionContext): Promise<boolean> {
    const cacheKey = this.getCacheKey('hasChildren', id)
    const cached = this.getFromCache<boolean>(cacheKey)
    if (cached !== null) {
      return cached
    }

    const client = trx?.client || supabase
    const { count, error } = await client
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('parent_account_id', id)
      .is('deleted_at', null)

    if (error) {
      logError('Failed to check children', { error: error.message, account_id: id })
      throw new Error(error.message)
    }
    
    const hasChildren = (count || 0) > 0
    this.setCache(cacheKey, hasChildren, 2 * 60 * 1000) // Cache for 2 minutes
    return hasChildren
  }

  async checkCircularReference(accountId: string, parentId: string, trx?: TransactionContext): Promise<boolean> {
    if (accountId === parentId) return true
    
    const client = trx?.client || supabase
    let currentParentId = parentId
    const visited = new Set<string>()
    
    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === accountId) {
        return true // Circular reference found
      }
      
      visited.add(currentParentId)
      
      const { data, error } = await client
        .from('chart_of_accounts')
        .select('parent_account_id')
        .eq('id', currentParentId)
        .is('deleted_at', null)
        .maybeSingle()
      
      if (error) {
        logError('Failed to check circular reference', { error: error.message })
        throw new Error(error.message)
      }
      
      currentParentId = data?.parent_account_id || null
    }
    
    return false
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('chart_of_accounts')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async bulkDelete(ids: string[], userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('chart_of_accounts')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async restore(id: string, userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('chart_of_accounts')
      .update({ 
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async bulkRestore(ids: string[], userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('chart_of_accounts')
      .update({ 
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .in('id', ids)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async exportData(companyId: string, filter?: any, limit: number = 10000): Promise<ChartOfAccount[]> {
    let query = supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .limit(limit)
    
    if (filter) {
      if (filter.account_type) query = query.eq('account_type', filter.account_type)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
    }
    
    const { data, error } = await query.order('level', { ascending: true }).order('account_code', { ascending: true })
    if (error) {
      logError('Repository export error', { error: error.message })
      throw new Error(error.message)
    }
    return data || []
  }

  async getFilterOptions(companyId: string): Promise<{ account_types: string[]; account_subtypes: string[] }> {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('account_type, account_subtype')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (error) throw new Error(error.message)

    const accountTypes = [...new Set(data?.map(item => item.account_type).filter(Boolean))]
    const accountSubtypes = [...new Set(data?.map(item => item.account_subtype).filter(Boolean))]

    return { account_types: accountTypes, account_subtypes: accountSubtypes }
  }
}

export const chartOfAccountsRepository = new ChartOfAccountsRepository()