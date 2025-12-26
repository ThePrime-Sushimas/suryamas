import api from '@/lib/axios'
import type { Branch, CreateBranchDto, UpdateBranchDto, BranchSort, BranchFilter } from '@/types/branch'
import type { Paginated } from '@/types/pagination'

export const branchService = {
  list: (
    page: number,
    limit: number,
    sort?: BranchSort | null,
    filter?: BranchFilter | null
  ) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (sort?.field && sort?.order) {
      params.append('sort', sort.field)
      params.append('order', sort.order)
    }

    if (filter?.search) {
      params.append('q', filter.search)
    }
    if (filter?.status) {
      params.append('status', filter.status)
    }
    if (filter?.city) {
      params.append('city', filter.city)
    }

    return api.get<Paginated<Branch>>(`/branches?${params.toString()}`)
  },

  search: (q: string, page: number, limit: number, sort?: BranchSort | null) => {
    const params = new URLSearchParams()
    params.append('q', q)
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (sort?.field && sort?.order) {
      params.append('sort', sort.field)
      params.append('order', sort.order)
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

  export: (token: string) => {
    const params = new URLSearchParams()
    params.append('token', token)
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
