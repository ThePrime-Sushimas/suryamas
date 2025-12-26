import { create } from 'zustand'
import { branchesApi } from '../api/branches.api'
import type { Branch, CreateBranchDto, UpdateBranchDto, BranchSort, BranchFilter } from '../types'

interface BranchesState {
  branches: Branch[]
  loading: boolean
  error: string | null
  
  fetchBranches: (page: number, limit: number, sort?: BranchSort | null, filter?: BranchFilter | null) => Promise<void>
  searchBranches: (q: string, page: number, limit: number, sort?: BranchSort | null) => Promise<void>
  createBranch: (data: CreateBranchDto) => Promise<Branch>
  updateBranch: (id: string, data: UpdateBranchDto) => Promise<Branch>
  deleteBranch: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  clearError: () => void
}

export const useBranchesStore = create<BranchesState>((set, get) => ({
  branches: [],
  loading: false,
  error: null,

  fetchBranches: async (page, limit, sort, filter) => {
    set({ loading: true, error: null })
    try {
      const res = await branchesApi.list(page, limit, sort, filter)
      set({ branches: res.data, loading: false })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch branches', loading: false })
    }
  },

  searchBranches: async (q, page, limit, sort) => {
    set({ loading: true, error: null })
    try {
      const res = await branchesApi.search(q, page, limit, sort)
      set({ branches: res.data, loading: false })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to search branches', loading: false })
    }
  },

  createBranch: async (data) => {
    set({ loading: true, error: null })
    try {
      const branch = await branchesApi.create(data)
      set({ loading: false })
      return branch
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to create branch', loading: false })
      throw error
    }
  },

  updateBranch: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const branch = await branchesApi.update(id, data)
      set(state => ({
        branches: state.branches.map(b => b.id === id ? branch : b),
        loading: false
      }))
      return branch
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update branch', loading: false })
      throw error
    }
  },

  deleteBranch: async (id) => {
    const prev = get().branches
    set(state => ({ branches: state.branches.filter(b => b.id !== id) }))
    try {
      await branchesApi.delete(id)
    } catch (error: any) {
      set({ branches: prev, error: error.response?.data?.error || 'Failed to delete branch' })
      throw error
    }
  },

  bulkDelete: async (ids) => {
    const prev = get().branches
    set(state => ({ branches: state.branches.filter(b => !ids.includes(b.id)) }))
    try {
      await branchesApi.bulkDelete(ids)
    } catch (error: any) {
      set({ branches: prev, error: error.response?.data?.error || 'Failed to delete branches' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
