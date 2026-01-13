import { supabase } from '../../../config/supabase'
import { AccountingPurpose, CreateAccountingPurposeDTO, UpdateAccountingPurposeDTO, FilterParams, SortParams } from './accounting-purposes.types'
import { AccountingPurposeErrors, AccountingPurposeError } from './accounting-purposes.errors'
import { AccountingPurposesConfig, defaultConfig } from './accounting-purposes.config'
import { logError, logInfo, logWarn } from '../../../config/logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class AccountingPurposesRepository {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: AccountingPurposesConfig

  constructor(config: AccountingPurposesConfig = defaultConfig) {
    this.config = config
    this.startCacheCleanup()
  }

  private startCacheCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredCache()
    }, this.config.cache.cleanupInterval)
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    let cleanedCount = 0
    
    try {
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key)
          cleanedCount++
        }
      }
      
      if (cleanedCount > 0) {
        logInfo('Cache cleanup completed', { 
          cleaned_entries: cleanedCount, 
          remaining_entries: this.cache.size 
        })
      }

      // Enforce max cache size
      if (this.cache.size > this.config.cache.maxSize) {
        const entriesToRemove = this.cache.size - this.config.cache.maxSize
        const sortedEntries = Array.from(this.cache.entries())
          .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        
        for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
          this.cache.delete(sortedEntries[i][0])
        }
        
        logWarn('Cache size limit exceeded, removed oldest entries', {
          removed_entries: entriesToRemove,
          cache_size: this.cache.size
        })
      }
    } catch (error) {
      logError('Cache cleanup failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private getCacheKey(prefix: string, params: Record<string, any>): string {
    // Sort keys to ensure consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((obj, key) => ({ ...obj, [key]: params[key] }), {})
    return `${prefix}:${JSON.stringify(sortedParams)}`
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T
    }
    if (cached) {
      this.cache.delete(key)
    }
    return null
  }

  private setCache<T>(key: string, data: T, ttl: number = this.config.cache.ttl): void {
    if (this.cache.size >= this.config.cache.maxSize) {
      this.cleanupExpiredCache()
    }
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  /**
   * Invalidates cache entries by pattern or clears all cache
   * Uses startsWith for safer pattern matching to avoid false positives
   * @param pattern Cache key prefix to invalidate (optional)
   */
  private invalidateCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(pattern))
      keysToDelete.forEach(key => this.cache.delete(key))
      logInfo('Cache invalidated by pattern', { pattern, invalidated_keys: keysToDelete.length })
    } else {
      const size = this.cache.size
      this.cache.clear()
      logInfo('Cache cleared completely', { cleared_entries: size })
    }
  }

  /**
   * Finds all accounting purposes with pagination, sorting, and filtering
   * @param companyId Company identifier
   * @param pagination Pagination parameters with limit and offset
   * @param sort Optional sort parameters (field and order)
   * @param filter Optional filter parameters (applied_to, is_active, search query)
   * @returns Promise resolving to paginated results with data array and total count
   */
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: SortParams,
    filter?: FilterParams
  ): Promise<{ data: AccountingPurpose[]; total: number }> {
    if (!companyId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('companyId', 'Company ID is required')
    }
    
    if (pagination.limit <= 0 || pagination.offset < 0) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('pagination', 'Invalid pagination parameters')
    }
    
    const cacheKey = this.getCacheKey('list', { companyId, pagination, sort, filter })
    const cached = this.getFromCache<{ data: AccountingPurpose[]; total: number }>(cacheKey)
    if (cached) {
      logInfo('Cache hit for findAll', { company_id: companyId })
      return cached
    }

    try {
      let query = supabase
        .from('accounting_purposes')
        .select('*')
        .eq('company_id', companyId)
      
      let countQuery = supabase
        .from('accounting_purposes')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      
      // Apply filters
      if (filter?.applied_to) {
        query = query.eq('applied_to', filter.applied_to)
        countQuery = countQuery.eq('applied_to', filter.applied_to)
      }
      if (typeof filter?.is_active === 'boolean') {
        query = query.eq('is_active', filter.is_active)
        countQuery = countQuery.eq('is_active', filter.is_active)
      }
      if (filter?.q) {
        const searchPattern = `%${filter.q}%`
        const searchCondition = `purpose_name.ilike.${searchPattern},purpose_code.ilike.${searchPattern}`
        query = query.or(searchCondition)
        countQuery = countQuery.or(searchCondition)
      }
      
      // Apply sorting
      if (sort) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      } else {
        query = query.order('purpose_code', { ascending: true })
      }
      
      const [{ data, error }, { count, error: countError }] = await Promise.all([
        query.range(pagination.offset, pagination.offset + pagination.limit - 1),
        countQuery
      ])

      if (error) {
        logError('Repository findAll error', { 
          error: error.message, 
          code: error.code,
          company_id: companyId,
          pagination,
          filter
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('findAll', error)
      }
      
      if (countError) {
        logError('Repository count error', { 
          error: countError.message, 
          company_id: companyId 
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('count', countError)
      }
      
      const result = { data: data || [], total: count || 0 }
      this.setCache(cacheKey, result)
      
      logInfo('Repository findAll success', { 
        company_id: companyId, 
        count: result.data.length, 
        total: result.total 
      })
      
      return result
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('findAll', error as Error)
    }
  }

  async findById(id: string, companyId: string): Promise<AccountingPurpose | null> {
    if (!id?.trim() || !companyId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('id_or_companyId', 'ID and Company ID are required')
    }

    const cacheKey = this.getCacheKey('detail', { id, companyId })
    const cached = this.getFromCache<AccountingPurpose>(cacheKey)
    if (cached) {
      logInfo('Cache hit for findById', { id, company_id: companyId })
      return cached
    }

    try {
      const { data, error } = await supabase
        .from('accounting_purposes')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) {
        logError('Repository findById error', { 
          error: error.message, 
          id, 
          company_id: companyId 
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('findById', error)
      }
      
      if (data) {
        this.setCache(cacheKey, data)
        logInfo('Repository findById success', { id, company_id: companyId })
      }
      
      return data
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('findById', error as Error)
    }
  }

  /**
   * Finds multiple accounting purposes by their IDs
   * Used for bulk operations to avoid N+1 queries
   * @param companyId Company identifier
   * @param ids Array of purpose identifiers
   * @returns Array of found purposes
   */
  async findByIds(companyId: string, ids: string[]): Promise<AccountingPurpose[]> {
    if (!companyId?.trim() || !Array.isArray(ids) || ids.length === 0) {
      return []
    }

    try {
      const { data, error } = await supabase
        .from('accounting_purposes')
        .select('*')
        .eq('company_id', companyId)
        .in('id', ids)

      if (error) {
        logError('Repository findByIds error', { 
          error: error.message, 
          company_id: companyId,
          ids_count: ids.length
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('findByIds', error)
      }
      
      logInfo('Repository findByIds success', { 
        company_id: companyId, 
        requested_count: ids.length,
        found_count: data?.length || 0
      })
      
      return data || []
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('findByIds', error as Error)
    }
  }

  async findByCode(companyId: string, code: string): Promise<AccountingPurpose | null> {
    if (!code?.trim() || !companyId?.trim()) {
      return null
    }

    const cacheKey = this.getCacheKey('code', { companyId, code })
    const cached = this.getFromCache<AccountingPurpose>(cacheKey)
    if (cached) {
      logInfo('Cache hit for findByCode', { code, company_id: companyId })
      return cached
    }
    
    try {
      const { data, error } = await supabase
        .from('accounting_purposes')
        .select('*')
        .eq('company_id', companyId)
        .eq('purpose_code', code)
        .maybeSingle()

      if (error) {
        logError('Repository findByCode error', { 
          error: error.message, 
          code, 
          company_id: companyId 
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('findByCode', error)
      }
      
      if (data) {
        this.setCache(cacheKey, data, 120000) // 2 minutes TTL
        logInfo('Repository findByCode success', { code, company_id: companyId })
      }
      
      return data
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('findByCode', error as Error)
    }
  }

  /**
   * Creates a new accounting purpose
   * Repository handles timestamps and system flags automatically
   * @param data Purpose creation data
   * @param userId User creating the purpose
   * @returns Created accounting purpose
   */
  async create(data: CreateAccountingPurposeDTO, userId: string): Promise<AccountingPurpose> {
    if (!userId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')
    }

    try {
      const insertData = {
        ...data,
        is_system: false,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: purpose, error } = await supabase
        .from('accounting_purposes')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        logError('Repository create error', { 
          error: error.message, 
          code: error.code,
          purpose_code: data.purpose_code,
          company_id: data.company_id,
          user_id: userId
        })
        
        // Handle specific database errors
        if (error.code === '23505' && error.message?.includes('purpose_code')) {
          throw AccountingPurposeErrors.CODE_EXISTS(data.purpose_code, data.company_id)
        }
        
        throw AccountingPurposeErrors.REPOSITORY_ERROR('create', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('code:')
      this.invalidateCache('filter-options:')
      
      logInfo('Repository create success', { 
        purpose_id: purpose.id, 
        purpose_code: purpose.purpose_code,
        company_id: data.company_id,
        user_id: userId
      })
      
      return purpose
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('create', error as Error)
    }
  }

  /**
   * Updates an accounting purpose
   * Repository handles updated_at timestamp automatically
   * @param id Purpose identifier
   * @param companyId Company identifier
   * @param updates Update data (updated_by should be included)
   * @returns Updated purpose or null if not found
   */
  async update(id: string, companyId: string, updates: UpdateAccountingPurposeDTO & { updated_by: string }): Promise<AccountingPurpose | null> {
    if (!id?.trim() || !companyId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')
    }

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('accounting_purposes')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .maybeSingle()

      if (error) {
        logError('Repository update error', { 
          error: error.message, 
          code: error.code,
          id,
          company_id: companyId
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('update', error)
      }
      
      if (data) {
        this.invalidateCache('list:')
        this.invalidateCache('code:')
        this.invalidateCache('detail:')
        this.invalidateCache('filter-options:')
        logInfo('Repository update success', { 
          purpose_id: id, 
          company_id: companyId
        })
      }
      
      return data
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('update', error as Error)
    }
  }

  async delete(id: string, companyId: string): Promise<void> {
    if (!id?.trim() || !companyId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')
    }

    try {
      const { error } = await supabase
        .from('accounting_purposes')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_system', false)

      if (error) {
        logError('Repository delete error', { 
          error: error.message, 
          id, 
          company_id: companyId 
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('delete', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('code:')
      this.invalidateCache('detail:')
      this.invalidateCache('filter-options:')
      logInfo('Repository delete success', { purpose_id: id, company_id: companyId })
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('delete', error as Error)
    }
  }

  /**
   * Bulk updates status of multiple accounting purposes
   * Repository handles updated_at timestamp automatically
   * @param companyId Company identifier
   * @param ids Array of purpose identifiers
   * @param updateData Update data including updated_by
   */
  async bulkUpdateStatus(companyId: string, ids: string[], updateData: { is_active: boolean; updated_by: string }): Promise<void> {
    if (!companyId?.trim() || !Array.isArray(ids) || ids.length === 0) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Company ID and IDs array are required')
    }

    if (ids.length > this.config.limits.bulkUpdate) {
      throw AccountingPurposeErrors.BULK_OPERATION_LIMIT_EXCEEDED('update', this.config.limits.bulkUpdate, ids.length)
    }

    try {
      const { error } = await supabase
        .from('accounting_purposes')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('is_system', false)
        .in('id', ids)

      if (error) {
        logError('Repository bulkUpdateStatus error', { 
          error: error.message, 
          company_id: companyId,
          ids_count: ids.length,
          is_active: updateData.is_active
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('bulkUpdateStatus', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('code:')
      logInfo('Repository bulkUpdateStatus success', { 
        company_id: companyId, 
        updated_count: ids.length,
        is_active: updateData.is_active
      })
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('bulkUpdateStatus', error as Error)
    }
  }

  async bulkDelete(companyId: string, ids: string[]): Promise<void> {
    if (!companyId?.trim() || !Array.isArray(ids) || ids.length === 0) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Company ID and IDs array are required')
    }

    if (ids.length > this.config.limits.bulkDelete) {
      throw AccountingPurposeErrors.BULK_OPERATION_LIMIT_EXCEEDED('delete', this.config.limits.bulkDelete, ids.length)
    }

    try {
      const { error } = await supabase
        .from('accounting_purposes')
        .delete()
        .eq('company_id', companyId)
        .eq('is_system', false)
        .in('id', ids)

      if (error) {
        logError('Repository bulkDelete error', { 
          error: error.message, 
          company_id: companyId,
          ids_count: ids.length
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('bulkDelete', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('code:')
      logInfo('Repository bulkDelete success', { 
        company_id: companyId, 
        deleted_count: ids.length 
      })
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('bulkDelete', error as Error)
    }
  }

  async exportData(companyId: string, filter?: FilterParams, limit: number = this.config.limits.export): Promise<AccountingPurpose[]> {
    if (!companyId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('companyId', 'Company ID is required')
    }

    const safeLimit = Math.min(limit, this.config.limits.export)
    
    try {
      let query = supabase
        .from('accounting_purposes')
        .select('*')
        .eq('company_id', companyId)
        .limit(safeLimit)
      
      if (filter?.applied_to) {
        query = query.eq('applied_to', filter.applied_to)
      }
      if (typeof filter?.is_active === 'boolean') {
        query = query.eq('is_active', filter.is_active)
      }
      
      const { data, error } = await query.order('purpose_code', { ascending: true })
      
      if (error) {
        logError('Repository exportData error', { 
          error: error.message, 
          company_id: companyId,
          limit: safeLimit
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('exportData', error)
      }
      
      logInfo('Repository exportData success', { 
        company_id: companyId, 
        exported_count: data?.length || 0 
      })
      
      return data || []
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('exportData', error as Error)
    }
  }

  async getFilterOptions(companyId: string): Promise<{ applied_to_types: string[] }> {
    if (!companyId?.trim()) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('companyId', 'Company ID is required')
    }

    const cacheKey = this.getCacheKey('filter-options', { companyId })
    const cached = this.getFromCache<{ applied_to_types: string[] }>(cacheKey)
    if (cached) {
      logInfo('Cache hit for getFilterOptions', { company_id: companyId })
      return cached
    }

    try {
      const { data, error } = await supabase
        .from('accounting_purposes')
        .select('applied_to')
        .eq('company_id', companyId)

      if (error) {
        logError('Repository getFilterOptions error', { 
          error: error.message, 
          company_id: companyId 
        })
        throw AccountingPurposeErrors.REPOSITORY_ERROR('getFilterOptions', error)
      }

      const appliedToTypes = [...new Set(data?.map(item => item.applied_to).filter(Boolean) || [])]
      const result = { applied_to_types: appliedToTypes }
      
      this.setCache(cacheKey, result, 300000) // 5 minutes TTL
      logInfo('Repository getFilterOptions success', { 
        company_id: companyId,
        types_count: appliedToTypes.length
      })

      return result
    } catch (error) {
      if (error instanceof AccountingPurposeError) {
        throw error
      }
      throw AccountingPurposeErrors.REPOSITORY_ERROR('getFilterOptions', error as Error)
    }
  }

  // Cleanup method for graceful shutdown
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
    logInfo('AccountingPurposesRepository destroyed')
  }
}

export const accountingPurposesRepository = new AccountingPurposesRepository()