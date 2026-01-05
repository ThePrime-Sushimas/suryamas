import api from '@/lib/axios'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }

export const productUomsApi = {
  list: async (productId: string, includeDeleted = false) => {
    const res = await api.get<ApiResponse<ProductUom[]>>(`/products/${productId}/uoms`, { 
      params: { includeDeleted } 
    })
    return res.data.data
  },

  create: async (productId: string, data: CreateProductUomDto) => {
    const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms`, data)
    return res.data.data
  },

  update: async (productId: string, uomId: string, data: UpdateProductUomDto) => {
    const res = await api.put<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}`, data)
    return res.data.data
  },

  delete: async (productId: string, uomId: string) => {
    await api.delete(`/products/${productId}/uoms/${uomId}`)
  },

  restore: async (productId: string, uomId: string) => {
    const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}/restore`)
    return res.data.data
  }
}
