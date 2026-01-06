import api from '@/lib/axios'
import type { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }

const handleApiError = (error: unknown): never => {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: string; message?: string } } }
    const errorMsg = apiError.response?.data?.error || apiError.response?.data?.message || 'An error occurred'
    throw new Error(errorMsg)
  }
  throw new Error('An unexpected error occurred')
}

export const productsApi = {
  list: async (page = 1, limit = 10, sort?: Record<string, unknown>, filter?: Record<string, unknown>, includeDeleted = false, signal?: AbortSignal) => {
    try {
      const params: Record<string, unknown> = { page, limit, includeDeleted }
      if (sort) Object.assign(params, sort)
      if (filter) Object.assign(params, filter)
      const res = await api.get<PaginatedResponse<Product>>('/products', { params, signal })
      return res.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  search: async (q: string, page = 1, limit = 10, includeDeleted = false, signal?: AbortSignal) => {
    try {
      const res = await api.get<PaginatedResponse<Product>>('/products/search', { params: { q, page, limit, includeDeleted }, signal })
      return res.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  getById: async (id: string, includeDeleted = false, signal?: AbortSignal) => {
    try {
      const res = await api.get<ApiResponse<Product>>(`/products/${id}`, { params: { includeDeleted }, signal })
      return res.data.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  create: async (data: CreateProductDto) => {
    try {
      const res = await api.post<ApiResponse<Product>>('/products', data)
      return res.data.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  update: async (id: string, data: UpdateProductDto) => {
    try {
      const res = await api.put<ApiResponse<Product>>(`/products/${id}`, data)
      return res.data.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/products/${id}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  bulkDelete: async (ids: string[]) => {
    try {
      await api.post('/products/bulk/delete', { ids })
    } catch (error) {
      return handleApiError(error)
    }
  },

  getUoms: async (productId: string, includeDeleted = false, signal?: AbortSignal) => {
    try {
      const res = await api.get<ApiResponse<ProductUom[]>>(`/products/${productId}/uoms`, { params: { includeDeleted }, signal })
      return res.data.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  createUom: async (productId: string, data: CreateProductUomDto) => {
    try {
      const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms`, data)
      return res.data.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  updateUom: async (productId: string, uomId: string, data: UpdateProductUomDto) => {
    try {
      const res = await api.put<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}`, data)
      return res.data.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  deleteUom: async (productId: string, uomId: string) => {
    try {
      await api.delete(`/products/${productId}/uoms/${uomId}`)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
