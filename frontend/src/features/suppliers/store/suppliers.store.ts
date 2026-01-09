import { create } from 'zustand'
import { suppliersApi } from '../api/suppliers.api'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, PaginationParams } from '../types/supplier.types'

interface SuppliersState {
  suppliers: Supplier[]
  pagination: PaginationParams | null
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  currentQuery: SupplierListQuery | null
  
  fetchSuppliers: (query?: SupplierListQuery, signal?: AbortSignal) => Promise<void>
  createSupplier: (data: CreateSupplierDto) => Promise<Supplier>
  updateSupplier: (id: string, data: UpdateSupplierDto) => Promise<Supplier>
  deleteSupplier: (id: string) => Promise<void>
  restoreSupplier: (id: string) => Promise<Supplier>
  clearError: () => void
}

export const useSuppliersStore = create<SuppliersState>((set) => ({
  suppliers: [],
  pagination: null,
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  currentQuery: null,

  fetchSuppliers: async (query = {}, signal) => {
    set({ fetchLoading: true, error: null, currentQuery: query })
    try {
      const res = await suppliersApi.list(query, signal)
      if (signal?.aborted) return
      set({ suppliers: res.data, pagination: res.pagination, fetchLoading: false })
    } catch (error: unknown) {
      if ((error instanceof Error && error.name === 'CanceledError') || signal?.aborted) return
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
          || (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
        : error instanceof Error ? error.message : 'Failed to fetch suppliers'
      set({ error: message || 'Failed to fetch suppliers', fetchLoading: false })
    }
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
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
          || (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
        : error instanceof Error ? error.message : 'Failed to create supplier'
      set({ error: message || 'Failed to create supplier', mutationLoading: false })
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
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
          || (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
        : error instanceof Error ? error.message : 'Failed to update supplier'
      set({ error: message || 'Failed to update supplier', mutationLoading: false })
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
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
          || (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
        : error instanceof Error ? error.message : 'Failed to delete supplier'
      set({ error: message || 'Failed to delete supplier', mutationLoading: false })
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
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
          || (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
        : error instanceof Error ? error.message : 'Failed to restore supplier'
      set({ error: message || 'Failed to restore supplier', mutationLoading: false })
      throw error
    }
  },
}))