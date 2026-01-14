import { supabase } from '../../../config/supabase'
import { FiscalPeriod, CreateFiscalPeriodDto, UpdateFiscalPeriodDto, FiscalPeriodFilter, SortParams } from './fiscal-periods.types'
import { FiscalPeriodErrors, FiscalPeriodError } from './fiscal-periods.errors'
import { FiscalPeriodsConfig, defaultConfig } from './fiscal-periods.config'
import { logError, logInfo, logWarn } from '../../../config/logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class FiscalPeriodsRepository {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: FiscalPeriodsConfig

  constructor(config: FiscalPeriodsConfig = defaultConfig) {
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

  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: SortParams,
    filter?: FiscalPeriodFilter
  ): Promise<{ data: FiscalPeriod[]; total: number }> {
    if (!companyId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('companyId', 'Company ID is required')
    }
    
    if (pagination.limit <= 0 || pagination.offset < 0) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('pagination', 'Invalid pagination parameters')
    }
    
    const cacheKey = this.getCacheKey('list', {
      companyId,
      page: Math.floor(pagination.offset / pagination.limit),
      limit: pagination.limit,
      sort,
      filter
    })
    const cached = this.getFromCache<{ data: FiscalPeriod[]; total: number }>(cacheKey)
    if (cached) {
      logInfo('Cache hit for findAll', { company_id: companyId })
      return cached
    }

    try {
      let query = supabase
        .from('fiscal_periods')
        .select('*')
        .eq('company_id', companyId)
      
      let countQuery = supabase
        .from('fiscal_periods')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      
      if (filter?.fiscal_year !== undefined) {
        query = query.eq('fiscal_year', filter.fiscal_year)
        countQuery = countQuery.eq('fiscal_year', filter.fiscal_year)
      }
      if (typeof filter?.is_open === 'boolean') {
        query = query.eq('is_open', filter.is_open)
        countQuery = countQuery.eq('is_open', filter.is_open)
      }
      if (filter?.period) {
        query = query.eq('period', filter.period)
        countQuery = countQuery.eq('period', filter.period)
      }
      
      if (filter?.show_deleted === true) {
        query = query.not('deleted_at', 'is', null)
        countQuery = countQuery.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
        countQuery = countQuery.is('deleted_at', null)
      }
      
      if (filter?.q) {
        const searchPattern = `%${filter.q}%`
        query = query.ilike('period', searchPattern)
      }
      
      if (sort) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      } else {
        query = query.order('period', { ascending: false })
      }
      
      const [{ data, error }, { count, error: countError }] = await Promise.all([
        query.range(pagination.offset, pagination.offset + pagination.limit - 1),
        countQuery
      ])

      if (error) {
        logError('Repository findAll error', { 
          error: error.message, 
          code: error.code,
          company_id: companyId
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('findAll', error)
      }
      
      if (countError) {
        logError('Repository count error', { 
          error: countError.message, 
          company_id: companyId 
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('count', countError)
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
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('findAll', error as Error)
    }
  }

  async findById(id: string, companyId: string): Promise<FiscalPeriod | null> {
    if (!id?.trim() || !companyId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('id_or_companyId', 'ID and Company ID are required')
    }

    const cacheKey = this.getCacheKey('detail', { id, companyId })
    const cached = this.getFromCache<FiscalPeriod>(cacheKey)
    if (cached) {
      logInfo('Cache hit for findById', { id, company_id: companyId })
      return cached
    }

    try {
      const { data, error } = await supabase
        .from('fiscal_periods')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        logError('Repository findById error', { 
          error: error.message, 
          id, 
          company_id: companyId 
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('findById', error)
      }
      
      if (data) {
        this.setCache(cacheKey, data)
        logInfo('Repository findById success', { id, company_id: companyId })
      }
      
      return data
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('findById', error as Error)
    }
  }

  async findByCompanyAndPeriod(companyId: string, period: string): Promise<FiscalPeriod | null> {
    if (!companyId?.trim() || !period?.trim()) {
      return null
    }

    const cacheKey = this.getCacheKey('period', { companyId, period })
    const cached = this.getFromCache<FiscalPeriod>(cacheKey)
    if (cached) {
      logInfo('Cache hit for findByCompanyAndPeriod', { period, company_id: companyId })
      return cached
    }
    
    try {
      const { data, error } = await supabase
        .from('fiscal_periods')
        .select('*')
        .eq('company_id', companyId)
        .eq('period', period)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        logError('Repository findByCompanyAndPeriod error', { 
          error: error.message, 
          period, 
          company_id: companyId 
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('findByCompanyAndPeriod', error)
      }
      
      if (data) {
        this.setCache(cacheKey, data, 120000)
        logInfo('Repository findByCompanyAndPeriod success', { period, company_id: companyId })
      }
      
      return data
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('findByCompanyAndPeriod', error as Error)
    }
  }

  async findByIds(companyId: string, ids: string[]): Promise<FiscalPeriod[]> {
    if (!companyId?.trim() || !Array.isArray(ids) || ids.length === 0) {
      return []
    }

    try {
      // NOTE: Result order is not guaranteed by SQL IN clause
      const { data, error } = await supabase
        .from('fiscal_periods')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .in('id', ids)

      if (error) {
        logError('Repository findByIds error', { 
          error: error.message, 
          company_id: companyId,
          ids_count: ids.length
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('findByIds', error)
      }
      
      logInfo('Repository findByIds success', { 
        company_id: companyId, 
        requested_count: ids.length,
        found_count: data?.length || 0
      })
      
      return data || []
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('findByIds', error as Error)
    }
  }

  async create(data: CreateFiscalPeriodDto & { company_id: string }, userId: string): Promise<FiscalPeriod> {
    if (!userId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('userId', 'User ID is required')
    }

    try {
      const insertData = {
        company_id: data.company_id,
        period: data.period,
        period_start: data.period_start,
        period_end: data.period_end,
        is_adjustment_allowed: data.is_adjustment_allowed,
        is_year_end: data.is_year_end,
        fiscal_year: parseInt(data.period.substring(0, 4)),
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: period, error } = await supabase
        .from('fiscal_periods')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        logError('Repository create error', { 
          error: error.message, 
          code: error.code,
          details: error.details,
          hint: error.hint,
          period: data.period,
          company_id: data.company_id,
          user_id: userId,
          full_error: JSON.stringify(error)
        })
        
        if (error.code === '23505') {
          throw FiscalPeriodErrors.PERIOD_EXISTS(data.period, data.company_id)
        }
        
        throw FiscalPeriodErrors.REPOSITORY_ERROR('create', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('period:')
      
      logInfo('Repository create success', { 
        period_id: period.id, 
        period: period.period,
        company_id: data.company_id,
        user_id: userId
      })
      
      return period
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('create', error as Error)
    }
  }

  async update(id: string, companyId: string, updates: UpdateFiscalPeriodDto & { updated_by: string }): Promise<FiscalPeriod | null> {
    if (!id?.trim() || !companyId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')
    }

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('fiscal_periods')
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
        throw FiscalPeriodErrors.REPOSITORY_ERROR('update', error)
      }
      
      if (data) {
        this.invalidateCache('list:')
        this.invalidateCache('period:')
        this.invalidateCache('detail:')
        logInfo('Repository update success', { 
          period_id: id, 
          company_id: companyId
        })
      }
      
      return data
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('update', error as Error)
    }
  }

  async closePeriod(id: string, companyId: string, userId: string, reason?: string): Promise<FiscalPeriod | null> {
    if (!id?.trim() || !companyId?.trim() || !userId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'ID, Company ID, and User ID are required')
    }

    try {
      const updateData = {
        is_open: false,
        closed_at: new Date().toISOString(),
        closed_by: userId,
        close_reason: reason || null,
        updated_at: new Date().toISOString(),
        updated_by: userId
      }

      const { data, error } = await supabase
        .from('fiscal_periods')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_open', true)
        .select()
        .maybeSingle()

      if (error) {
        logError('Repository closePeriod error', { 
          error: error.message, 
          id, 
          company_id: companyId 
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('closePeriod', error)
      }
      
      if (!data) {
        throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED()
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('period:')
      this.invalidateCache('detail:')
      logInfo('Repository closePeriod success', { period_id: id, company_id: companyId })
      
      return data
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('closePeriod', error as Error)
    }
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<void> {
    if (!id?.trim() || !companyId?.trim() || !userId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'ID, Company ID, and User ID are required')
    }

    try {
      const { error } = await supabase
        .from('fiscal_periods')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_open', true)

      if (error) {
        logError('Repository softDelete error', { 
          error: error.message, 
          id, 
          company_id: companyId 
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('softDelete', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('period:')
      this.invalidateCache('detail:')
      logInfo('Repository softDelete success', { period_id: id, company_id: companyId })
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('softDelete', error as Error)
    }
  }

  async bulkDelete(companyId: string, ids: string[], userId: string): Promise<void> {
    if (!companyId?.trim() || !Array.isArray(ids) || ids.length === 0 || !userId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Company ID, IDs array, and User ID are required')
    }

    try {
      const { error } = await supabase
        .from('fiscal_periods')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('is_open', true)
        .in('id', ids)

      if (error) {
        logError('Repository bulkDelete error', { 
          error: error.message, 
          company_id: companyId,
          ids_count: ids.length
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('bulkDelete', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('period:')
      logInfo('Repository bulkDelete success', { 
        company_id: companyId, 
        deleted_count: ids.length
      })
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('bulkDelete', error as Error)
    }
  }

  async restore(id: string, companyId: string): Promise<void> {
    if (!id?.trim() || !companyId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'ID and Company ID are required')
    }

    try {
      const { error } = await supabase
        .from('fiscal_periods')
        .update({
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .not('deleted_at', 'is', null)

      if (error) {
        logError('Repository restore error', { 
          error: error.message, 
          id, 
          company_id: companyId 
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('restore', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('period:')
      this.invalidateCache('detail:')
      logInfo('Repository restore success', { period_id: id, company_id: companyId })
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('restore', error as Error)
    }
  }

  async bulkRestore(companyId: string, ids: string[]): Promise<void> {
    if (!companyId?.trim() || !Array.isArray(ids) || ids.length === 0) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Company ID and IDs array are required')
    }

    try {
      const { error } = await supabase
        .from('fiscal_periods')
        .update({
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .not('deleted_at', 'is', null)
        .in('id', ids)

      if (error) {
        logError('Repository bulkRestore error', { 
          error: error.message, 
          company_id: companyId,
          ids_count: ids.length
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('bulkRestore', error)
      }
      
      this.invalidateCache('list:')
      this.invalidateCache('period:')
      logInfo('Repository bulkRestore success', { 
        company_id: companyId, 
        restored_count: ids.length 
      })
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('bulkRestore', error as Error)
    }
  }

  async exportData(companyId: string, filter?: FiscalPeriodFilter, limit: number = 10000): Promise<FiscalPeriod[]> {
    if (!companyId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('companyId', 'Company ID is required')
    }

    const safeLimit = Math.min(limit, this.config.limits.export)
    
    try {
      let query = supabase
        .from('fiscal_periods')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .limit(safeLimit)
      
      if (filter?.fiscal_year) {
        query = query.eq('fiscal_year', filter.fiscal_year)
      }
      if (typeof filter?.is_open === 'boolean') {
        query = query.eq('is_open', filter.is_open)
      }
      
      const { data, error } = await query.order('period', { ascending: false })
      
      if (error) {
        logError('Repository exportData error', { 
          error: error.message, 
          company_id: companyId,
          limit: safeLimit
        })
        throw FiscalPeriodErrors.REPOSITORY_ERROR('exportData', error)
      }
      
      logInfo('Repository exportData success', { 
        company_id: companyId, 
        exported_count: data?.length || 0 
      })
      
      return data || []
    } catch (error) {
      if (error instanceof FiscalPeriodError) {
        throw error
      }
      throw FiscalPeriodErrors.REPOSITORY_ERROR('exportData', error as Error)
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
    logInfo('FiscalPeriodsRepository destroyed')
  }
}

export const fiscalPeriodsRepository = new FiscalPeriodsRepository()
