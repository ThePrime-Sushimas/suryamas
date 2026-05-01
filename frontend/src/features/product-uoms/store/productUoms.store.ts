import { create } from 'zustand'
import { productUomsApi } from '../api/productUoms.api'
import { parseApiError } from '@/lib/errorParser'
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

const sortUoms = (uoms: ProductUom[]) =>
  [...uoms].sort((a, b) => {
    if (a.is_base_unit) return -1
    if (b.is_base_unit) return 1
    return a.conversion_factor - b.conversion_factor
  })

export const useProductUomsStore = create<ProductUomsState>((set) => ({
  uoms: [],
  loading: false,
  error: null,

  fetchUoms: async (productId, includeDeleted = false) => {
    set({ loading: true, error: null })
    try {
      const uoms = await productUomsApi.list(productId, includeDeleted)
      set({ uoms: sortUoms(uoms), loading: false })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat satuan produk'), loading: false })
    }
  },

  createUom: async (productId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productUomsApi.create(productId, data)
      set(state => ({ uoms: sortUoms([...state.uoms, uom]), loading: false }))
      return uom
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat satuan produk'), loading: false })
      throw error
    }
  },

  updateUom: async (productId, uomId, data) => {
    set({ loading: true, error: null })
    try {
      const uom = await productUomsApi.update(productId, uomId, data)
      set(state => ({
        uoms: sortUoms(state.uoms.map(u => u.id === uomId ? uom : u)),
        loading: false,
      }))
      return uom
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memperbarui satuan produk'), loading: false })
      throw error
    }
  },

  deleteUom: async (productId, uomId) => {
    set({ loading: true, error: null })
    try {
      await productUomsApi.delete(productId, uomId)
      set(state => ({
        uoms: state.uoms.filter(u => u.id !== uomId),
        loading: false,
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal menghapus satuan produk'), loading: false })
      throw error
    }
  },

  restoreUom: async (productId, uomId) => {
    set({ loading: true, error: null })
    try {
      const uom = await productUomsApi.restore(productId, uomId)
      set(state => ({
        uoms: state.uoms.map(u => u.id === uomId ? uom : u),
        loading: false,
      }))
      return uom
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memulihkan satuan produk'), loading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))
