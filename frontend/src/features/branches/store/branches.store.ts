import { create } from 'zustand'
import { branchesApi } from '../api/branches.api'
import { parseApiError } from '@/lib/errorParser'
import type { Branch, CreateBranchDto, UpdateBranchDto, BranchSort, BranchFilter } from '../types'

interface BranchesState {
  branches: Branch[]
  loading: boolean
  mutationLoading: boolean
  error: string | null
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean

  fetchPage: (page: number, limit?: number, sort?: BranchSort | null, filter?: BranchFilter | null) => Promise<void>
  searchPage: (q: string, page: number, limit?: number, sort?: BranchSort | null) => Promise<void>
  createBranch: (data: CreateBranchDto) => Promise<Branch>
  updateBranch: (id: string, data: UpdateBranchDto) => Promise<Branch>
  deleteBranch: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  clearError: () => void
}

export const useBranchesStore = create<BranchesState>((set, get) => ({
  branches: [],
  loading: false,
  mutationLoading: false,
  error: null,
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,

  fetchPage: async (page, limit?, sort?, filter?) => {
    const l = limit ?? get().limit
    set({ loading: true, error: null, page, limit: l })
    try {
      const res = await branchesApi.list(page, l, sort, filter)
      const total = res.pagination?.total || 0
      const totalPages = Math.ceil(total / l)
      set({
        branches: res.data,
        loading: false,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat cabang'), loading: false })
    }
  },

  searchPage: async (q, page, limit?, sort?) => {
    const l = limit ?? get().limit
    set({ loading: true, error: null, page, limit: l })
    try {
      const res = await branchesApi.search(q, page, l, sort)
      const total = res.pagination?.total || 0
      const totalPages = Math.ceil(total / l)
      set({
        branches: res.data,
        loading: false,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mencari cabang'), loading: false })
    }
  },

  createBranch: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const branch = await branchesApi.create(data)
      set({ mutationLoading: false })
      return branch
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat cabang'), mutationLoading: false })
      throw error
    }
  },

  updateBranch: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const branch = await branchesApi.update(id, data)
      set(state => ({
        branches: state.branches.map(b => b.id === id ? branch : b),
        mutationLoading: false,
      }))
      return branch
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mengupdate cabang'), mutationLoading: false })
      throw error
    }
  },

  deleteBranch: async (id) => {
    const prev = get().branches
    set(state => ({ branches: state.branches.filter(b => b.id !== id) }))
    try {
      await branchesApi.delete(id)
    } catch (error: unknown) {
      set({ branches: prev, error: parseApiError(error, 'Gagal menghapus cabang') })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().branches
    set(state => ({ branches: state.branches.filter(b => !ids.includes(b.id)) }))
    try {
      await branchesApi.bulkDelete(ids)
    } catch (error: unknown) {
      set({ branches: prev, error: parseApiError(error, 'Gagal menghapus cabang') })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))
