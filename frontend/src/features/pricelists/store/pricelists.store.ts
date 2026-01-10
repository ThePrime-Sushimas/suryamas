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

  // Loading states
  fetchLoading: boolean
  mutationLoading: boolean

  // Error state
  error: string | null

  // Actions
  fetchPricelists: (query?: PricelistListQuery, signal?: AbortSignal) => Promise<void>
  createPricelist: (data: CreatePricelistDto) => Promise<Pricelist>
  updatePricelist: (id: string, data: UpdatePricelistDto) => Promise<Pricelist>
  deletePricelist: (id: string) => Promise<void>
  approvePricelist: (id: string, data: PricelistApprovalDto) => Promise<Pricelist>
  clearError: () => void
  reset: () => void
}

export const usePricelistsStore = create<PricelistsState>((set, get) => ({
  // Initial state
  pricelists: [],
  pagination: null,
  currentQuery: null,
  fetchLoading: false,
  mutationLoading: false,
  error: null,

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

    set({
      fetchLoading: true,
      error: null,
      currentQuery: normalizedQuery
    })

    try {
      const res = await pricelistsApi.list(normalizedQuery, signal)
      
      // Check if request was aborted or superseded
      if (signal?.aborted) return
      if (currentRequestId !== requestId) return

      set({
        pricelists: res.data,
        pagination: res.pagination,
        fetchLoading: false
      })
    } catch (error) {
      // Don't set error if request was aborted or superseded
      if (signal?.aborted) return
      if (currentRequestId !== requestId) return

      const message = parsePricelistError(error)
      set({
        error: message,
        fetchLoading: false
      })
    }
  },

  /**
   * Create new pricelist
   * Does NOT auto-refetch (page handles it)
   */
  createPricelist: async (data) => {
    set({ mutationLoading: true, error: null })
    
    try {
      const pricelist = await pricelistsApi.create(data)
      set({ mutationLoading: false })
      return pricelist
    } catch (error) {
      const message = parsePricelistError(error)
      set({
        error: message,
        mutationLoading: false
      })
      throw error
    }
  },

  /**
   * Update existing pricelist
   * Does NOT auto-refetch (page handles it)
   */
  updatePricelist: async (id, data) => {
    set({ mutationLoading: true, error: null })
    
    try {
      const pricelist = await pricelistsApi.update(id, data)
      set({ mutationLoading: false })
      return pricelist
    } catch (error) {
      const message = parsePricelistError(error)
      set({
        error: message,
        mutationLoading: false
      })
      throw error
    }
  },

  /**
   * Delete pricelist
   * Optimistically removes from list
   */
  deletePricelist: async (id) => {
    set({ mutationLoading: true, error: null })
    
    try {
      await pricelistsApi.delete(id)
      
      // Optimistic update
      set(state => ({
        pricelists: state.pricelists.filter(p => p.id !== id),
        mutationLoading: false
      }))
    } catch (error) {
      const message = parsePricelistError(error)
      set({
        error: message,
        mutationLoading: false
      })
      throw error
    }
  },

  /**
   * Approve or reject pricelist
   * Does NOT auto-refetch (page handles it)
   */
  approvePricelist: async (id, data) => {
    set({ mutationLoading: true, error: null })
    
    try {
      const pricelist = await pricelistsApi.approve(id, data)
      set({ mutationLoading: false })
      return pricelist
    } catch (error) {
      const message = parsePricelistError(error)
      set({
        error: message,
        mutationLoading: false
      })
      throw error
    }
  },

  /**
   * Clear error state
   */
  clearError: () => set({ error: null }),

  /**
   * Reset store to initial state
   */
  reset: () => set({
    pricelists: [],
    pagination: null,
    currentQuery: null,
    fetchLoading: false,
    mutationLoading: false,
    error: null
  })
}))
