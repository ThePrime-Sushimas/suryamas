import { create } from 'zustand'
import { posImportsApi } from '../api/pos-imports.api'
import { validateUpload, validateDeletion, validateConfirmation } from '../utils/business-rules.util'
import { saveState, loadState } from '../utils/state-persistence.util'
import type { PosImport, AnalyzeResult } from '../types/pos-imports.types'
import { POS_IMPORT_DEFAULT_PAGE_SIZE } from '../constants/pos-imports.constants'

interface UploadSession {
  id: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  result?: AnalyzeResult
  error?: string
  controller: AbortController
  // Audit trail
  timestamp: Date
  userId: string
  branchId: string
  fileName: string
  fileSize: number
  job_id?: string  // Added for jobs system integration
}

interface Pagination {
  page: number
  limit: number
  total: number
}

interface ImportFilters {
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  [key: string]: string | undefined
}

interface PosImportsState {
  imports: PosImport[]
  currentImport: PosImport | null
  analyzeResult: AnalyzeResult | null
  uploads: Map<string, UploadSession>
  
  // Batch operations
  selectedIds: Set<string>
  
  // Pagination & Filtering
  pagination: Pagination
  filters: ImportFilters
  
  loading: {
    list: boolean
    detail: boolean
    confirm: boolean
    delete: boolean
    batch: boolean
  }
  
  // Structured errors
  errors: {
    upload: string | null
    confirm: string | null
    validation: string | null
    permission: string | null
    general: string | null
  }
  
  // Upload protection
  isUploading: boolean
  lastUploadTime: number | null

  fetchImports: (params?: { page?: number; limit?: number; filters?: ImportFilters }) => Promise<void>
  uploadFile: (file: File, branchId: string, userId: string) => Promise<string>
  cancelUpload: (uploadId: string) => void
  confirmImport: (id: string, skipDuplicates: boolean) => Promise<void>
  deleteImport: (id: string) => Promise<void>
  
  // Batch operations
  batchConfirm: (ids: string[], skipDuplicates: boolean) => Promise<void>
  batchDelete: (ids: string[]) => Promise<void>
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  
  // Filters
  setFilters: (filters: ImportFilters) => void
  setPagination: (page: number, limit?: number) => void
  
  // Export
  exportImport: (id: string) => Promise<Blob>

  clearAnalyzeResult: () => void
  clearError: (type?: keyof PosImportsState['errors']) => void
  reset: () => void
}

const initialState = {
  imports: [],
  currentImport: null,
  analyzeResult: null,
  uploads: new Map<string, UploadSession>(),
  selectedIds: new Set<string>(),
  pagination: {
    page: 1,
    limit: POS_IMPORT_DEFAULT_PAGE_SIZE,
    total: 0
  },
  filters: {},
  loading: {
    list: false,
    detail: false,
    confirm: false,
    delete: false,
    batch: false
  },
  errors: {
    upload: null,
    confirm: null,
    validation: null,
    permission: null,
    general: null
  },
  isUploading: false,
  lastUploadTime: null
}

export const usePosImportsStore = create<PosImportsState>((set, get) => {
  // Load persisted state on init
  const persisted = loadState()
  
  return {
  ...initialState,
  ...(persisted && {
    imports: persisted.imports,
    selectedIds: new Set(persisted.selectedIds),
    filters: persisted.filters || {}
  }),

  fetchImports: async (params) => {
    set({ loading: { ...get().loading, list: true }, errors: { ...get().errors, general: null } })
    try {
      const { page = get().pagination.page, limit = get().pagination.limit, filters = get().filters } = params || {}
      
      const data = await posImportsApi.list({ 
        page,
        limit,
        sort: 'created_at', 
        order: 'desc',
        ...filters
      })
      
      set({ 
        imports: data.data || [],
        pagination: {
          page,
          limit,
          total: data.pagination?.total || 0
        },
        loading: { ...get().loading, list: false } 
      })

      // Persist state
      saveState({ imports: data.data || [], filters: get().filters })
    } catch (error) {
      set({ 
        errors: { ...get().errors, general: error instanceof Error ? error.message : 'Failed to fetch imports' },
        loading: { ...get().loading, list: false }
      })
    }
  },

  uploadFile: async (file: File, branchId: string, userId: string) => {
    // Business rule validation
    const uploadValidation = validateUpload(file, get().lastUploadTime)
    if (!uploadValidation.valid) {
      const error = uploadValidation.error || 'Upload validation failed'
      set({ errors: { ...get().errors, upload: error } })
      throw new Error(error)
    }

    // Concurrent upload protection
    if (get().isUploading) {
      const error = 'Another upload is in progress'
      set({ errors: { ...get().errors, upload: error } })
      throw new Error(error)
    }

    const uploadId = crypto.randomUUID()
    const controller = new AbortController()
    const now = Date.now()
    
    const uploads = new Map(get().uploads)
    uploads.set(uploadId, {
      id: uploadId,
      progress: 0,
      status: 'uploading',
      controller,
      timestamp: new Date(),
      userId,
      branchId,
      fileName: file.name,
      fileSize: file.size,
      job_id: undefined  // Will be set after upload completes
    })
    set({ 
      uploads, 
      isUploading: true,
      lastUploadTime: now,
      errors: { ...get().errors, upload: null } 
    })

    try {
      const result = await posImportsApi.upload(
        file,
        branchId,
        controller.signal,
        (progress) => {
          const currentUploads = new Map(get().uploads)
          const session = currentUploads.get(uploadId)
          if (session) {
            session.progress = progress
            session.status = progress === 100 ? 'processing' : 'uploading'
            set({ uploads: currentUploads })
          }
        }
      )

      // Business rule validation
      const futureDates = result.analysis.duplicates.filter(d => 
        new Date(d.sales_date) > new Date()
      )
      if (futureDates.length > 0) {
        throw new Error('Cannot import future-dated transactions')
      }

      // Duplicate percentage validation
      const duplicatePercentage = (result.analysis.duplicate_rows / result.analysis.total_rows) * 100
      const confirmValidation = validateConfirmation(duplicatePercentage)
      if (confirmValidation.warning) {
        console.warn(confirmValidation.warning)
      }

      const currentUploads = new Map(get().uploads)
      const session = currentUploads.get(uploadId)
      if (session) {
        session.status = 'complete'
        session.result = result
        // Note: job_id is no longer returned from upload - it's created during confirm
        set({ 
          uploads: currentUploads,
          analyzeResult: result,
          isUploading: false
        })
      }

      return uploadId
    } catch (error) {
      if (error instanceof Error && error.name === 'CanceledError') {
        const currentUploads = new Map(get().uploads)
        currentUploads.delete(uploadId)
        set({ uploads: currentUploads, isUploading: false })
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
      const currentUploads = new Map(get().uploads)
      const session = currentUploads.get(uploadId)
      if (session) {
        session.status = 'error'
        session.error = errorMessage
        set({ 
          uploads: currentUploads, 
          errors: { ...get().errors, upload: errorMessage },
          isUploading: false
        })
      }
      throw error
    }
  },

  cancelUpload: (uploadId: string) => {
    const session = get().uploads.get(uploadId)
    if (session) {
      session.controller.abort()
      const uploads = new Map(get().uploads)
      uploads.delete(uploadId)
      set({ uploads })
    }
  },

  confirmImport: async (id: string, skipDuplicates: boolean) => {
    const optimisticImports = get().imports.map(imp =>
      imp.id === id ? { ...imp, status: 'IMPORTED' as const } : imp
    )
    set({ 
      imports: optimisticImports,
      loading: { ...get().loading, confirm: true }, 
      errors: { ...get().errors, confirm: null } 
    })

    try {
      // Call confirm endpoint - now returns { import, job_id }
      const response = await posImportsApi.confirm(id, skipDuplicates)
      
      // Store job_id for tracking if available
      if (response.data?.job_id) {
        const currentUploads = new Map(get().uploads)
        const session = Array.from(currentUploads.values())[0]
        if (session) {
          session.job_id = response.data.job_id
        }
      }
      
      set({ 
        analyzeResult: null,
        loading: { ...get().loading, confirm: false }
      })
      await get().fetchImports()
    } catch (error) {
      await get().fetchImports()
      const errorMessage = error instanceof Error ? error.message : 'Failed to confirm import'
      set({ 
        errors: { ...get().errors, confirm: errorMessage },
        loading: { ...get().loading, confirm: false }
      })
      throw error
    }
  },

  deleteImport: async (id: string) => {
    const importItem = get().imports.find(imp => imp.id === id)
    if (!importItem) {
      throw new Error('Import not found')
    }

    // Business rule validation
    const deleteValidation = validateDeletion()
    if (!deleteValidation.valid) {
      const error = deleteValidation.error || 'Delete validation failed'
      set({ errors: { ...get().errors, general: error } })
      throw new Error(error)
    }

    const optimisticImports = get().imports.filter(imp => imp.id !== id)
    const previousImports = get().imports
    
    set({ 
      imports: optimisticImports,
      loading: { ...get().loading, delete: true }, 
      errors: { ...get().errors, general: null } 
    })

    try {
      await posImportsApi.delete(id)
      set({ loading: { ...get().loading, delete: false } })
    } catch (error) {
      set({ 
        imports: previousImports,
        errors: { ...get().errors, general: error instanceof Error ? error.message : 'Failed to delete import' },
        loading: { ...get().loading, delete: false }
      })
      throw error
    }
  },

  // Batch operations
  batchConfirm: async (ids: string[], skipDuplicates: boolean) => {
    set({ loading: { ...get().loading, batch: true }, errors: { ...get().errors, confirm: null } })
    try {
      await Promise.all(ids.map(id => posImportsApi.confirm(id, skipDuplicates)))
      set({ loading: { ...get().loading, batch: false } })
      get().clearSelection()
      await get().fetchImports()
    } catch (error) {
      set({ 
        errors: { ...get().errors, confirm: error instanceof Error ? error.message : 'Failed to confirm imports' },
        loading: { ...get().loading, batch: false }
      })
      throw error
    }
  },

  batchDelete: async (ids: string[]) => {
    const optimisticImports = get().imports.filter(imp => !ids.includes(imp.id))
    const previousImports = get().imports
    
    set({ 
      imports: optimisticImports,
      loading: { ...get().loading, batch: true },
      errors: { ...get().errors, general: null }
    })

    try {
      await Promise.all(ids.map(id => posImportsApi.delete(id)))
      set({ loading: { ...get().loading, batch: false } })
      get().clearSelection()
    } catch (error) {
      set({ 
        imports: previousImports,
        errors: { ...get().errors, general: error instanceof Error ? error.message : 'Failed to delete imports' },
        loading: { ...get().loading, batch: false }
      })
      throw error
    }
  },

  toggleSelection: (id: string) => {
    const selectedIds = new Set(get().selectedIds)
    if (selectedIds.has(id)) {
      selectedIds.delete(id)
    } else {
      selectedIds.add(id)
    }
    set({ selectedIds })
    saveState({ selectedIds: Array.from(selectedIds) })
  },

  selectAll: () => {
    const selectedIds = new Set(get().imports.map(imp => imp.id))
    set({ selectedIds })
  },

  clearSelection: () => {
    set({ selectedIds: new Set() })
    saveState({ selectedIds: [] })
  },

  setFilters: (filters: ImportFilters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 } })
    saveState({ filters })
    get().fetchImports({ filters })
  },

  setPagination: (page: number, limit?: number) => {
    const newPagination = { ...get().pagination, page, ...(limit && { limit }) }
    set({ pagination: newPagination })
    get().fetchImports({ page, limit })
  },

  // Export
  exportImport: async (id: string): Promise<Blob> => {
    return await posImportsApi.export(id)
  },

  clearAnalyzeResult: () => set({ analyzeResult: null }),
  
  clearError: (type) => {
    if (type) {
      set({ errors: { ...get().errors, [type]: null } })
    } else {
      set({ errors: initialState.errors })
    }
  },
  
  reset: () => {
    get().uploads.forEach(session => session.controller.abort())
    set(initialState)
    saveState({ imports: [], selectedIds: [], filters: {} })
  }
  }})