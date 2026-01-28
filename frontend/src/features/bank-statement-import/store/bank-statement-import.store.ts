import { create } from 'zustand'
import axios from 'axios'
import { bankStatementImportApi } from '../api/bank-statement-import.api'
import type {
  BankStatementImport,
  BankStatementAnalysisResult,
  BankStatementImportFilters,
} from '../types/bank-statement-import.types'
import { BANK_STATEMENT_IMPORT_PAGE_SIZE } from '../constants/bank-statement-import.constants'

// Helper function untuk extract error message dari berbagai tipe error
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Handle axios error dengan response dari server
    if (error.response?.data?.message) {
      return Array.isArray(error.response.data.message) 
        ? error.response.data.message.join(', ')
        : error.response.data.message
    }
    if (error.response?.statusText) {
      return error.response.statusText
    }
    if (error.code === 'ERR_BRANCH_REQUIRED') {
      return 'Silakan pilih branch terlebih dahulu'
    }
    return error.message || 'Terjadi kesalahan pada server'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan yang tidak diketahui'
}

interface Pagination {
  page: number
  limit: number
  total: number
}

interface BankStatementImportState {
  // Data
  imports: BankStatementImport[]
  currentImport: BankStatementImport | null
  analyzeResult: BankStatementAnalysisResult | null

  // UI state
  selectedIds: Set<string>
  pagination: Pagination
  filters: BankStatementImportFilters

  loading: {
    list: boolean
    upload: boolean
    confirm: boolean
    delete: boolean
    retry: boolean
  }

  errors: {
    upload: string | null
    confirm: string | null
    general: string | null
  }

  uploadProgress: number
  showUploadModal: boolean
  showAnalysisModal: boolean
  showConfirmModal: boolean

  // Actions
  fetchImports: (params?: { page?: number; limit?: number; filters?: BankStatementImportFilters }) => Promise<void>
  uploadFile: (file: File, bankAccountId: string) => Promise<void>
  confirmImport: (skipDuplicates: boolean) => Promise<void>
  cancelImport: (id: string) => Promise<void>
  retryImport: (id: string) => Promise<void>
  deleteImport: (id: string) => Promise<void>

  toggleSelection: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void

  setFilters: (filters: BankStatementImportFilters) => void
  setPagination: (page: number, limit?: number) => void

  openUploadModal: () => void
  closeUploadModal: () => void
  openAnalysisModal: () => void
  closeAnalysisModal: () => void
  openConfirmModal: () => void
  closeConfirmModal: () => void

  setCurrentImport: (imp: BankStatementImport | null) => void
  clearAnalyzeResult: () => void
  clearError: (type?: keyof BankStatementImportState['errors']) => void
}

const initialState: Pick<
  BankStatementImportState,
  | 'imports'
  | 'currentImport'
  | 'analyzeResult'
  | 'selectedIds'
  | 'pagination'
  | 'filters'
  | 'loading'
  | 'errors'
  | 'uploadProgress'
  | 'showUploadModal'
  | 'showAnalysisModal'
  | 'showConfirmModal'
> = {
  imports: [],
  currentImport: null,
  analyzeResult: null,
  selectedIds: new Set<string>(),
  pagination: {
    page: 1,
    limit: BANK_STATEMENT_IMPORT_PAGE_SIZE,
    total: 0,
  },
  filters: {},
  loading: {
    list: false,
    upload: false,
    confirm: false,
    delete: false,
    retry: false,
  },
  errors: {
    upload: null,
    confirm: null,
    general: null,
  },
  uploadProgress: 0,
  showUploadModal: false,
  showAnalysisModal: false,
  showConfirmModal: false,
}

export const useBankStatementImportStore = create<BankStatementImportState>((set, get) => ({
  ...initialState,

  fetchImports: async (params) => {
    set({
      loading: { ...get().loading, list: true },
      errors: { ...get().errors, general: null },
    })
    try {
      const { page = get().pagination.page, limit = get().pagination.limit, filters = get().filters } = params || {}
      const response = await bankStatementImportApi.list({ page, limit, ...filters })

      set({
        imports: response.data ?? [],
        pagination: {
          page,
          limit,
          total: response.pagination?.total ?? 0,
        },
        loading: { ...get().loading, list: false },
      })
    } catch (error) {
      set({
        errors: {
          ...get().errors,
          general: getErrorMessage(error),
        },
        loading: { ...get().loading, list: false },
      })
    }
  },

  uploadFile: async (file: File, bankAccountId: string) => {
    set({
      loading: { ...get().loading, upload: true },
      errors: { ...get().errors, upload: null },
      uploadProgress: 0,
    })

    try {
      const result = await bankStatementImportApi.upload(file, bankAccountId, (progress) => {
        set({ uploadProgress: progress })
      })

      set({
        analyzeResult: result,
        currentImport: result.import,
        loading: { ...get().loading, upload: false },
        showAnalysisModal: true,
      })
    } catch (error) {
      set({
        errors: {
          ...get().errors,
          upload: getErrorMessage(error),
        },
        loading: { ...get().loading, upload: false },
      })
      throw error
    }
  },

  confirmImport: async (skipDuplicates: boolean) => {
    const currentImport = get().currentImport
    if (!currentImport) return

    set({
      loading: { ...get().loading, confirm: true },
      errors: { ...get().errors, confirm: null },
    })

    try {
      await bankStatementImportApi.confirm(currentImport.id, { skip_duplicates: skipDuplicates })

      // Refresh list
      await get().fetchImports()

      set({
        loading: { ...get().loading, confirm: false },
        showAnalysisModal: false,
        showConfirmModal: false,
      })
    } catch (error) {
      set({
        errors: {
          ...get().errors,
          confirm: getErrorMessage(error),
        },
        loading: { ...get().loading, confirm: false },
      })
      throw error
    }
  },

  cancelImport: async (id: string) => {
    set({ loading: { ...get().loading, confirm: true } })
    try {
      await bankStatementImportApi.cancel(id)
      await get().fetchImports()
    } finally {
      set({ loading: { ...get().loading, confirm: false } })
    }
  },

  retryImport: async (id: string) => {
    set({ loading: { ...get().loading, retry: true } })
    try {
      await bankStatementImportApi.retry(id)
      await get().fetchImports()
    } finally {
      set({ loading: { ...get().loading, retry: false } })
    }
  },

  deleteImport: async (id: string) => {
    set({ loading: { ...get().loading, delete: true } })
    try {
      await bankStatementImportApi.delete(id)
      await get().fetchImports()
    } finally {
      set({ loading: { ...get().loading, delete: false } })
    }
  },

  toggleSelection: (id: string) => {
    const selected = new Set(get().selectedIds)
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      selected.add(id)
    }
    set({ selectedIds: selected })
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: new Set(ids) })
  },

  clearSelection: () => {
    set({ selectedIds: new Set<string>() })
  },

  setFilters: (filters) => {
    set({ filters })
    get().fetchImports({ page: 1, filters })
  },

  setPagination: (page, limit) => {
    set({
      pagination: {
        ...get().pagination,
        page,
        limit: limit ?? get().pagination.limit,
      },
    })
    get().fetchImports({ page, limit })
  },

  openUploadModal: () => set({ showUploadModal: true }),
  closeUploadModal: () => set({ showUploadModal: false }),
  openAnalysisModal: () => set({ showAnalysisModal: true }),
  closeAnalysisModal: () => set({ showAnalysisModal: false }),
  openConfirmModal: () => set({ showConfirmModal: true }),
  closeConfirmModal: () => set({ showConfirmModal: false }),

  setCurrentImport: (imp) => set({ currentImport: imp }),
  clearAnalyzeResult: () => set({ analyzeResult: null }),
  clearError: (type) => {
    if (!type) {
      set({
        errors: {
          upload: null,
          confirm: null,
          general: null,
        },
      })
    } else {
      set({
        errors: {
          ...get().errors,
          [type]: null,
        },
      })
    }
  },
}))

