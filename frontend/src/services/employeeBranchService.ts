import api from '@/lib/axios'
import type { EmployeeBranch, CreateEmployeeBranchDto, UpdateEmployeeBranchDto, EmployeeBranchFilter } from '@/types/employeeBranch'
import type { Paginated } from '@/types/pagination'

export const employeeBranchService = {
  list: (page: number, limit: number, filter?: EmployeeBranchFilter | null) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))
    
    if (filter?.search) {
      params.append('q', filter.search)
    }
    if (filter?.employee_id) {
      params.append('employee_id', filter.employee_id)
    }
    if (filter?.branch_id) {
      params.append('branch_id', filter.branch_id)
    }
    
    return api.get<Paginated<EmployeeBranch>>(`/employee-branches?${params.toString()}`)
  },

  getById: (id: string) =>
    api.get<{ success: boolean; data: EmployeeBranch }>(`/employee-branches/${id}`),

  getByEmployeeId: (employeeId: string) =>
    api.get<{ success: boolean; data: EmployeeBranch[] }>(`/employee-branches/employee/${employeeId}`),

  getPrimaryBranch: (employeeId: string) =>
    api.get<{ success: boolean; data: EmployeeBranch | null }>(`/employee-branches/employee/${employeeId}/primary`),

  getByBranchId: (branchId: string, page: number, limit: number) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))
    return api.get<Paginated<EmployeeBranch>>(`/employee-branches/branch/${branchId}?${params.toString()}`)
  },

  create: (data: CreateEmployeeBranchDto) =>
    api.post<{ success: boolean; data: EmployeeBranch }>('/employee-branches', data),

  update: (id: string, data: UpdateEmployeeBranchDto) =>
    api.put<{ success: boolean; data: EmployeeBranch }>(`/employee-branches/${id}`, data),

  setPrimaryBranch: (employeeId: string, branchId: string) =>
    api.put(`/employee-branches/employee/${employeeId}/branch/${branchId}/primary`),

  delete: (id: string) => api.delete(`/employee-branches/${id}`),

  deleteByEmployeeAndBranch: (employeeId: string, branchId: string) =>
    api.delete(`/employee-branches/employee/${employeeId}/branch/${branchId}`),

  bulkDelete: (ids: string[]) => api.post('/employee-branches/bulk/delete', { ids })
}
