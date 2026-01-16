/**
 * POS Imports Repository
 * Following journal-headers.repository.ts pattern
 */

import { supabase } from '../../../config/supabase'
import { logInfo, logError } from '../../../config/logger'
import { PosImportErrors } from '../shared/pos-import.errors'
import type { 
  PosImport, 
  CreatePosImportDto, 
  UpdatePosImportDto,
  PosImportFilter 
} from './pos-imports.types'
import type { PaginationParams, SortParams } from '../../../types/request.types'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface PosImportsConfig {
  cacheTTL: number
  maxCacheSize: number
  cleanupInterval: number
}

const defaultConfig: PosImportsConfig = {
  cacheTTL: 5 * 60 * 1000,
  maxCacheSize: 100,
  cleanupInterval: 10 * 60 * 1000
}

export class PosImportsRepository {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: PosImportsConfig

  constructor(config: PosImportsConfig = defaultConfig) {
    this.config = config
    this.startCacheCleanup()
  }

  private getCacheKey(prefix: string, params: Record<string, any>): string {
    return `${prefix}:${JSON.stringify(params)}`
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL
    })
  }

  private invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  private startCacheCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key)
        }
      }
    }, this.config.cleanupInterval)
  }

  async findAll(
    companyId: string,
    pagination: PaginationParams,
    sort?: SortParams,
    filter?: PosImportFilter
  ): Promise<{ data: PosImport[]; total: number }> {
    try {
      const cacheKey = this.getCacheKey('list', { companyId, pagination, sort, filter })
      const cached = this.getFromCache<{ data: PosImport[]; total: number }>(cacheKey)
      if (cached) return cached

      let query = supabase
        .from('pos_imports')
        .select('*, branches(name)', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('is_deleted', false)

      if (filter?.branch_id) {
        query = query.eq('branch_id', filter.branch_id)
      }

      if (filter?.status) {
        query = query.eq('status', filter.status)
      }

      if (filter?.date_from) {
        query = query.gte('date_range_start', filter.date_from)
      }

      if (filter?.date_to) {
        query = query.lte('date_range_end', filter.date_to)
      }

      if (filter?.search) {
        query = query.ilike('file_name', `%${filter.search}%`)
      }

      if (sort?.field && sort?.order) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      query = query.range(
        (pagination.page - 1) * pagination.limit,
        pagination.page * pagination.limit - 1
      )

      const { data, error, count } = await query

      if (error) throw error

      const result = { data: data || [], total: count || 0 }
      this.setCache(cacheKey, result)

      logInfo('PosImportsRepository findAll success', {
        company_id: companyId,
        count: result.data.length,
        total: result.total
      })

      return result
    } catch (error) {
      logError('PosImportsRepository findAll error', { company_id: companyId, error })
      throw error
    }
  }

  async findById(id: string, companyId: string): Promise<PosImport | null> {
    try {
      const cacheKey = this.getCacheKey('detail', { id, companyId })
      const cached = this.getFromCache<PosImport>(cacheKey)
      if (cached) return cached

      const { data, error } = await supabase
        .from('pos_imports')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      this.setCache(cacheKey, data)
      return data
    } catch (error) {
      logError('PosImportsRepository findById error', { id, error })
      throw error
    }
  }

  async findByIdWithLines(id: string, companyId: string): Promise<any | null> {
    try {
      const cacheKey = this.getCacheKey('detail-with-lines', { id, companyId })
      const cached = this.getFromCache<any>(cacheKey)
      if (cached) return cached

      const { data, error } = await supabase
        .from('pos_imports')
        .select('*, pos_import_lines(*)')
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      this.setCache(cacheKey, data)
      return data
    } catch (error) {
      logError('PosImportsRepository findByIdWithLines error', { id, error })
      throw error
    }
  }

  async create(dto: CreatePosImportDto, userId: string): Promise<PosImport> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .insert({
          ...dto,
          created_by: userId,
          updated_by: userId
        })
        .select()
        .single()

      if (error) throw error

      this.invalidateCache('list')

      logInfo('PosImportsRepository create success', { id: data.id })
      return data
    } catch (error) {
      logError('PosImportsRepository create error', { dto, error })
      throw error
    }
  }

  async update(id: string, companyId: string, updates: UpdatePosImportDto, userId: string): Promise<PosImport | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .update({
          ...updates,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', false)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      this.invalidateCache()

      logInfo('PosImportsRepository update success', { id })
      return data
    } catch (error) {
      logError('PosImportsRepository update error', { id, error })
      throw error
    }
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('pos_imports')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)

      if (error) throw error

      this.invalidateCache()

      logInfo('PosImportsRepository delete success', { id })
    } catch (error) {
      logError('PosImportsRepository delete error', { id, error })
      throw error
    }
  }

  async restore(id: string, companyId: string, userId: string): Promise<PosImport | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', true)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      this.invalidateCache()

      logInfo('PosImportsRepository restore success', { id })
      return data
    } catch (error) {
      logError('PosImportsRepository restore error', { id, error })
      throw error
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
  }
}

export const posImportsRepository = new PosImportsRepository()
