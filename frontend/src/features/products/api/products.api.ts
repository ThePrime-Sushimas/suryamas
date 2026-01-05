import api from '@/lib/axios'
import type { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

export const productsApi = {
  list: async (page = 1, limit = 10, sort?: Record<string, unknown>, filter?: Record<string, unknown>, includeDeleted = false) => {
    const res = await api.get<PaginatedResponse<Product>>('/products', { params: { page, limit, ...sort, ...filter, includeDeleted } })
    return res.data
  },

  search: async (q: string, page = 1, limit = 10, includeDeleted = false) => {
    const res = await api.get<PaginatedResponse<Product>>('/products/search', { params: { q, page, limit, includeDeleted } })
    return res.data
  },

  getById: async (id: string, includeDeleted = false) => {
    const res = await api.get<ApiResponse<Product>>(`/products/${id}`, { params: { includeDeleted } })
    return res.data.data
  },

  create: async (data: CreateProductDto) => {
    const res = await api.post<ApiResponse<Product>>('/products', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateProductDto) => {
    const res = await api.put<ApiResponse<Product>>(`/products/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/products/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/products/bulk/delete', { ids })
  },

  // UOMs
  getUoms: async (productId: string, includeDeleted = false) => {
    const res = await api.get<ApiResponse<ProductUom[]>>(`/products/${productId}/uoms`, { params: { includeDeleted } })
    return res.data.data
  },

  createUom: async (productId: string, data: CreateProductUomDto) => {
    const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms`, data)
    return res.data.data
  },

  updateUom: async (productId: string, uomId: string, data: UpdateProductUomDto) => {
    const res = await api.put<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}`, data)
    return res.data.data
  },

  deleteUom: async (productId: string, uomId: string) => {
    await api.delete(`/products/${productId}/uoms/${uomId}`)
  }
}
