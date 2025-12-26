import api from '@/lib/axios'
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

export const employeesApi = {
  list: async (page = 1, limit = 10, sort?: any, filter?: any) => {
    const res = await api.get<PaginatedResponse<Employee>>('/employees', { params: { page, limit, ...sort, ...filter } })
    return res.data
  },

  search: async (q: string, page = 1, limit = 10) => {
    const res = await api.get<PaginatedResponse<Employee>>('/employees/search', { params: { q, page, limit } })
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
    return res.data.data
  },

  create: async (data: CreateEmployeeDto) => {
    const res = await api.post<ApiResponse<Employee>>('/employees', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateEmployeeDto) => {
    const res = await api.put<ApiResponse<Employee>>(`/employees/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/employees/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/employees/bulk/delete', { ids })
  }
}
