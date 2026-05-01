import { create } from 'zustand'
import { paymentTermsApi } from '../api/paymentTerms.api'
import { parseApiError } from '@/lib/errorParser'
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

  fetchPage: (page?: number, limit?: number) => Promise<void>
  fetchPaymentTermById: (id: number) => Promise<PaymentTerm>
  searchPaymentTerms: (q: string) => Promise<void>
  createPaymentTerm: (data: CreatePaymentTermDto) => Promise<PaymentTerm>
  updatePaymentTerm: (id: number, data: UpdatePaymentTermDto) => Promise<PaymentTerm>
  deletePaymentTerm: (id: number) => Promise<void>
  restorePaymentTerm: (id: number) => Promise<void>
  setSort: (sort: SortParams | null) => void
  setFilter: (filter: FilterParams | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  paymentTerms: [],
  currentPaymentTerm: null,
  loading: true,
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  sort: null,
  filter: null,
  currentRequestId: 0,
}

export const usePaymentTermsStore = create<PaymentTermsState>((set, get) => ({
  ...initialState,

  fetchPage: async (page, limit) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, loading: true, error: null })

    const state = get()
    const currentPage = page ?? state.pagination.page
    const currentLimit = limit ?? state.pagination.limit

    try {
      const res = await paymentTermsApi.list(currentPage, currentLimit, state.sort, state.filter)
      if (get().currentRequestId === requestId) {
        set({ paymentTerms: res.data, pagination: res.pagination, loading: false })
      }
    } catch (error: unknown) {
      if (get().currentRequestId === requestId) {
        set({ error: parseApiError(error, 'Gagal memuat syarat pembayaran'), loading: false })
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
      set({ error: parseApiError(error, 'Gagal memuat syarat pembayaran'), loading: false })
      throw error
    }
  },

  searchPaymentTerms: async (q) => {
    const currentFilter = get().filter || {}
    set({ filter: { ...currentFilter, q }, pagination: { ...get().pagination, page: 1 } })
    await get().fetchPage(1)
  },

  createPaymentTerm: async (data) => {
    set({ loading: true, error: null })
    try {
      const paymentTerm = await paymentTermsApi.create(data)
      set(state => ({
        paymentTerms: [paymentTerm, ...state.paymentTerms],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        loading: false,
      }))
      return paymentTerm
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat syarat pembayaran'), loading: false })
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
        loading: false,
      }))
      return paymentTerm
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memperbarui syarat pembayaran'), loading: false })
      throw error
    }
  },

  deletePaymentTerm: async (id) => {
    set({ loading: true, error: null })
    try {
      await paymentTermsApi.delete(id)
      set(state => ({
        paymentTerms: state.paymentTerms.map(p => p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p),
        loading: false,
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal menghapus syarat pembayaran'), loading: false })
      throw error
    }
  },

  restorePaymentTerm: async (id) => {
    set({ loading: true, error: null })
    try {
      const paymentTerm = await paymentTermsApi.restore(id)
      set(state => ({
        paymentTerms: state.paymentTerms.map(p => p.id === id ? paymentTerm : p),
        loading: false,
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memulihkan syarat pembayaran'), loading: false })
      throw error
    }
  },

  setSort: (sort) => set({ sort }),
  setFilter: (filter) => set({ filter, pagination: { ...get().pagination, page: 1 } }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
