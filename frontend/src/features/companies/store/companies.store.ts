import { create } from 'zustand'
import { companiesApi } from '../api/companies.api'
import { parseApiError } from '@/lib/errorParser'
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '../types'

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface CompaniesState {
  companies: Company[]
  selectedCompany: Company | null
  loading: boolean
  mutationLoading: boolean
  error: string | null
  pagination: Pagination

  fetchPage: (page: number, limit?: number, sort?: { field: string; order: string }, filter?: Record<string, unknown>) => Promise<void>
  searchPage: (q: string, page: number, limit?: number, filter?: Record<string, unknown>) => Promise<void>
  getCompanyById: (id: string) => Promise<Company>
  createCompany: (data: CreateCompanyDto) => Promise<Company>
  updateCompany: (id: string, data: UpdateCompanyDto) => Promise<Company>
  deleteCompany: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialPagination: Pagination = { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false }

const buildPagination = (p: { total: number; page: number; limit: number }): Pagination => {
  const totalPages = Math.ceil(p.total / p.limit)
  return { page: p.page, limit: p.limit, total: p.total, totalPages, hasNext: p.page < totalPages, hasPrev: p.page > 1 }
}

export const useCompaniesStore = create<CompaniesState>((set, get) => ({
  companies: [],
  selectedCompany: null,
  loading: false,
  mutationLoading: false,
  error: null,
  pagination: initialPagination,

  fetchPage: async (page, limit, sort, filter) => {
    const currentLimit = limit ?? get().pagination.limit
    set(state => ({ loading: true, error: null, pagination: { ...state.pagination, page, limit: currentLimit } }))
    try {
      const res = await companiesApi.list(page, currentLimit, sort, filter)
      set({ companies: res.data, loading: false, pagination: buildPagination(res.pagination) })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat data perusahaan'), loading: false })
    }
  },

  searchPage: async (q, page, limit, filter) => {
    const currentLimit = limit ?? get().pagination.limit
    set(state => ({ loading: true, error: null, pagination: { ...state.pagination, page, limit: currentLimit } }))
    try {
      const res = await companiesApi.search(q, page, currentLimit, filter)
      set({ companies: res.data, loading: false, pagination: buildPagination(res.pagination) })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mencari perusahaan'), loading: false })
    }
  },

  getCompanyById: async (id) => {
    set({ loading: true, error: null })
    try {
      const company = await companiesApi.getById(id)
      set({ selectedCompany: company, loading: false })
      return company
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Perusahaan tidak ditemukan'), loading: false })
      throw error
    }
  },

  createCompany: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const company = await companiesApi.create(data)
      set({ mutationLoading: false })
      return company
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat perusahaan'), mutationLoading: false })
      throw error
    }
  },

  updateCompany: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const company = await companiesApi.update(id, data)
      set(state => ({
        companies: state.companies.map(c => c.id === id ? company : c),
        mutationLoading: false
      }))
      return company
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mengupdate perusahaan'), mutationLoading: false })
      throw error
    }
  },

  deleteCompany: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await companiesApi.delete(id)
      set({ mutationLoading: false })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal menghapus perusahaan'), mutationLoading: false })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    set({ mutationLoading: true, error: null })
    try {
      await companiesApi.bulkDelete(ids)
      set({ mutationLoading: false })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal menghapus perusahaan'), mutationLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ companies: [], selectedCompany: null, loading: false, mutationLoading: false, error: null, pagination: initialPagination })
}))
