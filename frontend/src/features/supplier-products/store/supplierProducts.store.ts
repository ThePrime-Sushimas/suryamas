// Supplier Products Store - Zustand state management

import { create } from 'zustand'
import { supplierProductsApi } from '../api/supplierProducts.api'
import type {
  SupplierProduct,
  SupplierProductWithRelations,
  CreateSupplierProductDto,
  UpdateSupplierProductDto,
  SupplierProductListQuery,
  PaginationParams
} from '../types/supplier-product.types'
import { parseSupplierProductError } from '../utils/errorParser'

interface SupplierProductsState {
  supplierProducts: SupplierProductWithRelations[]
  pagination: PaginationParams | null
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  currentQuery: SupplierProductListQuery | null
  selectedItems: string[]

  fetchSupplierProducts: (query?: SupplierProductListQuery, signal?: AbortSignal) => Promise<void>
  createSupplierProduct: (data: CreateSupplierProductDto) => Promise<SupplierProduct>
  updateSupplierProduct: (id: string, data: UpdateSupplierProductDto) => Promise<SupplierProduct>
  deleteSupplierProduct: (id: string) => Promise<void>
  restoreSupplierProduct: (id: string) => Promise<void>
  bulkDeleteSupplierProducts: (ids: string[]) => Promise<void>
  bulkRestoreSupplierProducts: (ids: string[]) => Promise<void>
  setSelectedItems: (items: string[]) => void
  clearError: () => void
  reset: () => void
}

export const useSupplierProductsStore = create<SupplierProductsState>((set) => ({
  supplierProducts: [],
  pagination: null,
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  currentQuery: null,
  selectedItems: [],

  fetchSupplierProducts: async (query = {}, signal) => {
    set({ fetchLoading: true, error: null, currentQuery: query, selectedItems: [] })
    try {
      const res = await supplierProductsApi.list(query, signal)
      if (signal?.aborted) return
      set({
        supplierProducts: res.data,
        pagination: res.pagination,
        fetchLoading: false
      })
    } catch (error) {
      if (signal?.aborted) return
      const message = parseSupplierProductError(error)
      set({ error: message, fetchLoading: false })
    }
  },

  createSupplierProduct: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplierProduct = await supplierProductsApi.create(data)
      set(state => ({
        supplierProducts: [...state.supplierProducts, supplierProduct],
        mutationLoading: false
      }))
      return supplierProduct
    } catch (error) {
      const message = parseSupplierProductError(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  updateSupplierProduct: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplierProduct = await supplierProductsApi.update(id, data)
      // Refetch to get updated relations
      const state = useSupplierProductsStore.getState()
      if (state.currentQuery) {
        await state.fetchSupplierProducts(state.currentQuery)
      }
      return supplierProduct
    } catch (error) {
      const message = parseSupplierProductError(error)
      set({ error: message, mutationLoading: false })
      throw error
    } finally {
      set({ mutationLoading: false })
    }
  },

  deleteSupplierProduct: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await supplierProductsApi.delete(id)
      set(state => ({
        supplierProducts: state.supplierProducts.filter(sp => sp.id !== id),
        selectedItems: state.selectedItems.filter(itemId => itemId !== id),
        mutationLoading: false
      }))
    } catch (error) {
      const message = parseSupplierProductError(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  restoreSupplierProduct: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await supplierProductsApi.restore(id)
      const state = useSupplierProductsStore.getState()
      if (state.currentQuery) {
        await state.fetchSupplierProducts(state.currentQuery)
      }
    } catch (error) {
      const message = parseSupplierProductError(error)
      set({ error: message })
      throw error
    } finally {
      set({ mutationLoading: false })
    }
  },

  bulkDeleteSupplierProducts: async (ids) => {
    set({ mutationLoading: true, error: null })
    try {
      await supplierProductsApi.bulkDelete(ids)
      set(state => ({
        supplierProducts: state.supplierProducts.filter(sp => !ids.includes(sp.id)),
        selectedItems: [],
        mutationLoading: false
      }))
    } catch (error) {
      const message = parseSupplierProductError(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  bulkRestoreSupplierProducts: async (ids) => {
    set({ mutationLoading: true, error: null })
    try {
      await supplierProductsApi.bulkRestore(ids)
      const state = useSupplierProductsStore.getState()
      if (state.currentQuery) {
        await state.fetchSupplierProducts(state.currentQuery)
      }
    } catch (error) {
      const message = parseSupplierProductError(error)
      set({ error: message })
      throw error
    } finally {
      set({ mutationLoading: false, selectedItems: [] })
    }
  },

  setSelectedItems: (items) => set({ selectedItems: items }),

  clearError: () => set({ error: null }),

  reset: () => set({
    supplierProducts: [],
    pagination: null,
    selectedItems: [],
    error: null,
    currentQuery: null
  })
}))

