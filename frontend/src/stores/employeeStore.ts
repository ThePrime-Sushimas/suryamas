import { create } from 'zustand'
import api from '../lib/axios'
import type { Employee, ApiResponse } from '../types'

interface EmployeeState {
  employees: Employee[]
  profile: Employee | null
  isLoading: boolean
  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<Employee>) => Promise<void>
  searchEmployees: (query: string) => Promise<void>
  createEmployee: (data: Partial<Employee>) => Promise<void>
  deleteEmployee: (id: string) => Promise<void>
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [],
  profile: null,
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

  searchEmployees: async (query) => {
    set({ isLoading: true })
    try {
      const { data } = await api.get<ApiResponse<Employee[]>>(`/employees/search?q=${query}`)
      set({ employees: data.data })
    } finally {
      set({ isLoading: false })
    }
  },

  createEmployee: async (employeeData) => {
    set({ isLoading: true })
    try {
      await api.post('/employees', employeeData)
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
