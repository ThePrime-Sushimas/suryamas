import { create } from 'zustand'
import { posImportsApi } from '../api/pos-imports.api'
import type { PosImport, AnalyzeResult } from '../types/pos-imports.types'

interface PosImportsState {
  imports: PosImport[]
  currentImport: PosImport | null
  analyzeResult: AnalyzeResult | null
  loading: {
    list: boolean
    upload: boolean
    confirm: boolean
    delete: boolean
  }
  error: string | null

  fetchImports: () => Promise<void>
  uploadFile: (file: File, branchId: string) => Promise<void>
  confirmImport: (id: string, skipDuplicates: boolean) => Promise<void>
  deleteImport: (id: string) => Promise<void>
  clearAnalyzeResult: () => void
  clearError: () => void
}

export const usePosImportsStore = create<PosImportsState>((set, get) => ({
  imports: [],
  currentImport: null,
  analyzeResult: null,
  loading: {
    list: false,
    upload: false,
    confirm: false,
    delete: false
  },
  error: null,

  fetchImports: async () => {
    set({ loading: { ...get().loading, list: true }, error: null })
    try {
      const data = await posImportsApi.list({ sort: 'created_at', order: 'desc' })
      set({ imports: data.data || [], loading: { ...get().loading, list: false } })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch imports',
        loading: { ...get().loading, list: false }
      })
    }
  },

  uploadFile: async (file: File, branchId: string) => {
    set({ loading: { ...get().loading, upload: true }, error: null })
    try {
      const result = await posImportsApi.upload(file, branchId)
      set({ 
        analyzeResult: result,
        loading: { ...get().loading, upload: false }
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to upload file',
        loading: { ...get().loading, upload: false }
      })
      throw error
    }
  },

  confirmImport: async (id: string, skipDuplicates: boolean) => {
    set({ loading: { ...get().loading, confirm: true }, error: null })
    try {
      await posImportsApi.confirm(id, skipDuplicates)
      set({ 
        analyzeResult: null,
        loading: { ...get().loading, confirm: false }
      })
      await get().fetchImports()
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to confirm import',
        loading: { ...get().loading, confirm: false }
      })
      throw error
    }
  },

  deleteImport: async (id: string) => {
    set({ loading: { ...get().loading, delete: true }, error: null })
    try {
      await posImportsApi.delete(id)
      set({ loading: { ...get().loading, delete: false } })
      await get().fetchImports()
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete import',
        loading: { ...get().loading, delete: false }
      })
      throw error
    }
  },

  clearAnalyzeResult: () => set({ analyzeResult: null }),
  clearError: () => set({ error: null })
}))
