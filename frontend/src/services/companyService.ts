import api from '@/lib/axios'
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '@/types/company'

type Paginated<T> = {
  success: boolean
  data: T[]
  pagination: { total: number; page: number; limit: number }
}

export const companyService = {
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

    return api.get<Paginated<Company>>(`/companies?${params.toString()}`)
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

    return api.get<Paginated<Company>>(`/companies/search?${params.toString()}`)
  },

  getById: (id: string) => api.get<{ success: boolean; data: Company }>(`/companies/${id}`),

  create: (data: CreateCompanyDto) =>
    api.post<{ success: boolean; data: Company }>('/companies', data),

  update: (id: string, data: UpdateCompanyDto) =>
    api.put<{ success: boolean; data: Company }>(`/companies/${id}`, data),

  delete: (id: string) => api.delete(`/companies/${id}`),

  bulkUpdateStatus: (ids: string[], status: string) =>
    api.post('/companies/bulk/status', { ids, status }),

  bulkDelete: (ids: string[]) => api.post('/companies/bulk/delete', { ids }),

  getFilterOptions: () =>
    api.get<{ success: boolean; data: { statuses: string[]; types: string[] } }>('/companies/filter-options'),

  getExportToken: () => api.get<{ success: boolean; data: string }>('/companies/export/token'),

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

    return api.get(`/companies/export?${params.toString()}`, { responseType: 'blob' })
  },

  importPreview: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ success: boolean; data: any[] }>(
      '/companies/import/preview',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  import: (file: File, skipDuplicates: boolean) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(
      `/companies/import?skipDuplicates=${skipDuplicates}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  }
}
