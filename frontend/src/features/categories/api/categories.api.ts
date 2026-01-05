import api from '@/lib/axios'
import type { Category, SubCategory, CreateCategoryDto, UpdateCategoryDto, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

export const categoriesApi = {
  list: async (page = 1, limit = 10, isActive?: string) => {
    const params: Record<string, string | number> = { page, limit }
    if (isActive) params.is_active = isActive
    const res = await api.get<PaginatedResponse<Category>>('/categories', { params })
    return res.data
  },

  trash: async (page = 1, limit = 10) => {
    const res = await api.get<PaginatedResponse<Category>>('/categories/trash', { params: { page, limit } })
    return res.data
  },

  search: async (q: string, page = 1, limit = 10) => {
    const res = await api.get<PaginatedResponse<Category>>('/categories/search', { params: { q, page, limit } })
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<Category>>(`/categories/${id}`)
    return res.data.data
  },

  create: async (data: CreateCategoryDto) => {
    const res = await api.post<ApiResponse<Category>>('/categories', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateCategoryDto) => {
    const res = await api.put<ApiResponse<Category>>(`/categories/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/categories/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/categories/bulk/delete', { ids })
  },

  updateStatus: async (id: string, isActive: boolean) => {
    const res = await api.patch<ApiResponse<Category>>(`/categories/${id}/status`, { is_active: isActive })
    return res.data.data
  },

  restore: async (id: string) => {
    await api.patch(`/categories/${id}/restore`)
  }
}

export const subCategoriesApi = {
  list: async (page = 1, limit = 10, categoryId?: string) => {
    const res = await api.get<PaginatedResponse<SubCategory>>('/sub-categories', { params: { page, limit, category_id: categoryId } })
    return res.data
  },

  trash: async (page = 1, limit = 10) => {
    const res = await api.get<PaginatedResponse<SubCategory>>('/sub-categories/trash', { params: { page, limit } })
    return res.data
  },

  search: async (q: string, page = 1, limit = 10) => {
    const res = await api.get<PaginatedResponse<SubCategory>>('/sub-categories/search', { params: { q, page, limit } })
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<SubCategory>>(`/sub-categories/${id}`)
    return res.data.data
  },

  create: async (data: CreateSubCategoryDto) => {
    const res = await api.post<ApiResponse<SubCategory>>('/sub-categories', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateSubCategoryDto) => {
    const res = await api.put<ApiResponse<SubCategory>>(`/sub-categories/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/sub-categories/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/sub-categories/bulk/delete', { ids })
  },

  restore: async (id: string) => {
    await api.patch(`/sub-categories/${id}/restore`)
  },

  getByCategoryId: async (categoryId: string) => {
    const res = await api.get<ApiResponse<SubCategory[]>>(`/sub-categories/category/${categoryId}`)
    return res.data.data
  }
}
