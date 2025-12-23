import api from '@/lib/axios'

type Paginated<T> = {
  success: boolean
  data: T[]
  pagination: { total: number; page: number; limit: number }
}

export interface Employee {
  id: string
  employee_id: string
  full_name: string
  email: string
  job_position: string
  branch_id?: string
  branch_name?: string
  is_active: boolean
  created_at: string
}

export const employeeService = {
  list: (page: number, limit: number) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))
    return api.get<Paginated<Employee>>(`/employees?${params.toString()}`)
  },

  search: (q: string, page: number, limit: number) => {
    const params = new URLSearchParams()
    params.append('q', q)
    params.append('page', String(page))
    params.append('limit', String(limit))
    return api.get<Paginated<Employee>>(`/employees/search?${params.toString()}`)
  },

  autocomplete: (q: string) => {
    const params = new URLSearchParams()
    params.append('q', q)
    return api.get<{ success: boolean; data: Array<{ id: string; full_name: string }> }>(`/employees/autocomplete?${params.toString()}`)
  },

  getById: (id: string) =>
    api.get<{ success: boolean; data: Employee }>(`/employees/${id}`),

  create: (data: FormData) =>
    api.post<{ success: boolean; data: Employee }>('/employees', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  update: (id: string, data: FormData) =>
    api.put<{ success: boolean; data: Employee }>(`/employees/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  delete: (id: string) => api.delete(`/employees/${id}`),

  bulkDelete: (ids: string[]) => api.post('/employees/bulk/delete', { ids })
}
