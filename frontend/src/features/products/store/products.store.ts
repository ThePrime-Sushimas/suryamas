import { create } from 'zustand'
import { productsApi } from '../api/products.api'
import type { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from '../types'

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface ProductsState {
  products: Product[]
  currentProduct: Product | null
  uoms: ProductUom[]
  pagination: PaginationState
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  selectedIds: string[]
  currentRequestId: number
  
  fetchProducts: (page?: number, limit?: number, sort?: Record<string, unknown>, filter?: Record<string, unknown>, includeDeleted?: boolean) => Promise<void>
  fetchProductById: (id: string) => Promise<Product>
  searchProducts: (q: string, page?: number, limit?: number, includeDeleted?: boolean) => Promise<void>
  createProduct: (data: CreateProductDto) => Promise<Product>
  updateProduct: (id: string, data: UpdateProductDto) => Promise<Product>
  deleteProduct: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  restoreProduct: (id: string) => Promise<void>
  bulkRestore: (ids: string[]) => Promise<void>
  
  fetchUoms: (productId: string) => Promise<void>
  createUom: (productId: string, data: CreateProductUomDto) => Promise<ProductUom>
  updateUom: (productId: string, uomId: string, data: UpdateProductUomDto) => Promise<ProductUom>
  deleteUom: (productId: string, uomId: string) => Promise<void>
  
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  clearError: () => void
}

const initialState = {
  products: [],
  currentProduct: null,
  uoms: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  selectedIds: [],
  currentRequestId: 0
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  ...initialState,

  fetchProducts: async (page = 1, limit = 10, sort, filter, includeDeleted = false) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, fetchLoading: true, error: null })
    
    try {
      const res = await productsApi.list(page, limit, sort, filter, includeDeleted)
      
      if (get().currentRequestId === requestId) {
        set({
          products: res.data,
          pagination: res.pagination,
          fetchLoading: false
        })
      }
    } catch (error: unknown) {
      if (get().currentRequestId === requestId) {
        const message = error instanceof Error ? error.message : 'Failed to fetch products'
        set({ error: message, fetchLoading: false })
      }
    }
  },

  fetchProductById: async (id) => {
    set({ fetchLoading: true, error: null })
    try {
      const product = await productsApi.getById(id)
      set({ currentProduct: product, fetchLoading: false })
      return product
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch product'
      set({ error: message, fetchLoading: false })
      throw error
    }
  },

  searchProducts: async (q, page = 1, limit = 10, includeDeleted = false) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, fetchLoading: true, error: null })
    
    try {
      const res = await productsApi.search(q, page, limit, includeDeleted)
      
      if (get().currentRequestId === requestId) {
        set({
          products: res.data,
          pagination: res.pagination,
          fetchLoading: false
        })
      }
    } catch (error: unknown) {
      if (get().currentRequestId === requestId) {
        const message = error instanceof Error ? error.message : 'Failed to search products'
        set({ error: message, fetchLoading: false })
      }
    }
  },

  createProduct: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const product = await productsApi.create(data)
      set({ mutationLoading: false })
      return product
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create product'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  updateProduct: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const product = await productsApi.update(id, data)
      set(state => ({
        products: state.products.map(p => p.id === id ? product : p),
        currentProduct: state.currentProduct?.id === id ? product : state.currentProduct,
        mutationLoading: false
      }))
      return product
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update product'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  deleteProduct: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await productsApi.delete(id)
      set(state => ({
        products: state.products.map(p => p.id === id ? { ...p, is_deleted: true } : p),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete product'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    set({ mutationLoading: true, error: null })
    try {
      await productsApi.bulkDelete(ids)
      set(state => ({
        products: state.products.map(p => ids.includes(p.id) ? { ...p, is_deleted: true } : p),
        selectedIds: [],
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete products'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  restoreProduct: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      const product = await productsApi.restore(id)
      set(state => ({
        products: state.products.map(p => p.id === id ? product : p),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore product'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  bulkRestore: async (ids) => {
    set({ mutationLoading: true, error: null })
    try {
      await productsApi.bulkRestore(ids)
      set(state => ({
        products: state.products.filter(p => !ids.includes(p.id)),
        selectedIds: [],
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore products'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  fetchUoms: async (productId) => {
    set({ fetchLoading: true, error: null })
    try {
      const uoms = await productsApi.getUoms(productId, false)
      set({ uoms, fetchLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch UOMs'
      set({ error: message, fetchLoading: false })
    }
  },

  createUom: async (productId, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const uom = await productsApi.createUom(productId, data)
      set({ mutationLoading: false })
      return uom
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create UOM'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  updateUom: async (productId, uomId, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const uom = await productsApi.updateUom(productId, uomId, data)
      set(state => ({
        uoms: state.uoms.map(u => u.id === uomId ? uom : u),
        mutationLoading: false
      }))
      return uom
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update UOM'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  deleteUom: async (productId, uomId) => {
    set({ mutationLoading: true, error: null })
    try {
      await productsApi.deleteUom(productId, uomId)
      set(state => ({
        uoms: state.uoms.map(u => u.id === uomId ? { ...u, deleted_at: new Date().toISOString() } : u),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete UOM'
      set({ error: message, mutationLoading: false })
      throw error
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
