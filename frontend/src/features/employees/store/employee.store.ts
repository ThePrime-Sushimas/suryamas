import { create } from 'zustand'
import { employeesApi } from '../api/employees.api'
import type { EmployeeResponse, EmployeeFormData, FilterOptions, PaginationData } from '../types'

interface EmployeeState {
  employees: EmployeeResponse[]
  profile: EmployeeResponse | null
  filterOptions: FilterOptions | null
  pagination: PaginationData | null
  isLoading: boolean
  error: string | null
  
  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<EmployeeFormData>) => Promise<void>
  uploadProfilePicture: (file: File) => Promise<void>
  fetchEmployees: (sort?: string, order?: 'asc' | 'desc', page?: number, limit?: number, signal?: AbortSignal) => Promise<void>
  searchEmployees: (query: string, sort?: string, order?: 'asc' | 'desc', filter?: Record<string, string>, page?: number, limit?: number, signal?: AbortSignal) => Promise<void>
  fetchFilterOptions: () => Promise<void>
  createEmployee: (data: EmployeeFormData, file?: File) => Promise<EmployeeResponse>
  updateEmployee: (id: string, data: Partial<EmployeeFormData>, file?: File) => Promise<EmployeeResponse>
  deleteEmployee: (id: string) => Promise<void>
  restoreEmployee: (id: string) => Promise<void>
  updateEmployeeActive: (id: string, isActive: boolean) => Promise<void>
  bulkUpdateActive: (ids: string[], isActive: boolean) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  bulkRestore: (ids: string[]) => Promise<void>
  clearError: () => void
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  profile: null,
  filterOptions: null,
  pagination: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const profile = await employeesApi.getProfile()
      set({ profile, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to fetch profile'
      set({ error: message || 'Failed to fetch profile', isLoading: false })
      throw new Error(message || 'Failed to fetch profile')
    }
  },

  updateProfile: async (updates) => {
    set({ isLoading: true, error: null })
    try {
      const profile = await employeesApi.updateProfile(updates)
      set({ profile, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update profile'
      set({ error: message || 'Failed to update profile', isLoading: false })
      throw new Error(message || 'Failed to update profile')
    }
  },

  uploadProfilePicture: async (file) => {
    set({ isLoading: true, error: null })
    try {
      const url = await employeesApi.uploadProfilePicture(file)
      set(state => ({
        profile: state.profile ? { ...state.profile, profile_picture: url } : null,
        isLoading: false
      }))
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to upload picture'
      set({ error: message || 'Failed to upload picture', isLoading: false })
      throw new Error(message || 'Failed to upload picture')
    }
  },

  fetchEmployees: async (sort = 'full_name', order = 'asc', page = 1, limit = 50, signal) => {
    set({ isLoading: true, error: null })
    try {
      const response = await employeesApi.list(page, limit, sort, order)
      if (signal?.aborted) return
      set({ employees: response.data, pagination: response.pagination, isLoading: false })
    } catch (error: unknown) {
      if ((error instanceof Error && error.name === 'CanceledError') || signal?.aborted) return
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to fetch employees'
      set({ error: message || 'Failed to fetch employees', isLoading: false })
    }
  },

  searchEmployees: async (query, sort = 'full_name', order = 'asc', filter = {}, page = 1, limit = 50, signal) => {
    set({ isLoading: true, error: null })
    try {
      const response = await employeesApi.search(query, page, limit, sort, order, filter)
      if (signal?.aborted) return
      set({ employees: response.data, pagination: response.pagination, isLoading: false })
    } catch (error: unknown) {
      if ((error instanceof Error && error.name === 'CanceledError') || signal?.aborted) return
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to search employees'
      set({ error: message || 'Failed to search employees', isLoading: false })
    }
  },

  fetchFilterOptions: async () => {
    try {
      const filterOptions = await employeesApi.getFilterOptions()
      set({ filterOptions })
    } catch (error: unknown) {
      console.error('Failed to fetch filter options:', error)
    }
  },

  createEmployee: async (data, file) => {
    set({ isLoading: true, error: null })
    try {
      const employee = await employeesApi.create(data, file)
      set({ isLoading: false })
      return employee
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to create employee'
      set({ error: message || 'Failed to create employee', isLoading: false })
      throw new Error(message || 'Failed to create employee')
    }
  },

  updateEmployee: async (id, data, file) => {
    set({ isLoading: true, error: null })
    try {
      const employee = await employeesApi.update(id, data, file)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? employee : e),
        isLoading: false
      }))
      return employee
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update employee'
      set({ error: message || 'Failed to update employee', isLoading: false })
      throw new Error(message || 'Failed to update employee')
    }
  },

  deleteEmployee: async (id) => {
    const prev = get().employees
    set(state => ({ employees: state.employees.filter(e => e.id !== id) }))
    try {
      await employeesApi.delete(id)
    } catch (error: unknown) {
      set({ employees: prev })
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to delete employee'
      throw new Error(message || 'Failed to delete employee')
    }
  },

  restoreEmployee: async (id) => {
    try {
      await employeesApi.restore(id)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? { ...e, deleted_at: null } : e)
      }))
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to restore employee'
      throw new Error(message || 'Failed to restore employee')
    }
  },

  updateEmployeeActive: async (id, isActive) => {
    try {
      await employeesApi.updateActive(id, isActive)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? { ...e, is_active: isActive } : e)
      }))
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update employee'
      throw new Error(message || 'Failed to update employee')
    }
  },

  bulkUpdateActive: async (ids, isActive) => {
    const prev = get().employees
    set(state => ({
      employees: state.employees.map(e => ids.includes(e.id) ? { ...e, is_active: isActive } : e)
    }))
    try {
      await employeesApi.bulkUpdateActive(ids, isActive)
    } catch (error: unknown) {
      set({ employees: prev })
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update employees'
      throw new Error(message || 'Failed to update employees')
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().employees
    set(state => ({ employees: state.employees.filter(e => !ids.includes(e.id)) }))
    try {
      await employeesApi.bulkDelete(ids)
    } catch (error: unknown) {
      set({ employees: prev })
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to delete employees'
      throw new Error(message || 'Failed to delete employees')
    }
  },

  bulkRestore: async (ids) => {
    try {
      await employeesApi.bulkRestore(ids)
      set(state => ({
        employees: state.employees.map(e => ids.includes(e.id) ? { ...e, deleted_at: null } : e)
      }))
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to restore employees'
      throw new Error(message || 'Failed to restore employees')
    }
  },

  clearError: () => set({ error: null })
}))
