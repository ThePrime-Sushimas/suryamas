import api from '@/lib/axios'
import type { EmployeeResponse, EmployeeFormData, PaginatedApiResponse, ApiResponse, FilterOptions } from '../types'

export const employeesApi = {
  list: async (page = 1, limit = 10, sort?: string, order?: 'asc' | 'desc') => {
    const { data } = await api.get<PaginatedApiResponse<EmployeeResponse>>('/employees', { 
      params: { page, limit, sort, order } 
    })
    return data
  },

  search: async (q: string, page = 1, limit = 10, sort?: string, order?: 'asc' | 'desc', filter?: Record<string, string>) => {
    const { data } = await api.get<PaginatedApiResponse<EmployeeResponse>>('/employees/search', { 
      params: { q, page, limit, sort, order, ...filter } 
    })
    return data
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<EmployeeResponse>>(`/employees/${id}`)
    return data.data
  },

  create: async (formData: EmployeeFormData, file?: File) => {
    const payload = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        payload.append(key, value as string)
      }
    })
    if (file) payload.append('profile_picture', file)
    
    const { data } = await api.post<ApiResponse<EmployeeResponse>>('/employees', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data.data
  },

  update: async (id: string, formData: Partial<EmployeeFormData>, file?: File) => {
    const payload = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        payload.append(key, value as string)
      }
    })
    if (file) payload.append('profile_picture', file)
    
    const { data } = await api.put<ApiResponse<EmployeeResponse>>(`/employees/${id}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data.data
  },

  delete: async (id: string) => {
    await api.delete(`/employees/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/employees/bulk/delete', { ids })
  },

  bulkUpdateActive: async (ids: string[], isActive: boolean) => {
    await api.post('/employees/bulk/update-active', { ids, is_active: isActive })
  },

  getFilterOptions: async () => {
    const { data } = await api.get<ApiResponse<FilterOptions>>('/employees/filter-options')
    return data.data
  },

  getProfile: async () => {
    const { data } = await api.get<ApiResponse<EmployeeResponse>>('/employees/profile')
    return data.data
  },

  updateProfile: async (updates: Partial<EmployeeFormData>) => {
    const { data } = await api.put<ApiResponse<EmployeeResponse>>('/employees/profile', updates)
    return data.data
  },

  uploadProfilePicture: async (file: File) => {
    const formData = new FormData()
    formData.append('picture', file)
    const { data } = await api.post<ApiResponse<{ profile_picture: string }>>('/employees/profile/picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data.data.profile_picture
  }
}
