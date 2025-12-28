import { create } from 'zustand'
import { companiesApi } from '../api/companies.api'
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '../types'

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface CompaniesState {
  companies: Company[]
  selectedCompany: Company | null
  loading: boolean
  error: string | null
  pagination: Pagination
  
  fetchCompanies: (page: number, limit: number, sort?: { field: string; order: string }, filter?: Record<string, any>) => Promise<void>
  searchCompanies: (q: string, page: number, limit: number, filter?: Record<string, any>) => Promise<void>
  getCompanyById: (id: string) => Promise<Company>
  createCompany: (data: CreateCompanyDto) => Promise<Company>
  updateCompany: (id: string, data: UpdateCompanyDto) => Promise<Company>
  deleteCompany: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialState = {
  companies: [],
  selectedCompany: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 }
}

export const useCompaniesStore = create<CompaniesState>((set, get) => ({
  ...initialState,

  fetchCompanies: async (page, limit, sort, filter) => {
    set({ loading: true, error: null })
    try {
      const res = await companiesApi.list(page, limit, sort, filter)
      set({ 
        companies: res.data, 
        loading: false,
        pagination: {
          ...res.pagination,
          totalPages: Math.ceil(res.pagination.total / res.pagination.limit)
        }
      })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch companies', loading: false })
    }
  },

  searchCompanies: async (q, page, limit, filter) => {
    set({ loading: true, error: null })
    try {
      const res = await companiesApi.search(q, page, limit, filter)
      set({ 
        companies: res.data, 
        loading: false,
        pagination: {
          ...res.pagination,
          totalPages: Math.ceil(res.pagination.total / res.pagination.limit)
        }
      })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to search companies', loading: false })
    }
  },

  getCompanyById: async (id) => {
    set({ loading: true, error: null })
    try {
      const company = await companiesApi.getById(id)
      set({ selectedCompany: company, loading: false })
      return company
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Company not found', loading: false })
      throw error
    }
  },

  createCompany: async (data) => {
    set({ loading: true, error: null })
    try {
      const company = await companiesApi.create(data)
      set({ loading: false })
      return company
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to create company', loading: false })
      throw error
    }
  },

  updateCompany: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const company = await companiesApi.update(id, data)
      set(state => ({
        companies: state.companies.map(c => c.id === id ? company : c),
        loading: false
      }))
      return company
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update company', loading: false })
      throw error
    }
  },

  deleteCompany: async (id) => {
    const prev = get().companies
    set(state => ({ companies: state.companies.filter(c => c.id !== id) }))
    try {
      await companiesApi.delete(id)
    } catch (error: any) {
      set({ companies: prev, error: error.response?.data?.error || 'Failed to delete company' })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().companies
    set(state => ({ companies: state.companies.filter(c => !ids.includes(c.id)) }))
    try {
      await companiesApi.bulkDelete(ids)
    } catch (error: any) {
      set({ companies: prev, error: error.response?.data?.error || 'Failed to delete companies' })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState)
}))
