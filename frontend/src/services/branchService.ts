import api from '@/lib/axios'
import type { Branch, CreateBranchDto, UpdateBranchDto } from '@/types/branch'

type Paginated<T> = {
  success: boolean
  data: T[]
  pagination: { total: number; page: number; limit: number }
}

export const branchService = {
  list: (
    page: number,
    limit: number,
    sort?: { field: string; order: string },
    filter?: Record<string, any>
  ) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (sort?.field && sort?.order) {
      params.append('sort.field', sort.field)
      params.append('sort.order', sort.order)
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        if (Array.isArray(value)) {
          value.forEach(v => params.append(`filter[${key}]`, String(v)))
        } else {
          params.append(`filter[${key}]`, String(value))
        }
      })
    }

    return api.get<Paginated<Branch>>(`/branches?${params.toString()}`)
  },

  search: (q: string, page: number, limit: number, filter?: Record<string, any>) => {
    const params = new URLSearchParams()
    params.append('q', q)
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        if (Array.isArray(value)) {
          value.forEach(v => params.append(`filter[${key}]`, String(v)))
        } else {
          params.append(`filter[${key}]`, String(value))
        }
      })
    }

    return api.get<Paginated<Branch>>(`/branches/search?${params.toString()}`)
  },

  getById: (id: string) => api.get<{ success: boolean; data: Branch }>(`/branches/${id}`),

  create: (data: CreateBranchDto) =>
    api.post<{ success: boolean; data: Branch }>('/branches', data),

  update: (id: string, data: UpdateBranchDto) =>
    api.put<{ success: boolean; data: Branch }>(`/branches/${id}`, data),

  delete: (id: string) => api.delete(`/branches/${id}`),

  bulkUpdateStatus: (ids: string[], status: string) =>
    api.post('/branches/bulk/update-status', { ids, status }),

  bulkDelete: (ids: string[]) => api.post('/branches/bulk/delete', { ids }),

  getFilterOptions: () =>
    api.get<{ success: boolean; data: { cities: string[]; statuses: string[]; hariOperasional: string[] } }>('/branches/filter-options'),

  getExportToken: () => api.get<{ success: boolean; data: string }>('/branches/export/token'),

  export: (token: string, filter?: Record<string, any>) => {
    const params = new URLSearchParams()
    params.append('token', token)

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        if (Array.isArray(value)) {
          value.forEach(v => params.append(`filter[${key}]`, String(v)))
        } else {
          params.append(`filter[${key}]`, String(value))
        }
      })
    }

    return api.get(`/branches/export?${params.toString()}`, { responseType: 'blob' })
  },

  importPreview: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ success: boolean; data: any[] }>(
      '/branches/import/preview',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  import: (file: File, skipDuplicates: boolean) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(
      `/branches/import?skipDuplicates=${skipDuplicates}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  }
}
