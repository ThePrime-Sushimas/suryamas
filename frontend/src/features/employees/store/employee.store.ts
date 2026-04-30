import { create } from 'zustand'
import { employeesApi } from '../api/employees.api'
import { parseApiError } from '@/lib/errorParser'
import type { EmployeeResponse, EmployeeFormData, FilterOptions, PaginationData } from '../types'

interface EmployeeState {
  employees: EmployeeResponse[]
  profile: EmployeeResponse | null
  filterOptions: FilterOptions | null
  pagination: PaginationData | null
  loading: boolean
  mutationLoading: boolean
  error: string | null

  fetchPage: (page: number, limit: number, sort: string, order: 'asc' | 'desc', signal?: AbortSignal) => Promise<void>
  searchPage: (query: string, page: number, limit: number, sort: string, order: 'asc' | 'desc', filter: Record<string, string>, signal?: AbortSignal) => Promise<void>
  fetchFilterOptions: () => Promise<void>
  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<EmployeeFormData>) => Promise<void>
  uploadProfilePicture: (file: File) => Promise<void>
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
  loading: false,
  mutationLoading: false,
  error: null,

  fetchPage: async (page, limit, sort, order, signal) => {
    set({ loading: true, error: null })
    try {
      const response = await employeesApi.list(page, limit, sort, order)
      if (signal?.aborted) return
      set({ employees: response.data, pagination: response.pagination, loading: false })
    } catch (error: unknown) {
      if ((error instanceof Error && error.name === 'CanceledError') || signal?.aborted) return
      set({ error: parseApiError(error, 'Gagal memuat karyawan'), loading: false })
    }
  },

  searchPage: async (query, page, limit, sort, order, filter, signal) => {
    set({ loading: true, error: null })
    try {
      const response = await employeesApi.search(query, page, limit, sort, order, filter)
      if (signal?.aborted) return
      set({ employees: response.data, pagination: response.pagination, loading: false })
    } catch (error: unknown) {
      if ((error instanceof Error && error.name === 'CanceledError') || signal?.aborted) return
      set({ error: parseApiError(error, 'Gagal mencari karyawan'), loading: false })
    }
  },

  fetchFilterOptions: async () => {
    try {
      const filterOptions = await employeesApi.getFilterOptions()
      set({ filterOptions })
    } catch (_) { /* silent */ }
  },

  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      const profile = await employeesApi.getProfile()
      set({ profile, loading: false })
    } catch (error: unknown) {
      const msg = parseApiError(error, 'Gagal memuat profil')
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  updateProfile: async (updates) => {
    set({ mutationLoading: true, error: null })
    try {
      const profile = await employeesApi.updateProfile(updates)
      set({ profile, mutationLoading: false })
    } catch (error: unknown) {
      const msg = parseApiError(error, 'Gagal memperbarui profil')
      set({ error: msg, mutationLoading: false })
      throw new Error(msg)
    }
  },

  uploadProfilePicture: async (file) => {
    set({ mutationLoading: true, error: null })
    try {
      const url = await employeesApi.uploadProfilePicture(file)
      set(state => ({
        profile: state.profile ? { ...state.profile, profile_picture: url } : null,
        mutationLoading: false
      }))
    } catch (error: unknown) {
      const msg = parseApiError(error, 'Gagal mengunggah foto')
      set({ error: msg, mutationLoading: false })
      throw new Error(msg)
    }
  },

  createEmployee: async (data, file) => {
    set({ mutationLoading: true, error: null })
    try {
      const employee = await employeesApi.create(data, file)
      set({ mutationLoading: false })
      return employee
    } catch (error: unknown) {
      const msg = parseApiError(error, 'Gagal membuat karyawan')
      set({ error: msg, mutationLoading: false })
      throw new Error(msg)
    }
  },

  updateEmployee: async (id, data, file) => {
    set({ mutationLoading: true, error: null })
    try {
      const employee = await employeesApi.update(id, data, file)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? employee : e),
        mutationLoading: false
      }))
      return employee
    } catch (error: unknown) {
      const msg = parseApiError(error, 'Gagal memperbarui karyawan')
      set({ error: msg, mutationLoading: false })
      throw new Error(msg)
    }
  },

  deleteEmployee: async (id) => {
    const prev = get().employees
    set(state => ({ employees: state.employees.filter(e => e.id !== id) }))
    try {
      await employeesApi.delete(id)
    } catch (error: unknown) {
      set({ employees: prev, error: parseApiError(error, 'Gagal menghapus karyawan') })
      throw error
    }
  },

  restoreEmployee: async (id) => {
    try {
      await employeesApi.restore(id)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? { ...e, deleted_at: null } : e)
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memulihkan karyawan') })
      throw error
    }
  },

  updateEmployeeActive: async (id, isActive) => {
    try {
      await employeesApi.updateActive(id, isActive)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? { ...e, is_active: isActive } : e)
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memperbarui status karyawan') })
      throw error
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
      set({ employees: prev, error: parseApiError(error, 'Gagal memperbarui karyawan') })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().employees
    set(state => ({ employees: state.employees.filter(e => !ids.includes(e.id)) }))
    try {
      await employeesApi.bulkDelete(ids)
    } catch (error: unknown) {
      set({ employees: prev, error: parseApiError(error, 'Gagal menghapus karyawan') })
      throw error
    }
  },

  bulkRestore: async (ids) => {
    try {
      await employeesApi.bulkRestore(ids)
      set(state => ({
        employees: state.employees.map(e => ids.includes(e.id) ? { ...e, deleted_at: null } : e)
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memulihkan karyawan') })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
