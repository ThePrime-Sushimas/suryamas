import { create } from 'zustand'
import { paymentTermsApi } from '../api/paymentTerms.api'
import type { PaymentTerm, CreatePaymentTermDto, UpdatePaymentTermDto, PaginationParams, SortParams, FilterParams } from '../types'

interface PaymentTermsState {
  paymentTerms: PaymentTerm[]
  currentPaymentTerm: PaymentTerm | null
  loading: boolean
  error: string | null
  pagination: PaginationParams
  sort: SortParams | null
  filter: FilterParams | null
  currentRequestId: number
  lastFetchedAt: Date | null
  
  fetchPaymentTerms: (page?: number, limit?: number) => Promise<void>
  fetchPaymentTermById: (id: number) => Promise<PaymentTerm>
  searchPaymentTerms: (q: string) => Promise<void>
  createPaymentTerm: (data: CreatePaymentTermDto) => Promise<PaymentTerm>
  updatePaymentTerm: (id: number, data: UpdatePaymentTermDto) => Promise<PaymentTerm>
  deletePaymentTerm: (id: number) => Promise<void>
  restorePaymentTerm: (id: number) => Promise<void>
  setPage: (page: number) => void
  setPageSize: (limit: number) => void
  setSort: (sort: SortParams | null) => void
  setFilter: (filter: FilterParams | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  paymentTerms: [],
  currentPaymentTerm: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  sort: null,
  filter: null,
  currentRequestId: 0,
  lastFetchedAt: null as Date | null
}

export const usePaymentTermsStore = create<PaymentTermsState>((set, get) => ({
  ...initialState,

  fetchPaymentTerms: async (page, limit) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, loading: true, error: null })
    
    const state = get()
    const currentPage = page ?? state.pagination.page
    const currentLimit = limit ?? state.pagination.limit
    
    try {
      const res = await paymentTermsApi.list(currentPage, currentLimit, state.sort, state.filter)
      
      if (get().currentRequestId === requestId) {
        set({ paymentTerms: res.data, pagination: res.pagination, loading: false, lastFetchedAt: new Date() })
      }
    } catch (error: unknown) {
      if (get().currentRequestId === requestId) {
        const message = error instanceof Error ? error.message : 'Failed to fetch payment terms'
        set({ error: message, loading: false })
      }
    }
  },

  fetchPaymentTermById: async (id) => {
    set({ loading: true, error: null })
    try {
      const paymentTerm = await paymentTermsApi.getById(id)
      set({ currentPaymentTerm: paymentTerm, loading: false })
      return paymentTerm
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch payment term'
      set({ error: message, loading: false })
      throw error
    }
  },

  searchPaymentTerms: async (q) => {
    const currentPagination = get().pagination
    set({ 
      filter: { q }, 
      pagination: { ...currentPagination, page: 1 } 
    })
    await get().fetchPaymentTerms()
  },

  createPaymentTerm: async (data) => {
    set({ loading: true, error: null })
    try {
      const paymentTerm = await paymentTermsApi.create(data)
      set(state => ({
        paymentTerms: [paymentTerm, ...state.paymentTerms],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        loading: false
      }))
      return paymentTerm
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create payment term'
      set({ error: message, loading: false })
      throw error
    }
  },

  updatePaymentTerm: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const paymentTerm = await paymentTermsApi.update(id, data)
      set(state => ({
        paymentTerms: state.paymentTerms.map(p => p.id === id ? paymentTerm : p),
        currentPaymentTerm: state.currentPaymentTerm?.id === id ? paymentTerm : state.currentPaymentTerm,
        loading: false
      }))
      return paymentTerm
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update payment term'
      set({ error: message, loading: false })
      throw error
    }
  },

  deletePaymentTerm: async (id) => {
    set({ loading: true, error: null })
    try {
      await paymentTermsApi.delete(id)
      set(state => ({
        paymentTerms: state.paymentTerms.map(p => p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p),
        loading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete payment term'
      set({ error: message, loading: false })
      throw error
    }
  },

  restorePaymentTerm: async (id) => {
    set({ loading: true, error: null })
    try {
      const paymentTerm = await paymentTermsApi.restore(id)
      set(state => ({
        paymentTerms: state.paymentTerms.map(p => p.id === id ? paymentTerm : p),
        loading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore payment term'
      set({ error: message, loading: false })
      throw error
    }
  },

  setPage: (page) => {
    set(state => ({ pagination: { ...state.pagination, page } }))
  },

  setPageSize: (limit) => {
    set(state => ({ pagination: { ...state.pagination, page: 1, limit } }))
  },

  setSort: (sort) => {
    set({ sort })
  },

  setFilter: (filter) => {
    set({ filter, pagination: { ...get().pagination, page: 1 } })
  },

  clearError: () => set({ error: null }),
  
  reset: () => set(initialState)
}))
