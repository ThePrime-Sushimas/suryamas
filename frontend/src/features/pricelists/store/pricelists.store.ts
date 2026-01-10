/**
 * Pricelist Store
 * Single source of truth for pricelist state
 * 
 * State ownership:
 * - List data & pagination
 * - Loading & error states
 * - Current query (for refetch)
 * 
 * @module pricelists/store
 */

import { create } from 'zustand'
import { pricelistsApi } from '../api/pricelists.api'
import type {
  Pricelist,
  PricelistWithRelations,
  CreatePricelistDto,
  UpdatePricelistDto,
  PricelistApprovalDto,
  PricelistListQuery,
  PaginationParams
} from '../types/pricelist.types'
import { parsePricelistError } from '../utils/errorParser'

// Normalize query to handle undefined values and ensure consistent comparison
function normalizeQuery(query: PricelistListQuery): PricelistListQuery {
  return Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== undefined)
  ) as PricelistListQuery
}

// Shallow equality helper
function shallowEqual(obj1: PricelistListQuery, obj2: PricelistListQuery): boolean {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  
  if (keys1.length !== keys2.length) return false
  
  for (const key of keys1) {
    if (obj1[key as keyof PricelistListQuery] !== obj2[key as keyof PricelistListQuery]) return false
  }
  
  return true
}

// Request ID counter to prevent race conditions
let requestId = 0

interface PricelistsState {
  // Data
  pricelists: PricelistWithRelations[]
  pagination: PaginationParams | null
  currentQuery: PricelistListQuery | null

  // Unified loading state
  loading: {
    fetch: boolean
    create: boolean
    update: boolean
    delete: boolean
    approve: boolean
  }

  // Unified error state
  errors: {
    fetch: string | null
    mutation: string | null
  }

  // Actions
  fetchPricelists: (query?: PricelistListQuery, signal?: AbortSignal) => Promise<void>
  createPricelist: (data: CreatePricelistDto) => Promise<Pricelist>
  updatePricelist: (id: string, data: UpdatePricelistDto) => Promise<Pricelist>
  deletePricelist: (id: string) => Promise<void>
  restorePricelist: (id: string) => Promise<void>
  approvePricelist: (id: string, data: PricelistApprovalDto) => Promise<Pricelist>
  clearError: () => void
  reset: () => void
  refetch: (signal?: AbortSignal) => Promise<void>
}

export const usePricelistsStore = create<PricelistsState>((set, get) => ({
  // Initial state
  pricelists: [],
  pagination: null,
  currentQuery: null,
  loading: {
    fetch: false,
    create: false,
    update: false,
    delete: false,
    approve: false
  },
  errors: {
    fetch: null,
    mutation: null
  },

  /**
   * Fetch pricelists with query
   * Implements normalized query guard and race condition protection
   * Note: AbortController lifecycle is managed by components
   */
  fetchPricelists: async (query = {}, signal) => {
    const currentRequestId = ++requestId
    const state = get()
    
    const normalizedQuery = normalizeQuery(query)

    // Guard: prevent update if normalized query is the same
    if (
      state.currentQuery &&
      shallowEqual(state.currentQuery, normalizedQuery)
    ) {
      return
    }

    set(state => ({
      loading: { ...state.loading, fetch: true },
      errors: { ...state.errors, fetch: null },
      currentQuery: normalizedQuery
    }))

    try {
      const res = await pricelistsApi.list(normalizedQuery, signal)
      
      // Check if request was aborted or superseded
      if (signal?.aborted) return
      if (currentRequestId !== requestId) return

      set(state => ({
        pricelists: res.data,
        pagination: res.pagination,
        loading: { ...state.loading, fetch: false }
      }))
    } catch (error) {
      // Don't set error if request was aborted or superseded
      if (signal?.aborted) return
      if (currentRequestId !== requestId) return

      const message = parsePricelistError(error)
      set(state => ({
        errors: { ...state.errors, fetch: message },
        loading: { ...state.loading, fetch: false }
      }))
    }
  },

  /**
   * Create new pricelist with auto-refetch
   * Store owns refetch policy
   */
  createPricelist: async (data) => {
    set(state => ({
      loading: { ...state.loading, create: true },
      errors: { ...state.errors, mutation: null }
    }))
    
    try {
      const pricelist = await pricelistsApi.create(data)
      set(state => ({
        loading: { ...state.loading, create: false }
      }))
      
      // Auto-refetch after create (store responsibility)
      const { currentQuery, fetchPricelists } = get()
      if (currentQuery) {
        await fetchPricelists(currentQuery)
      }
      
      return pricelist
    } catch (error) {
      const message = parsePricelistError(error)
      set(state => ({
        errors: { ...state.errors, mutation: message },
        loading: { ...state.loading, create: false }
      }))
      throw error
    }
  },

  /**
   * Update existing pricelist with auto-refetch
   * Store owns refetch policy
   */
  updatePricelist: async (id, data) => {
    set(state => ({
      loading: { ...state.loading, update: true },
      errors: { ...state.errors, mutation: null }
    }))
    
    try {
      const pricelist = await pricelistsApi.update(id, data)
      set(state => ({
        loading: { ...state.loading, update: false }
      }))
      
      // Auto-refetch after update (store responsibility)
      const { currentQuery, fetchPricelists } = get()
      if (currentQuery) {
        await fetchPricelists(currentQuery)
      }
      
      return pricelist
    } catch (error) {
      const message = parsePricelistError(error)
      set(state => ({
        errors: { ...state.errors, mutation: message },
        loading: { ...state.loading, update: false }
      }))
      throw error
    }
  },

  /**
   * Delete pricelist
   * Optimistically removes from list
   */
  deletePricelist: async (id) => {
    set(state => ({
      loading: { ...state.loading, delete: true },
      errors: { ...state.errors, mutation: null }
    }))
    
    try {
      await pricelistsApi.delete(id)
      
      // Optimistic update
      set(state => ({
        pricelists: state.pricelists.filter(p => p.id !== id),
        loading: { ...state.loading, delete: false }
      }))
    } catch (error) {
      const message = parsePricelistError(error)
      set(state => ({
        errors: { ...state.errors, mutation: message },
        loading: { ...state.loading, delete: false }
      }))
      throw error
    }
  },

  /**
   * Restore deleted pricelist with auto-refetch
   */
  restorePricelist: async (id) => {
    set(state => ({
      loading: { ...state.loading, update: true },
      errors: { ...state.errors, mutation: null }
    }))
    
    try {
      await pricelistsApi.restore(id)
      set(state => ({
        loading: { ...state.loading, update: false }
      }))
      
      // Auto-refetch after restore
      const { currentQuery, fetchPricelists } = get()
      if (currentQuery) {
        await fetchPricelists(currentQuery)
      }
    } catch (error) {
      const message = parsePricelistError(error)
      set(state => ({
        errors: { ...state.errors, mutation: message },
        loading: { ...state.loading, update: false }
      }))
      throw error
    }
  },

  /**
   * Approve or reject pricelist with auto-refetch
   * Store owns refetch policy
   */
  approvePricelist: async (id, data) => {
    set(state => ({
      loading: { ...state.loading, approve: true },
      errors: { ...state.errors, mutation: null }
    }))
    
    try {
      const pricelist = await pricelistsApi.approve(id, data)
      set(state => ({
        loading: { ...state.loading, approve: false }
      }))
      
      // Auto-refetch after approve (store responsibility)
      const { currentQuery, fetchPricelists } = get()
      if (currentQuery) {
        await fetchPricelists(currentQuery)
      }
      
      return pricelist
    } catch (error) {
      const message = parsePricelistError(error)
      set(state => ({
        errors: { ...state.errors, mutation: message },
        loading: { ...state.loading, approve: false }
      }))
      throw error
    }
  },

  /**
   * Clear specific error or all errors
   */
  clearError: (type?: 'fetch' | 'mutation') => set(state => ({
    errors: type 
      ? { ...state.errors, [type]: null }
      : { fetch: null, mutation: null }
  })),

  /**
   * Reset store to initial state
   */
  reset: () => set({
    pricelists: [],
    pagination: null,
    currentQuery: null,
    loading: {
      fetch: false,
      create: false,
      update: false,
      delete: false,
      approve: false
    },
    errors: {
      fetch: null,
      mutation: null
    }
  }),

  /**
   * Refetch current query (consistent refetch strategy)
   */
  refetch: async (signal?: AbortSignal) => {
    const { currentQuery, fetchPricelists } = get()
    if (currentQuery) {
      await fetchPricelists(currentQuery, signal)
    }
  }
}))
