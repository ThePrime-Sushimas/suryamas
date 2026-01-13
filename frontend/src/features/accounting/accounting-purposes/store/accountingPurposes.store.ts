import { create } from 'zustand'
import { accountingPurposesApi } from '../api/accountingPurposes.api'
import type { AccountingPurpose, CreateAccountingPurposeDto, UpdateAccountingPurposeDto, PaginationParams, SortParams, FilterParams } from '../types/accounting-purpose.types'

interface AccountingPurposesState {
  purposes: AccountingPurpose[]
  selectedPurpose: AccountingPurpose | null
  loading: boolean
  error: string | null
  pagination: PaginationParams
  sort: SortParams | null
  filter: FilterParams | null
  currentRequestId: number
  lastFetchedAt: Date | null
  
  fetchPurposes: (page?: number, limit?: number) => Promise<void>
  fetchPurposeById: (id: string) => Promise<AccountingPurpose>
  searchPurposes: (q: string) => Promise<void>
  createPurpose: (data: CreateAccountingPurposeDto) => Promise<AccountingPurpose>
  updatePurpose: (id: string, data: UpdateAccountingPurposeDto) => Promise<AccountingPurpose>
  deletePurpose: (id: string) => Promise<void>
  setPage: (page: number) => void
  setSort: (sort: SortParams | null) => void
  setFilter: (filter: FilterParams | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  purposes: [],
  selectedPurpose: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  sort: null,
  filter: null,
  currentRequestId: 0,
  lastFetchedAt: null as Date | null
}

export const useAccountingPurposesStore = create<AccountingPurposesState>((set, get) => ({
  ...initialState,

  fetchPurposes: async (page, limit) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, loading: true, error: null })
    
    const state = get()
    const currentPage = page ?? state.pagination.page
    const currentLimit = limit ?? state.pagination.limit
    
    try {
      const res = await accountingPurposesApi.list(currentPage, currentLimit, state.sort, state.filter)
      
      if (get().currentRequestId === requestId) {
        set({ purposes: res.data, pagination: res.pagination, loading: false, lastFetchedAt: new Date() })
      }
    } catch (error: unknown) {
      if (get().currentRequestId === requestId) {
        const message = error instanceof Error ? error.message : 'Failed to fetch accounting purposes'
        set({ error: message, loading: false })
      }
    }
  },

  fetchPurposeById: async (id) => {
    set({ loading: true, error: null })
    try {
      const purpose = await accountingPurposesApi.getById(id)
      set({ selectedPurpose: purpose, loading: false })
      return purpose
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch accounting purpose'
      set({ error: message, loading: false })
      throw error
    }
  },

  searchPurposes: async (q) => {
    const currentPagination = get().pagination
    set({ 
      filter: { q }, 
      pagination: { ...currentPagination, page: 1 } 
    })
    await get().fetchPurposes(1)
  },

  createPurpose: async (data) => {
    set({ loading: true, error: null })
    try {
      const purpose = await accountingPurposesApi.create(data)
      set(state => ({
        purposes: [purpose, ...state.purposes],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        loading: false
      }))
      return purpose
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create accounting purpose'
      set({ error: message, loading: false })
      throw error
    }
  },

  updatePurpose: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const purpose = await accountingPurposesApi.update(id, data)
      set(state => ({
        purposes: state.purposes.map(p => p.id === id ? purpose : p),
        selectedPurpose: state.selectedPurpose?.id === id ? purpose : state.selectedPurpose,
        loading: false
      }))
      return purpose
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update accounting purpose'
      set({ error: message, loading: false })
      throw error
    }
  },

  deletePurpose: async (id) => {
    set({ loading: true, error: null })
    try {
      await accountingPurposesApi.delete(id)
      set(state => ({
        purposes: state.purposes.filter(p => p.id !== id),
        pagination: { ...state.pagination, total: state.pagination.total - 1 },
        loading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete accounting purpose'
      set({ error: message, loading: false })
      throw error
    }
  },

  setPage: (page) => {
    set(state => ({ pagination: { ...state.pagination, page } }))
  },

  setSort: (sort) => {
    set({ sort })
  },

  setFilter: (filter) => {
    const state = get()
    set({ filter, pagination: { ...state.pagination, page: 1 } })
    // Auto-fetch with new filter if we have data loaded
    if (state.lastFetchedAt) {
      state.fetchPurposes(1, state.pagination.limit)
    }
  },

  clearError: () => set({ error: null }),
  
  reset: () => set(initialState)
}))