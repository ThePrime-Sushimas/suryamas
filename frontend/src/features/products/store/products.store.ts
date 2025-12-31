import { create } from 'zustand'
import { productsApi } from '../api/products.api'
import type { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from '../types'

interface ProductsState {
  products: Product[]
  uoms: ProductUom[]
  loading: boolean
  error: string | null
  
  fetchProducts: (page?: number, limit?: number, sort?: any, filter?: any, includeDeleted?: boolean) => Promise<void>
  searchProducts: (q: string, page?: number, limit?: number, includeDeleted?: boolean) => Promise<void>
  createProduct: (data: CreateProductDto) => Promise<Product>
  updateProduct: (id: string, data: UpdateProductDto) => Promise<Product>
  deleteProduct: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  
  fetchUoms: (productId: string, includeDeleted?: boolean) => Promise<void>
  createUom: (productId: string, data: CreateProductUomDto) => Promise<ProductUom>
  updateUom: (productId: string, uomId: string, data: UpdateProductUomDto) => Promise<ProductUom>
  deleteUom: (productId: string, uomId: string) => Promise<void>
  
  clearError: () => void
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  uoms: [],
  loading: false,
  error: null,

  fetchProducts: async (page = 1, limit = 10, sort, filter, includeDeleted = false) => {
    set({ loading: true, error: null })
    try {
      const res = await productsApi.list(page, limit, sort, filter, includeDeleted)
      set({ products: res.data, loading: false })
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to fetch products', loading: false })
    }
  },

  searchProducts: async (q, page = 1, limit = 10, includeDeleted = false) => {
    set({ loading: true, error: null })
    try {
      const res = await productsApi.search(q, page, limit, includeDeleted)
      set({ products: res.data, loading: false })
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to search products', loading: false })
    }
  },

  createProduct: async (data) => {
    set({ loading: true, error: null })
    try {
      const product = await productsApi.create(data)
      set({ loading: false })
      return product
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to create product', loading: false })
      throw error
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
      set({ error: error.response?.data?.error || 'Failed to update product', loading: false })
      throw error
    }
  },

  deleteProduct: async (id) => {
    const prev = get().products
    set(state => ({ products: state.products.filter(p => p.id !== id) }))
    try {
      await productsApi.delete(id)
    } catch (error: unknown) {
      set({ products: prev, error: error.response?.data?.error || 'Failed to delete product' })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().products
    set(state => ({ products: state.products.filter(p => !ids.includes(p.id)) }))
    try {
      await productsApi.bulkDelete(ids)
    } catch (error: unknown) {
      set({ products: prev, error: error.response?.data?.error || 'Failed to delete products' })
      throw error
    }
  },

  fetchUoms: async (productId, includeDeleted = false) => {
    set({ loading: true, error: null })
    try {
      const uoms = await productsApi.getUoms(productId, includeDeleted)
      set({ uoms, loading: false })
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to fetch UOMs', loading: false })
    }
  },

  createUom: async (productId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productsApi.createUom(productId, data)
      set({ loading: false })
      return uom
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to create UOM', loading: false })
      throw error
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
      set({ error: error.response?.data?.error || 'Failed to update UOM', loading: false })
      throw error
    }
  },

  deleteUom: async (productId, uomId) => {
    const prev = get().uoms
    set(state => ({ uoms: state.uoms.filter(u => u.id !== uomId) }))
    try {
      await productsApi.deleteUom(productId, uomId)
    } catch (error: unknown) {
      set({ uoms: prev, error: error.response?.data?.error || 'Failed to delete UOM' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
