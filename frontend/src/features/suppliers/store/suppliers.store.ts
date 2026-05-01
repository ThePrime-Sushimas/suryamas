import { create } from 'zustand'
import { suppliersApi } from '../api/suppliers.api'
import { parseApiError } from '@/lib/errorParser'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery } from '../types/supplier.types'

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface SuppliersState {
  suppliers: Supplier[]
  pagination: PaginationState
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  currentRequestId: number
  
  fetchSuppliers: (query?: SupplierListQuery) => Promise<void>
  fetchPage: (page: number, limit?: number, query?: Omit<SupplierListQuery, 'page' | 'limit'>) => Promise<void>
  createSupplier: (data: CreateSupplierDto) => Promise<Supplier>
  updateSupplier: (id: string, data: UpdateSupplierDto) => Promise<Supplier>
  deleteSupplier: (id: string) => Promise<void>
  restoreSupplier: (id: string) => Promise<Supplier>
  clearError: () => void
}

const initialPagination: PaginationState = { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false }

export const useSuppliersStore = create<SuppliersState>((set, get) => ({
  suppliers: [],
  pagination: initialPagination,
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  currentRequestId: 0,

  fetchSuppliers: async (query = {}) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, fetchLoading: true, error: null })
    try {
      const res = await suppliersApi.list(query)
      if (get().currentRequestId !== requestId) return
      set({ suppliers: res.data, pagination: res.pagination, fetchLoading: false })
    } catch (error: unknown) {
      if (get().currentRequestId !== requestId) return
      const message = parseApiError(error, 'Gagal memuat pemasok')
      set({ error: message, fetchLoading: false })
    }
  },

  fetchPage: (page, limit?, query?) => {
    const l = limit ?? get().pagination.limit
    set(state => ({ pagination: { ...state.pagination, page, limit: l } }))
    return get().fetchSuppliers({ ...query, page, limit: l })
  },

  createSupplier: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplier = await suppliersApi.create(data)
      set(state => ({
        suppliers: [...state.suppliers, supplier],
        mutationLoading: false
      }))
      return supplier
    } catch (error: unknown) {
      const message = parseApiError(error, 'Gagal membuat pemasok')
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  updateSupplier: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplier = await suppliersApi.update(id, data)
      set(state => ({
        suppliers: state.suppliers.map(s => s.id === id ? supplier : s),
        mutationLoading: false
      }))
      return supplier
    } catch (error: unknown) {
      const message = parseApiError(error, 'Gagal memperbarui pemasok')
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  deleteSupplier: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await suppliersApi.delete(id)
      set(state => ({
        suppliers: state.suppliers.filter(s => s.id !== id),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const message = parseApiError(error, 'Gagal menghapus pemasok')
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  restoreSupplier: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplier = await suppliersApi.restore(id)
      set(state => ({
        suppliers: state.suppliers.map(s => s.id === id ? supplier : s),
        mutationLoading: false
      }))
      return supplier
    } catch (error: unknown) {
      const message = parseApiError(error, 'Gagal memulihkan pemasok')
      set({ error: message, mutationLoading: false })
      throw error
    }
  },
}))