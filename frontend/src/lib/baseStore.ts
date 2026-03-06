/**
 * BaseStore Factory - Production Ready (v2.0.0)
 * 
 * Features:
 * - Built-in Cache with staleTime
 * - Optimistic Update
 * - Background Refetch
 * - Request Race Condition Prevention (AbortController + Request ID)
 * - Auto Page Fallback on Delete
 * - SSR-ready structure
 * - Stable cache key
 * - Auto invalidate cache after mutation
 * - Persist version for migration support
 * 
 * Usage:
 * import { createBaseStore } from '@/lib/baseStore'
 * 
 * const useStore = createBaseStore({
 *   name: 'paymentMethods',
 *   api: paymentMethodsApi,
 *   initialFilter: { status: 'active' }
 * })
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'

// =============================================================================
// TYPES
// =============================================================================

export interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface CacheEntry<T> {
  data: T[]
  timestamp: number
  page: number
  limit: number
  filters: Record<string, unknown>
}

export interface RequestOptions {
  signal?: AbortSignal
}

export interface ApiInterface<T, CreateDto, UpdateDto, ApiParams> {
  list: (page: number, limit: number, filters?: ApiParams, options?: RequestOptions) => Promise<{ data: T[]; pagination: PaginationState }>
  getById: (id: string) => Promise<T>
  create: (data: CreateDto) => Promise<T>
  update: (id: string, data: UpdateDto) => Promise<T>
  delete: (id: string) => Promise<void>
}

export interface BaseStoreOptions<T extends { id: string | number }, CreateDto, UpdateDto, ApiParams extends Record<string, unknown>> {
  name: string
  api: ApiInterface<T, CreateDto, UpdateDto, ApiParams>
  initialFilter?: ApiParams
  initialPagination?: Partial<PaginationState>
  cacheConfig?: {
    enabled?: boolean
    staleTime?: number
    maxSize?: number
  }
  optimisticUpdate?: {
    enabled?: boolean
    onSuccess?: (action: 'create' | 'update' | 'delete', data: T | UpdateDto | string) => void
    onError?: (error: Error, action: 'create' | 'update' | 'delete', originalData?: unknown) => void
  }
  errorHandler?: {
    onError?: (error: Error, action: string) => void
    onAbort?: (action: string) => void
  }
}

export interface BaseStoreState<T extends { id: string | number }, CreateDto, UpdateDto, ApiParams extends Record<string, unknown>> {
  items: T[]
  currentItem: T | null
  loading: boolean
  mutating: boolean
  error: string | null
  pagination: PaginationState
  filters: ApiParams
  cache: Record<string, CacheEntry<T>>
  currentRequestId: number
  abortController: AbortController | null
  lastFetchTime: number
  isStale: boolean
  fetchItems: (page?: number, limit?: number, forceRefresh?: boolean) => Promise<void>
  getItemById: (id: string) => Promise<T>
  createItem: (data: CreateDto) => Promise<T>
  updateItem: (id: string, data: UpdateDto) => Promise<T>
  deleteItem: (id: string) => Promise<void>
  setPage: (page: number) => void
  setPageSize: (limit: number) => void
  setFilters: (filters: Partial<ApiParams>) => void
  invalidateCache: (key?: string) => void
  prefetchPage: (page: number) => void
  clearError: () => void
  reset: () => void
}

// =============================================================================
// CACHE UTILS - Stable Cache Key
// =============================================================================

/**
 * Stable cache key generator
 * Sort filters to ensure consistent key regardless of order
 */
function generateCacheKey(page: number, limit: number, filters: Record<string, unknown>): string {
  // Sort filters for stable key
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        acc[key] = filters[key]
      }
      return acc
    }, {} as Record<string, unknown>)
  
  return `${page}_${limit}_${JSON.stringify(sortedFilters)}`
}

function isCacheValid(entry: CacheEntry<unknown>, staleTime: number): boolean {
  return Date.now() - entry.timestamp < staleTime
}

// =============================================================================
// BASE STORE FACTORY
// =============================================================================

const PERSIST_VERSION = 1

export function createBaseStore<
  T extends { id: string | number },
  CreateDto,
  UpdateDto,
  ApiParams extends Record<string, unknown> = Record<string, unknown>
>(options: BaseStoreOptions<T, CreateDto, UpdateDto, ApiParams>) {
  const {
    name,
    api,
    initialFilter = {} as ApiParams,
    initialPagination = {},
    cacheConfig = {},
    optimisticUpdate = {},
    errorHandler = {}
  } = options

  const {
    enabled: cacheEnabled = true,
    staleTime = 30000,
    maxSize = 10
  } = cacheConfig

  const initialPaginationState: PaginationState = {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
    ...initialPagination
  }

  const initialState = {
    items: [] as T[],
    currentItem: null as T | null,
    loading: false,
    mutating: false,
    error: null as string | null,
    pagination: initialPaginationState,
    filters: initialFilter,
    cache: {} as Record<string, CacheEntry<T>>,
    currentRequestId: 0,
    abortController: null as AbortController | null,
    lastFetchTime: 0,
    isStale: true
  }

  type Store = BaseStoreState<T, CreateDto, UpdateDto, ApiParams>

  return create<Store>()(
    subscribeWithSelector(
      devtools(
        persist(
          (set, get): Store => ({
            ...initialState,

            // ---------------------------------------------------------------------------
            // FETCH WITH CACHE
            // ---------------------------------------------------------------------------

            fetchItems: async (page, limit, forceRefresh = false) => {
              const state = get()
              const currentPage = page ?? state.pagination.page
              const currentLimit = limit ?? state.pagination.limit
              
              const cacheKey = generateCacheKey(currentPage, currentLimit, state.filters as Record<string, unknown>)
              
              // Check cache first (if not forcing refresh)
              if (cacheEnabled && !forceRefresh && state.cache[cacheKey]) {
                const cached = state.cache[cacheKey]
                if (isCacheValid(cached, staleTime)) {
                  set({
                    items: cached.data,
                    pagination: {
                      ...state.pagination,
                      page: cached.page,
                      limit: cached.limit,
                      total: cached.data.length
                    },
                    loading: false,
                    lastFetchTime: Date.now(),
                    isStale: false
                  })
                  return
                }
              }

              // Generate new request ID
              const requestId = state.currentRequestId + 1
              
              // Cancel previous request
              if (state.abortController) {
                state.abortController.abort()
              }
              
              // Create new abort controller
              const abortController = new AbortController()
              
              set({ 
                loading: true, 
                error: null,
                currentRequestId: requestId,
                abortController
              })
              
              try {
                const res = await api.list(
                  currentPage, 
                  currentLimit, 
                  state.filters as ApiParams,
                  { signal: abortController.signal }
                )
                
                // Only update if this is still the current request
                if (get().currentRequestId === requestId) {
                  const totalPages = Math.ceil(res.pagination.total / res.pagination.limit)
                  
                  // Update cache
                  const newCache: Record<string, CacheEntry<T>> = { ...state.cache }
                  if (cacheEnabled) {
                    newCache[cacheKey] = {
                      data: res.data,
                      timestamp: Date.now(),
                      page: currentPage,
                      limit: currentLimit,
                      filters: { ...state.filters }
                    }
                    
                    // Limit cache size (LRU-ish)
                    const cacheKeys = Object.keys(newCache)
                    if (cacheKeys.length > maxSize) {
                      const sortedKeys = cacheKeys.sort(
                        (a, b) => newCache[a].timestamp - newCache[b].timestamp
                      )
                      const keysToRemove = sortedKeys.slice(0, cacheKeys.length - maxSize)
                      keysToRemove.forEach(key => delete newCache[key])
                    }
                  }
                  
                  set({
                    items: res.data,
                    pagination: {
                      page: res.pagination.page,
                      limit: res.pagination.limit,
                      total: res.pagination.total,
                      totalPages,
                      hasNext: res.pagination.page < totalPages,
                      hasPrev: res.pagination.page > 1
                    },
                    cache: newCache,
                    loading: false,
                    abortController: null,
                    lastFetchTime: Date.now(),
                    isStale: false
                  })
                }
              } catch (error) {
                // Don't update state if request was aborted
                if (error instanceof Error && error.name === 'AbortError') {
                  errorHandler.onAbort?.('fetchItems')
                  return
                }
                
                // Only update error if this is still the current request
                if (get().currentRequestId === requestId) {
                  const message = error instanceof Error ? error.message : 'Failed to fetch items'
                  errorHandler.onError?.(error as Error, 'fetchItems')
                  set({ error: message, loading: false, abortController: null })
                }
              }
            },

            // ---------------------------------------------------------------------------
            // GET BY ID
            // ---------------------------------------------------------------------------

            getItemById: async (id) => {
              set({ loading: true, error: null })
              try {
                const item = await api.getById(id)
                set({ currentItem: item, loading: false })
                return item
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Item not found'
                errorHandler.onError?.(error as Error, 'getItemById')
                set({ error: message, loading: false })
                throw error
              }
            },

            // ---------------------------------------------------------------------------
            // CREATE - With cache invalidation
            // ---------------------------------------------------------------------------

            createItem: async (data) => {
              set({ mutating: true, error: null })
              
              try {
                const item = await api.create(data)
                
                // Invalidate all cache after mutation
                set(state => {
                  const newCache: Record<string, CacheEntry<T>> = {}
                  
                  // Keep cache but mark as stale - akan di-refetch saat dibutuhkan
                  // Atau bisa juga: invalidate semua cache
                  Object.keys(state.cache).forEach(key => {
                    newCache[key] = {
                      ...state.cache[key],
                      timestamp: 0 // Mark as immediately stale
                    }
                  })
                  
                  return {
                    items: [item, ...state.items].slice(0, state.pagination.limit), // Slice to limit
                    pagination: {
                      ...state.pagination,
                      total: state.pagination.total + 1
                    },
                    cache: newCache,
                    isStale: true,
                    mutating: false
                  }
                })
                
                optimisticUpdate.onSuccess?.('create', item)
                return item
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to create'
                errorHandler.onError?.(error as Error, 'createItem')
                set({ error: message, mutating: false })
                optimisticUpdate.onError?.(error as Error, 'create', data)
                throw error
              }
            },

            // ---------------------------------------------------------------------------
            // UPDATE - With cache invalidation
            // ---------------------------------------------------------------------------

            updateItem: async (id, data) => {
              const state = get()
              const originalItem = state.items.find(i => String(i.id) === String(id))
              
              set({ mutating: true, error: null })
              
              // Optimistic update
              if (optimisticUpdate.enabled && originalItem) {
                const optimisticItem = { ...originalItem, ...data } as T
                set(state => ({
                  items: state.items.map(i => String(i.id) === String(id) ? optimisticItem : i),
                  currentItem: state.currentItem && String(state.currentItem.id) === String(id) ? optimisticItem : state.currentItem
                }))
              }
              
              try {
                const item = await api.update(id, data)
                
                // Invalidate cache after mutation
                set(state => {
                  const newCache: Record<string, CacheEntry<T>> = {}
                  Object.keys(state.cache).forEach(key => {
                    newCache[key] = {
                      ...state.cache[key],
                      timestamp: 0
                    }
                  })
                  
                  return {
                    items: state.items.map(i => String(i.id) === String(id) ? item : i),
                    currentItem: state.currentItem && String(state.currentItem.id) === String(id) ? item : state.currentItem,
                    cache: newCache,
                    isStale: true,
                    mutating: false
                  }
                })
                
                optimisticUpdate.onSuccess?.('update', item)
                return item
              } catch (error) {
                // Rollback optimistic update
                if (optimisticUpdate.enabled && originalItem) {
                  set(state => ({
                    items: state.items.map(i => String(i.id) === String(id) ? originalItem : i),
                    currentItem: state.currentItem && String(state.currentItem.id) === String(id) ? originalItem : state.currentItem
                  }))
                }
                
                const message = error instanceof Error ? error.message : 'Failed to update'
                errorHandler.onError?.(error as Error, 'updateItem')
                set({ error: message, mutating: false })
                optimisticUpdate.onError?.(error as Error, 'update', data)
                throw error
              }
            },

            // ---------------------------------------------------------------------------
            // DELETE - With cache invalidation + auto page fallback
            // ---------------------------------------------------------------------------

            deleteItem: async (id) => {
              const state = get()
              const originalItem = state.items.find(i => String(i.id) === String(id))
              
              set({ mutating: true, error: null })
              
              // Optimistic update
              if (optimisticUpdate.enabled && originalItem) {
                set(state => ({
                  items: state.items.filter(i => String(i.id) !== String(id)),
                  pagination: {
                    ...state.pagination,
                    total: Math.max(0, state.pagination.total - 1)
                  }
                }))
              }
              
              try {
                await api.delete(id)
                
                set(state => {
                  const newTotal = Math.max(0, state.pagination.total - 1)
                  const totalPages = Math.ceil(newTotal / state.pagination.limit) || 1
                  
                  // Auto fallback: if current page > total pages, go to last valid page
                  const newPage = Math.min(state.pagination.page, totalPages)
                  
                  // Invalidate cache after mutation
                  const newCache: Record<string, CacheEntry<T>> = {}
                  Object.keys(state.cache).forEach(key => {
                    newCache[key] = {
                      ...state.cache[key],
                      timestamp: 0
                    }
                  })
                  
                  return {
                    items: state.items.filter(i => String(i.id) !== String(id)),
                    pagination: {
                      ...state.pagination,
                      total: newTotal,
                      totalPages,
                      page: newPage,
                      hasNext: newPage < totalPages,
                      hasPrev: newPage > 1
                    },
                    cache: newCache,
                    isStale: true,
                    mutating: false
                  }
                })
                
                optimisticUpdate.onSuccess?.('delete', id)
              } catch (error) {
                // Rollback optimistic update
                if (optimisticUpdate.enabled && originalItem) {
                  set(state => ({
                    items: [...state.items, originalItem].sort((a, b) => 
                      String(a.id).localeCompare(String(b.id))
                    ),
                    pagination: {
                      ...state.pagination,
                      total: state.pagination.total + 1
                    }
                  }))
                }
                
                const message = error instanceof Error ? error.message : 'Failed to delete'
                errorHandler.onError?.(error as Error, 'deleteItem')
                set({ error: message, mutating: false })
                optimisticUpdate.onError?.(error as Error, 'delete', id)
                throw error
              }
            },

            // ---------------------------------------------------------------------------
            // PAGINATION ACTIONS (PURE FUNCTIONS - NO FETCH)
            // ---------------------------------------------------------------------------

            setPage: (page) => {
              set(state => ({
                pagination: { ...state.pagination, page }
              }))
            },

            setPageSize: (limit) => {
              set(state => ({
                pagination: { ...state.pagination, limit, page: 1 }
              }))
            },

            setFilters: (filters) => {
              set(state => ({
                filters: { ...state.filters, ...filters },
                pagination: { ...state.pagination, page: 1 }
              }))
            },

            // ---------------------------------------------------------------------------
            // CACHE ACTIONS
            // ---------------------------------------------------------------------------

            invalidateCache: (key) => {
              if (key) {
                set(state => {
                  const newCache = { ...state.cache }
                  delete newCache[key]
                  return { cache: newCache, isStale: true }
                })
              } else {
                set({ cache: {}, isStale: true })
              }
            },

            // ---------------------------------------------------------------------------
            // PREFETCH - Background fetch next page
            // ---------------------------------------------------------------------------

            prefetchPage: async (page) => {
              const state = get()
              const cacheKey = generateCacheKey(page, state.pagination.limit, state.filters as Record<string, unknown>)
              
              // Only prefetch if not already cached
              if (!state.cache[cacheKey]) {
                try {
                  const res = await api.list(
                    page,
                    state.pagination.limit,
                    state.filters as ApiParams
                  )
                  
                  set(state => ({
                    cache: {
                      ...state.cache,
                      [cacheKey]: {
                        data: res.data,
                        timestamp: Date.now(),
                        page,
                        limit: state.pagination.limit,
                        filters: { ...state.filters }
                      }
                    }
                  }))
                } catch {
                  // Silent fail for prefetch
                }
              }
            },

            // ---------------------------------------------------------------------------
            // UTILITY
            // ---------------------------------------------------------------------------

            clearError: () => set({ error: null }),

            reset: () => {
              const state = get()
              if (state.abortController) {
                state.abortController.abort()
              }
              set({
                ...initialState,
                filters: initialFilter,
                pagination: initialPaginationState
              })
            }
          }),
          {
            name: `${name}-storage`,
            version: PERSIST_VERSION,
            // Migration handler for future schema changes
            migrate: (persistedState: unknown, version: number) => {
              if (version < PERSIST_VERSION) {
                // Handle migration if needed
                console.log(`[${name}] Migrating from version ${version} to ${PERSIST_VERSION}`)
              }
              return persistedState as Record<string, unknown>
            },
            partialize: (state) => ({
              filters: state.filters,
              pagination: { limit: state.pagination.limit }
              // Optionally persist cache (be careful with size)
              // cache: state.cache 
            })
          }
        ),
        { name: `${name}-store` }
      )
    )
  )
}

export default createBaseStore

