import { create } from 'zustand'
import api from '../lib/axios'
import type { Employee, ApiResponse } from '../types'

interface FilterOptions {
  branches: string[]
  positions: string[]
  statuses: string[]
}

interface EmployeeState {
  employees: Employee[]
  profile: Employee | null
  filterOptions: FilterOptions | null
  pagination: { page: number; limit: number; total: number; totalPages: number } | null
  isLoading: boolean
  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<Employee>) => Promise<void>
  uploadProfilePicture: (file: File) => Promise<void>
  searchEmployees: (query: string, sort?: string, order?: 'asc' | 'desc', filter?: any, page?: number, limit?: number) => Promise<void>
  fetchFilterOptions: () => Promise<void>
  createEmployee: (data: Partial<Employee>, profilePicture?: File) => Promise<void>
  deleteEmployee: (id: string) => Promise<void>
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [],
  profile: null,
  filterOptions: null,
  pagination: null,
  isLoading: false,

  fetchProfile: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get<ApiResponse<Employee>>('/employees/profile')
      set({ profile: data.data })
    } finally {
      set({ isLoading: false })
    }
  },

  updateProfile: async (updates) => {
    set({ isLoading: true })
    try {
      const { data } = await api.put<ApiResponse<Employee>>('/employees/profile', updates)
      set({ profile: data.data })
    } finally {
      set({ isLoading: false })
    }
  },

  uploadProfilePicture: async (file: File) => {
    set({ isLoading: true })
    try {
      const formData = new FormData()
      formData.append('picture', file)
      const { data } = await api.post<ApiResponse<{ profile_picture: string }>>('/employees/profile/picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      set((state) => ({
        profile: state.profile ? { ...state.profile, profile_picture: data.data.profile_picture } : null
      }))
    } finally {
      set({ isLoading: false })
    }
  },

  searchEmployees: async (query, sort = 'created_at', order = 'desc', filter = {}, page = 1, limit = 10) => {
    set({ isLoading: true })
    try {
      const params = new URLSearchParams({
        q: query,
        sort,
        order,
        page: String(page),
        limit: String(limit),
        ...filter
      })
      const { data } = await api.get<ApiResponse<Employee[]>>(`/employees/search?${params}`)
      set({ 
        employees: data.data,
        pagination: (data as any).pagination
      })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchFilterOptions: async () => {
    try {
      const { data } = await api.get<ApiResponse<FilterOptions>>('/employees/filter-options')
      set({ filterOptions: data.data })
    } catch (error) {
      console.error('Failed to fetch filter options:', error)
    }
  },

  createEmployee: async (employeeData, profilePicture?: File) => {
    set({ isLoading: true })
    try {
      const formData = new FormData()
      Object.entries(employeeData).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          formData.append(key, value as string)
        }
      })
      if (profilePicture) {
        formData.append('profile_picture', profilePicture)
      }
      await api.post('/employees', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } finally {
      set({ isLoading: false })
    }
  },

  deleteEmployee: async (id) => {
    set({ isLoading: true })
    try {
      await api.delete(`/employees/${id}`)
      set((state) => ({
        employees: state.employees.filter((e) => e.id !== id),
      }))
    } finally {
      set({ isLoading: false })
    }
  },
}))
