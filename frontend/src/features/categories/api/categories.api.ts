import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Category, SubCategory, CreateCategoryDto, UpdateCategoryDto, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }

// ── Category React Query Hooks ──

export const useCategories = (params: { page?: number; limit?: number; is_active?: string; is_deleted?: string; search?: string }) =>
  useQuery({
    queryKey: ['categories', params],
    queryFn: async () => {
      if (params.search) {
        const { data } = await api.get<PaginatedResponse<Category>>('/categories/search', { params: { q: params.search, page: params.page ?? 1, limit: params.limit ?? 10 } })
        return { data: data.data, pagination: data.pagination }
      }
      if (params.is_deleted === 'true') {
        const { data } = await api.get<PaginatedResponse<Category>>('/categories/trash', { params: { page: params.page ?? 1, limit: params.limit ?? 10 } })
        return { data: data.data, pagination: data.pagination }
      }
      const qp: Record<string, string | number> = { page: params.page ?? 1, limit: params.limit ?? 10 }
      if (params.is_active) qp.is_active = params.is_active
      const { data } = await api.get<PaginatedResponse<Category>>('/categories', { params: qp })
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useCategory = (id: string) =>
  useQuery({
    queryKey: ['categories', id],
    queryFn: async () => { const { data } = await api.get<ApiResponse<Category>>(`/categories/${id}`); return data.data },
    enabled: !!id,
  })

export const useCreateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateCategoryDto) => { const { data } = await api.post<ApiResponse<Category>>('/categories', body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useUpdateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateCategoryDto & { id: string }) => { const { data } = await api.put<ApiResponse<Category>>(`/categories/${id}`, body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useDeleteCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/categories/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useBulkDeleteCategories = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => { await api.post('/categories/bulk/delete', { ids }) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useUpdateCategoryStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => { const { data } = await api.patch<ApiResponse<Category>>(`/categories/${id}/status`, { is_active }); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useRestoreCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.patch(`/categories/${id}/restore`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

// ── SubCategory React Query Hooks ──

export const useSubCategories = (params: { page?: number; limit?: number; category_id?: string; is_deleted?: string; search?: string }) =>
  useQuery({
    queryKey: ['sub-categories', params],
    queryFn: async () => {
      if (params.search) {
        const { data } = await api.get<PaginatedResponse<SubCategory>>('/sub-categories/search', { params: { q: params.search, page: params.page ?? 1, limit: params.limit ?? 10 } })
        return { data: data.data, pagination: data.pagination }
      }
      if (params.is_deleted === 'true') {
        const { data } = await api.get<PaginatedResponse<SubCategory>>('/sub-categories/trash', { params: { page: params.page ?? 1, limit: params.limit ?? 10 } })
        return { data: data.data, pagination: data.pagination }
      }
      const qp: Record<string, string | number> = { page: params.page ?? 1, limit: params.limit ?? 10 }
      if (params.category_id) qp.category_id = params.category_id
      const { data } = await api.get<PaginatedResponse<SubCategory>>('/sub-categories', { params: qp })
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useSubCategory = (id: string) =>
  useQuery({
    queryKey: ['sub-categories', id],
    queryFn: async () => { const { data } = await api.get<ApiResponse<SubCategory>>(`/sub-categories/${id}`); return data.data },
    enabled: !!id,
  })

export const useCreateSubCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateSubCategoryDto) => { const { data } = await api.post<ApiResponse<SubCategory>>('/sub-categories', body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-categories'] }),
  })
}

export const useUpdateSubCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSubCategoryDto & { id: string }) => { const { data } = await api.put<ApiResponse<SubCategory>>(`/sub-categories/${id}`, body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-categories'] }),
  })
}

export const useDeleteSubCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/sub-categories/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-categories'] }),
  })
}

export const useBulkDeleteSubCategories = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => { await api.post('/sub-categories/bulk/delete', { ids }) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-categories'] }),
  })
}

export const useRestoreSubCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.patch(`/sub-categories/${id}/restore`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sub-categories'] }),
  })
}

// ── All categories for dropdowns ──

export const useAllCategories = () =>
  useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => { const { data } = await api.get<PaginatedResponse<Category>>('/categories', { params: { limit: 500, is_active: 'true' } }); return data.data },
    staleTime: 5 * 60_000,
  })

// ── Legacy API objects (backward compat) ──

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
  getById: async (id: string) => { const res = await api.get<ApiResponse<Category>>(`/categories/${id}`); return res.data.data },
  create: async (data: CreateCategoryDto) => { const res = await api.post<ApiResponse<Category>>('/categories', data); return res.data.data },
  update: async (id: string, data: UpdateCategoryDto) => { const res = await api.put<ApiResponse<Category>>(`/categories/${id}`, data); return res.data.data },
  delete: async (id: string) => { await api.delete(`/categories/${id}`) },
  bulkDelete: async (ids: string[]) => { await api.post('/categories/bulk/delete', { ids }) },
  updateStatus: async (id: string, isActive: boolean) => { const res = await api.patch<ApiResponse<Category>>(`/categories/${id}/status`, { is_active: isActive }); return res.data.data },
  restore: async (id: string) => { await api.patch(`/categories/${id}/restore`) },
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
  getById: async (id: string) => { const res = await api.get<ApiResponse<SubCategory>>(`/sub-categories/${id}`); return res.data.data },
  create: async (data: CreateSubCategoryDto) => { const res = await api.post<ApiResponse<SubCategory>>('/sub-categories', data); return res.data.data },
  update: async (id: string, data: UpdateSubCategoryDto) => { const res = await api.put<ApiResponse<SubCategory>>(`/sub-categories/${id}`, data); return res.data.data },
  delete: async (id: string) => { await api.delete(`/sub-categories/${id}`) },
  bulkDelete: async (ids: string[]) => { await api.post('/sub-categories/bulk/delete', { ids }) },
  restore: async (id: string) => { await api.patch(`/sub-categories/${id}/restore`) },
  getByCategoryId: async (categoryId: string) => { const res = await api.get<ApiResponse<SubCategory[]>>(`/sub-categories/category/${categoryId}`); return res.data.data },
}
