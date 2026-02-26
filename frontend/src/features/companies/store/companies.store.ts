import { create } from 'zustand'
import { companiesApi } from '../api/companies.api'
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '../types'

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface CompanyFilters extends Record<string, unknown> {
  status?: string
  company_type?: string
  search?: string
}

interface CompaniesState {
  companies: Company[]
  selectedCompany: Company | null
  loading: boolean
  error: string | null
  pagination: Pagination
  filters: CompanyFilters
  searchQuery: string
  
  fetchCompanies: (page: number, limit: number, sort?: { field: string; order: string }, filter?: Record<string, unknown>) => Promise<void>
  searchCompanies: (q: string, page: number, limit: number, filter?: Record<string, unknown>) => Promise<void>
  setPage: (page: number) => void
  setPageSize: (limit: number) => void
  setFilters: (filters: CompanyFilters) => void
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
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  filters: {},
  searchQuery: ''
}

export const useCompaniesStore = create<CompaniesState>((set, get) => ({
  ...initialState,

  fetchCompanies: async (page, limit, sort, filter) => {
    set({ loading: true, error: null, filters: filter || {}, searchQuery: '' })
    try {
      const res = await companiesApi.list(page, limit, sort, filter)
      const totalPages = Math.ceil(res.pagination.total / res.pagination.limit)
      set({ 
        companies: res.data, 
        loading: false,
        pagination: {
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages,
          hasNext: res.pagination.page < totalPages,
          hasPrev: res.pagination.page > 1
        }
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch companies'
      set({ error: message, loading: false })
    }
  },

  searchCompanies: async (q, page, limit, filter) => {
    set({ loading: true, error: null, searchQuery: q, filters: filter || {} })
    try {
      const res = await companiesApi.search(q, page, limit, filter)
      const totalPages = Math.ceil(res.pagination.total / res.pagination.limit)
      set({ 
        companies: res.data, 
        loading: false,
        pagination: {
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages,
          hasNext: res.pagination.page < totalPages,
          hasPrev: res.pagination.page > 1
        }
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to search companies'
      set({ error: message, loading: false })
    }
  },

  setPage: (page: number) => {
    set(state => ({ pagination: { ...state.pagination, page } }))
  },

  setPageSize: (limit: number) => {
    set(state => ({ 
      pagination: { ...state.pagination, page: 1, limit }
    }))
  },

  setFilters: (filters: CompanyFilters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 }, searchQuery: '' })
    get().fetchCompanies(1, get().pagination.limit, undefined, filters)
  },


  getCompanyById: async (id) => {
    set({ loading: true, error: null })
    try {
      const company = await companiesApi.getById(id)
      set({ selectedCompany: company, loading: false })
      return company
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Company not found'
      set({ error: message, loading: false })
      throw error
    }
  },

  createCompany: async (data) => {
    set({ loading: true, error: null })
    try {
      const company = await companiesApi.create(data)
      set({ loading: false })
      return company
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create company'
      set({ error: message, loading: false })
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update company'
      set({ error: message, loading: false })
      throw error
    }
  },

  deleteCompany: async (id) => {
    const prev = get().companies
    // Optimistic update: change status to inactive locally
    set(state => ({ 
      companies: state.companies.map(c => c.id === id ? { ...c, status: 'inactive' as const } : c)
    }))
    try {
      await companiesApi.delete(id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete company'
      set({ companies: prev, error: message })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().companies
    set(state => ({ companies: state.companies.filter(c => !ids.includes(c.id)) }))
    try {
      await companiesApi.bulkDelete(ids)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete companies'
      set({ companies: prev, error: message })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    companies: [],
    selectedCompany: null,
    loading: false,
    error: null,
    pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    filters: {},
    searchQuery: ''
  })
}))
