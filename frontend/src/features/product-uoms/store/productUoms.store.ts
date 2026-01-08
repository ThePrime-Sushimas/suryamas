import { create } from 'zustand'
import { productUomsApi } from '../api/productUoms.api'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../types'

interface ProductUomsState {
  uoms: ProductUom[]
  loading: boolean
  error: string | null
  
  fetchUoms: (productId: string, includeDeleted?: boolean) => Promise<void>
  createUom: (productId: string, data: CreateProductUomDto) => Promise<ProductUom>
  updateUom: (productId: string, uomId: string, data: UpdateProductUomDto) => Promise<ProductUom>
  deleteUom: (productId: string, uomId: string) => Promise<void>
  restoreUom: (productId: string, uomId: string) => Promise<ProductUom>
  clearError: () => void
}

const handleApiError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: string } } }
    return apiError.response?.data?.error || 'An error occurred'
  }
  return 'An unexpected error occurred'
}

export const useProductUomsStore = create<ProductUomsState>((set) => ({
  uoms: [],
  loading: false,
  error: null,

  fetchUoms: async (productId, includeDeleted = false) => {
    set({ loading: true, error: null })
    try {
      const uoms = await productUomsApi.list(productId, includeDeleted)
      const sortedUoms = uoms.sort((a, b) => {
        if (a.is_base_unit) return -1
        if (b.is_base_unit) return 1
        return a.conversion_factor - b.conversion_factor
      })
      set({ uoms: sortedUoms, loading: false })
    } catch (error) {
      set({ error: handleApiError(error), loading: false })
    }
  },

  createUom: async (productId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productUomsApi.create(productId, data)
      set(state => {
        const newUoms = [...state.uoms, uom].sort((a, b) => {
          if (a.is_base_unit) return -1
          if (b.is_base_unit) return 1
          return a.conversion_factor - b.conversion_factor
        })
        return { uoms: newUoms, loading: false, error: null }
      })
      return uom
    } catch (error) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  updateUom: async (productId, uomId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productUomsApi.update(productId, uomId, data)
      set(state => ({
        uoms: state.uoms.map(u => u.id === uomId ? uom : u),
        loading: false,
        error: null
      }))
      return uom
    } catch (error) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  deleteUom: async (productId, uomId) => {
    set({ loading: true, error: null })
    try {
      await productUomsApi.delete(productId, uomId)
      set(state => ({
        uoms: state.uoms.filter(u => u.id !== uomId),
        loading: false,
        error: null
      }))
    } catch (error) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  restoreUom: async (productId, uomId) => {
    set({ loading: true, error: null })
    try {
      const uom = await productUomsApi.restore(productId, uomId)
      set(state => ({
        uoms: state.uoms.map(u => u.id === uomId ? uom : u),
        loading: false,
        error: null
      }))
      return uom
    } catch (error) {
      const errorMsg = handleApiError(error)
      set({ error: errorMsg, loading: false })
      throw new Error(errorMsg)
    }
  },

  clearError: () => set({ error: null })
}))
