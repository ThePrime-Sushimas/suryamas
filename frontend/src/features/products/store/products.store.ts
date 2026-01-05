import { create } from 'zustand'
import { productsApi } from '../api/products.api'
import type { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from '../types'

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ProductsState {
  products: Product[]
  uoms: ProductUom[]
  pagination: PaginationState
  loading: boolean
  error: string | null
  selectedIds: string[]
  
  fetchProducts: (page?: number, limit?: number, sort?: Record<string, unknown>, filter?: Record<string, unknown>) => Promise<void>
  searchProducts: (q: string, page?: number, limit?: number) => Promise<void>
  createProduct: (data: CreateProductDto) => Promise<Product>
  updateProduct: (id: string, data: UpdateProductDto) => Promise<Product>
  deleteProduct: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  
  fetchUoms: (productId: string) => Promise<void>
  createUom: (productId: string, data: CreateProductUomDto) => Promise<ProductUom>
  updateUom: (productId: string, uomId: string, data: UpdateProductUomDto) => Promise<ProductUom>
  deleteUom: (productId: string, uomId: string) => Promise<void>
  
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  clearError: () => void
}

const handleApiError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: string } } }
    return apiError.response?.data?.error || 'An error occurred'
  }
  return 'An unexpected error occurred'
}

export const useProductsStore = create<ProductsState>((set) => ({
  products: [],
  uoms: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  loading: false,
  error: null,
  selectedIds: [],

  fetchProducts: async (page = 1, limit = 10, sort, filter) => {
    set({ loading: true, error: null })
    try {
      const res = await productsApi.list(page, limit, sort, filter, false)
      set({
        products: res.data,
        pagination: {
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages: Math.ceil(res.pagination.total / res.pagination.limit)
        },
        loading: false
      })
    } catch (error: unknown) {
      set({ error: handleApiError(error), loading: false })
    }
  },

  searchProducts: async (q, page = 1, limit = 10) => {
    set({ loading: true, error: null })
    try {
      const res = await productsApi.search(q, page, limit, false)
      set({
        products: res.data,
        pagination: {
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages: Math.ceil(res.pagination.total / res.pagination.limit)
        },
        loading: false
      })
    } catch (error: unknown) {
      set({ error: handleApiError(error), loading: false })
    }
  },

  createProduct: async (data) => {
    set({ loading: true, error: null })
    try {
      const product = await productsApi.create(data)
      set({ loading: false })
      return product
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  updateProduct: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const product = await productsApi.update(id, data)
      set(state => ({
        products: state.products.map(p => p.id === id ? product : p),
        loading: false
      }))
      return product
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  deleteProduct: async (id) => {
    set({ loading: true, error: null })
    try {
      await productsApi.delete(id)
      set(state => ({
        products: state.products.filter(p => p.id !== id),
        loading: false
      }))
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  bulkDelete: async (ids) => {
    set({ loading: true, error: null })
    try {
      await productsApi.bulkDelete(ids)
      set(state => ({
        products: state.products.filter(p => !ids.includes(p.id)),
        selectedIds: [],
        loading: false
      }))
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  fetchUoms: async (productId) => {
    set({ loading: true, error: null })
    try {
      const uoms = await productsApi.getUoms(productId, false)
      set({ uoms, loading: false })
    } catch (error: unknown) {
      set({ error: handleApiError(error), loading: false })
    }
  },

  createUom: async (productId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productsApi.createUom(productId, data)
      set({ loading: false })
      return uom
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  updateUom: async (productId, uomId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productsApi.updateUom(productId, uomId, data)
      set(state => ({
        uoms: state.uoms.map(u => u.id === uomId ? uom : u),
        loading: false
      }))
      return uom
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  deleteUom: async (productId, uomId) => {
    set({ loading: true, error: null })
    try {
      await productsApi.deleteUom(productId, uomId)
      set(state => ({
        uoms: state.uoms.filter(u => u.id !== uomId),
        loading: false
      }))
    } catch (error: unknown) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  toggleSelect: (id) => {
    set(state => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter(i => i !== id)
        : [...state.selectedIds, id]
    }))
  },

  toggleSelectAll: () => {
    set(state => ({
      selectedIds: state.selectedIds.length === state.products.length
        ? []
        : state.products.map(p => p.id)
    }))
  },

  clearSelection: () => set({ selectedIds: [] }),
  clearError: () => set({ error: null })
}))
