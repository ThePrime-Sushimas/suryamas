import { useCallback, useMemo } from 'react'
import { useBankStatementImportStore } from '../store/bank-statement-import.store'
import type { BankStatementImport, BankStatementImportFilters, BankStatementAnalysisResult } from '../types/bank-statement-import.types'

interface UseBankStatementImportReturn {
  // Data
  imports: BankStatementImport[]
  currentImport: BankStatementImport | null
  analyzeResult: BankStatementAnalysisResult | null
  
  // Pagination
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  
  // Filters
  filters: BankStatementImportFilters
  activeFiltersCount: number
  
  // Selection
  selectedIds: Set<number>
  selectedCount: number
  allSelected: boolean
  hasSelection: boolean
  
  // Loading states
  loading: {
    list: boolean
    upload: boolean
    confirm: boolean
    delete: boolean
    retry: boolean
  }
  
  // Error states
  errors: {
    upload: string | null
    confirm: string | null
    general: string | null
  }
  
  // Computed values
  completedImports: BankStatementImport[]
  processingImports: BankStatementImport[]
  failedImports: BankStatementImport[]
  totalRows: number
  
  // Actions
  fetchImports: (params?: { page?: number; limit?: number; filters?: BankStatementImportFilters }) => Promise<void>
  uploadFile: (file: File, bankAccountId: string) => Promise<void>
  confirmImport: (skipDuplicates: boolean) => Promise<void>
  cancelImport: (id: number) => Promise<void>
  retryImport: (id: number) => Promise<void>
  deleteImport: (id: number) => Promise<void>
  
  // Bulk actions
  toggleSelection: (id: number) => void
  selectAll: () => void
  clearSelection: () => void
  selectByStatus: (status: BankStatementImport['status']) => void
  
  // Filter actions
  setFilters: (filters: BankStatementImportFilters) => void
  clearFilters: () => void
  
  // Modal actions
  openUploadModal: () => void
  closeUploadModal: () => void
  openAnalysisModal: () => void
  closeAnalysisModal: () => void
  
  // Utility actions
  clearError: (type?: keyof UseBankStatementImportReturn['errors']) => void
  clearAnalyzeResult: () => void
  refresh: () => Promise<void>
}

export function useBankStatementImport(): UseBankStatementImportReturn {
  const store = useBankStatementImportStore()
  
  // Computed values
  const importsArray = useMemo(() => Array.isArray(store.imports) ? store.imports : [], [store.imports])
  
  const selectedCount = store.selectedIds.size
  const allSelected = importsArray.length > 0 && importsArray.every((imp) => store.selectedIds.has(imp.id))
  const hasSelection = selectedCount > 0
  
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (store.filters.status && store.filters.status !== 'ALL') count++
    if (store.filters.dateFrom) count++
    if (store.filters.dateTo) count++
    if (store.filters.search && store.filters.search.trim()) count++
    return count
  }, [store.filters])
  
  const completedImports = useMemo(() => 
    importsArray.filter((imp) => imp.status === 'COMPLETED'),
    [importsArray]
  )
  
  const processingImports = useMemo(() => 
    importsArray.filter((imp) => ['IMPORTING', 'PENDING', 'ANALYZED'].includes(imp.status)),
    [importsArray]
  )
  
  const failedImports = useMemo(() => 
    importsArray.filter((imp) => imp.status === 'FAILED'),
    [importsArray]
  )
  
  const totalRows = useMemo(() => 
    importsArray.reduce((sum, imp) => sum + (imp.total_rows || 0), 0),
    [importsArray]
  )
  
  const totalPages = Math.ceil(store.pagination.total / store.pagination.limit)
  
  // Actions
  const selectByStatus = useCallback((status: BankStatementImport['status']) => {
    const ids = importsArray
      .filter((imp) => imp.status === status)
      .map((imp) => imp.id)
    store.selectAll(ids)
  }, [importsArray, store])
  
  const refresh = useCallback(async () => {
    await store.fetchImports()
  }, [store])
  
  return {
    // Data
    imports: importsArray,
    currentImport: store.currentImport,
    analyzeResult: store.analyzeResult,
    
    // Pagination
    pagination: {
      ...store.pagination,
      totalPages,
    },
    
    // Filters
    filters: store.filters,
    activeFiltersCount,
    
    // Selection
    selectedIds: store.selectedIds,
    selectedCount,
    allSelected,
    hasSelection,
    
    // Loading states
    loading: store.loading,
    
    // Error states
    errors: store.errors,
    
    // Computed values
    completedImports,
    processingImports,
    failedImports,
    totalRows,
    
    // Actions
    fetchImports: store.fetchImports,
    uploadFile: store.uploadFile,
    confirmImport: store.confirmImport,
    cancelImport: store.cancelImport,
    retryImport: store.retryImport,
    deleteImport: store.deleteImport,
    
    // Bulk actions
    toggleSelection: store.toggleSelection,
    selectAll: () => store.selectAll(importsArray.map((imp) => imp.id)),
    clearSelection: store.clearSelection,
    selectByStatus,
    
    // Filter actions
    setFilters: store.setFilters,
    clearFilters: () => store.setFilters({}),
    
    // Modal actions
    openUploadModal: store.openUploadModal,
    closeUploadModal: store.closeUploadModal,
    openAnalysisModal: store.openAnalysisModal,
    closeAnalysisModal: store.closeAnalysisModal,
    
    // Utility actions
    clearError: store.clearError,
    clearAnalyzeResult: store.clearAnalyzeResult,
    refresh,
  }
}

// Selector hooks for better performance
export function useImportStats() {
  const imports = useBankStatementImportStore((state) => state.imports)
  
  return useMemo(() => {
    const array = Array.isArray(imports) ? imports : []
    return {
      total: array.length,
      completed: array.filter((imp) => imp.status === 'COMPLETED').length,
      processing: array.filter((imp) => ['IMPORTING', 'PENDING', 'ANALYZED'].includes(imp.status)).length,
      failed: array.filter((imp) => imp.status === 'FAILED').length,
      totalRows: array.reduce((sum, imp) => sum + (imp.total_rows || 0), 0),
    }
  }, [imports])
}

export function useImportById(id: number) {
  const imports = useBankStatementImportStore((state) => state.imports)
  
  return useMemo(() => {
    const array = Array.isArray(imports) ? imports : []
    return array.find((imp) => imp.id === id) || null
  }, [imports, id])
}

export function useActiveImport() {
  const imports = useBankStatementImportStore((state) => state.imports)
  
  return useMemo(() => {
    const array = Array.isArray(imports) ? imports : []
    return array.find((imp) => imp.status === 'IMPORTING') || null
  }, [imports])
}

