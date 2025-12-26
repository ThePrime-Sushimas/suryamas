import { create } from 'zustand'
import { employeesApi } from '../api/employees.api'
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto } from '../types'

interface EmployeesState {
  employees: Employee[]
  loading: boolean
  error: string | null
  
  fetchEmployees: (page?: number, limit?: number, sort?: any, filter?: any) => Promise<void>
  searchEmployees: (q: string, page?: number, limit?: number) => Promise<void>
  createEmployee: (data: CreateEmployeeDto) => Promise<Employee>
  updateEmployee: (id: string, data: UpdateEmployeeDto) => Promise<Employee>
  deleteEmployee: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  clearError: () => void
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  employees: [],
  loading: false,
  error: null,

  fetchEmployees: async (page = 1, limit = 10, sort, filter) => {
    set({ loading: true, error: null })
    try {
      const res = await employeesApi.list(page, limit, sort, filter)
      set({ employees: res.data, loading: false })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch employees', loading: false })
    }
  },

  searchEmployees: async (q, page = 1, limit = 10) => {
    set({ loading: true, error: null })
    try {
      const res = await employeesApi.search(q, page, limit)
      set({ employees: res.data, loading: false })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to search employees', loading: false })
    }
  },

  createEmployee: async (data) => {
    set({ loading: true, error: null })
    try {
      const employee = await employeesApi.create(data)
      set({ loading: false })
      return employee
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to create employee', loading: false })
      throw error
    }
  },

  updateEmployee: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const employee = await employeesApi.update(id, data)
      set(state => ({
        employees: state.employees.map(e => e.id === id ? employee : e),
        loading: false
      }))
      return employee
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update employee', loading: false })
      throw error
    }
  },

  deleteEmployee: async (id) => {
    const prev = get().employees
    set(state => ({ employees: state.employees.filter(e => e.id !== id) }))
    try {
      await employeesApi.delete(id)
    } catch (error: any) {
      set({ employees: prev, error: error.response?.data?.error || 'Failed to delete employee' })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().employees
    set(state => ({ employees: state.employees.filter(e => !ids.includes(e.id)) }))
    try {
      await employeesApi.bulkDelete(ids)
    } catch (error: any) {
      set({ employees: prev, error: error.response?.data?.error || 'Failed to delete employees' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
