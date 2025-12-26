import api from '@/lib/axios'
import { normalizeError } from './errors'
import type {
  EmployeeBranch,
  EmployeeBranchListQuery,
  PaginatedResponse,
  CreateEmployeeBranchDTO,
  UpdateEmployeeBranchDTO,
} from './types'

const BASE = '/employee-branches'

export const employeeBranchesApi = {
  async list(query: EmployeeBranchListQuery): Promise<PaginatedResponse<EmployeeBranch>> {
    try {
      const { data } = await api.get<PaginatedResponse<EmployeeBranch>>(BASE, { params: query })
      return data
    } catch (err) {
      throw normalizeError(err)
    }
  },

  async getById(id: string): Promise<EmployeeBranch> {
    try {
      const { data } = await api.get<{ success: boolean; data: EmployeeBranch }>(`${BASE}/${id}`)
      return data.data
    } catch (err) {
      throw normalizeError(err)
    }
  },

  async create(payload: CreateEmployeeBranchDTO): Promise<EmployeeBranch> {
    try {
      const { data } = await api.post<{ success: boolean; data: EmployeeBranch }>(BASE, payload)
      return data.data
    } catch (err) {
      throw normalizeError(err)
    }
  },

  async update(id: string, payload: UpdateEmployeeBranchDTO): Promise<EmployeeBranch> {
    try {
      const { data } = await api.put<{ success: boolean; data: EmployeeBranch }>(`${BASE}/${id}`, payload)
      return data.data
    } catch (err) {
      throw normalizeError(err)
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await api.delete(`${BASE}/${id}`)
    } catch (err) {
      throw normalizeError(err)
    }
  },

  async setPrimary(employeeId: string, branchId: string): Promise<void> {
    try {
      await api.put(`${BASE}/employee/${employeeId}/branch/${branchId}/primary`)
    } catch (err) {
      throw normalizeError(err)
    }
  },
}
