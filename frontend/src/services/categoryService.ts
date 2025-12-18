import axios from '@/lib/axios'
import type { Category, SubCategory } from '@/types/category'

export const categoryService = {
  list: (page = 1, limit = 10) =>
    axios.get('/categories', { params: { page, limit } }),

  trash: (page = 1, limit = 10) =>
    axios.get('/categories/trash', { params: { page, limit } }),

  search: (q: string, page = 1, limit = 10) =>
    axios.get('/categories/search', { params: { q, page, limit } }),

  getById: (id: string) => axios.get(`/categories/${id}`),

  create: (data: Partial<Category>) => axios.post('/categories', data),

  update: (id: string, data: Partial<Category>) => axios.put(`/categories/${id}`, data),

  delete: (id: string) => axios.delete(`/categories/${id}`),

  restore: (id: string) => axios.patch(`/categories/${id}/restore`),

  bulkDelete: (ids: string[]) => axios.post('/categories/bulk/delete', { ids }),
}

export const subCategoryService = {
  list: (page = 1, limit = 10, categoryId?: string) =>
    axios.get('/sub-categories', { params: { page, limit, category_id: categoryId } }),

  trash: (page = 1, limit = 10) =>
    axios.get('/sub-categories/trash', { params: { page, limit } }),

  search: (q: string, page = 1, limit = 10) =>
    axios.get('/sub-categories/search', { params: { q, page, limit } }),

  getById: (id: string) => axios.get(`/sub-categories/${id}`),

  getByCategory: (categoryId: string) => axios.get(`/sub-categories/category/${categoryId}`),

  create: (data: Partial<SubCategory>) => axios.post('/sub-categories', data),

  update: (id: string, data: Partial<SubCategory>) => axios.put(`/sub-categories/${id}`, data),

  delete: (id: string) => axios.delete(`/sub-categories/${id}`),

  restore: (id: string) => axios.patch(`/sub-categories/${id}/restore`),

  bulkDelete: (ids: string[]) => axios.post('/sub-categories/bulk/delete', { ids }),
}
