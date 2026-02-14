import { useEffect, useState, useRef, useMemo } from 'react'
import { Upload, AlertCircle, Search, X } from 'lucide-react'
import { usePosImportsStore } from '../store/pos-imports.store'
import { posImportsApi } from '../api/pos-imports.api'
import { UploadModal } from '../components/UploadModal'
import { AnalysisModal } from '../components/AnalysisModal'
import { PosImportsTable } from '../components/PosImportsTable'
import { ConfirmModal } from '../components/ConfirmModal'
import { PosImportsErrorBoundary } from '../components/PosImportsErrorBoundary'
import BulkActionBar from '@/components/BulkActionBar'
import { useBranchContextStore } from '@/features/branch_context'
import { useAuthStore } from '@/features/auth'
import { useToast } from '@/contexts/ToastContext'

function PosImportsPageContent() {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; fileName: string } | null>(null)
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const user = useAuthStore(s => s.user)
  const toast = useToast()
  const prevCompanyIdRef = useRef<string | undefined>(undefined)

  const {
    imports,
    analyzeResult,
    uploads,
    selectedIds,
    filters,
    loading,
    errors,
    fetchImports,
    uploadFile,
    confirmImport,
    deleteImport,
    batchConfirm,
    batchDelete,
    toggleSelection,
    selectAll,
    clearSelection,
    clearAnalyzeResult,
    clearError,
    setFilters,
    reset
  } = usePosImportsStore()

  // Sync errors from store to toast for visual feedback
  useEffect(() => {
    if (errors.general) {
      toast.error(errors.general)
      clearError('general')
    }
  }, [errors.general, toast, clearError])

  useEffect(() => {
    if (errors.upload) {
      toast.error(errors.upload)
    }
  }, [errors.upload, toast])

  const canConfirmSelected = useMemo(() => {
    return Array.from(selectedIds).some(id => {
      const imp = imports.find(i => i.id === id)
      return imp?.status === 'ANALYZED'
    })
  }, [selectedIds, imports])

  const activeUpload = Array.from(uploads.values())[0]
  const uploadProgress = activeUpload?.progress || 0

  useEffect(() => {
    if (currentBranch?.company_id && currentBranch.company_id !== prevCompanyIdRef.current) {
      fetchImports()
      prevCompanyIdRef.current = currentBranch.company_id
    }
  }, [currentBranch?.company_id, fetchImports])

  useEffect(() => {
    const handleOpenUpload = () => setShowUploadModal(true)
    window.addEventListener('open-upload-modal', handleOpenUpload)
    
    return () => {
      window.removeEventListener('open-upload-modal', handleOpenUpload)
      reset()
    }
  }, [reset])

  const handleUpload = async (file: File, branchId: string) => {
    if (!user?.id) {
      toast.error('User not authenticated')
      return
    }
    
    try {
      await uploadFile(file, branchId, user.id)
      setShowUploadModal(false)
      toast.success('File uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    }
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    if (!analyzeResult?.import.id) return
    
    try {
      await confirmImport(analyzeResult.import.id, skipDuplicates)
      clearAnalyzeResult()
      toast.success('Import confirmed successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Confirm failed')
    }
  }

  const handleDeleteClick = (id: string, fileName: string) => {
    setDeleteConfirm({ id, fileName })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    
    try {
      await deleteImport(deleteConfirm.id)
      setDeleteConfirm(null)
      toast.success('Import deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  const handleBatchDelete = async () => {
    try {
      await batchDelete(Array.from(selectedIds))
      setBatchDeleteConfirm(false)
      toast.success(`${selectedIds.size} imports deleted successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Batch delete failed')
    }
  }

  const handleBatchConfirm = async () => {
    const analyzedIds = Array.from(selectedIds).filter(id => {
      const imp = imports.find(i => i.id === id)
      return imp?.status === 'ANALYZED'
    })
    
    if (analyzedIds.length === 0) {
      toast.error('No analyzed imports selected')
      return
    }
    
    try {
      await batchConfirm(analyzedIds, true)
      toast.success(`${analyzedIds.length} imports confirmed successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Batch confirm failed')
    }
  }

  const handleBatchExport = async () => {
    const ids = Array.from(selectedIds)
    toast.info(`Exporting ${ids.length} imports...`)
    
    for (const id of ids) {
      try {
        const imp = imports.find(i => i.id === id)
        if (!imp) continue
        const blob = await posImportsApi.export(id)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${imp.file_name.replace(/\.[^/.]+$/, '')}_export.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Export failed for', id, error)
      }
    }
    toast.success('Export completed')
  }

  if (!currentBranch?.company_id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-300">Branch Required</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Please select a branch to manage POS imports
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS Imports</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Import and manage POS transaction data from Excel files
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload size={20} />
          Upload Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search file name..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {filters.search && (
              <button
                onClick={() => setFilters({ ...filters, search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ANALYZED">Analyzed</option>
            <option value="IMPORTED">Imported</option>
            <option value="MAPPED">Mapped</option>
            <option value="POSTED">Posted</option>
            <option value="FAILED">Failed</option>
          </select>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {imports.length} imports
            </span>
            {(filters.search || filters.status) && (
              <button
                onClick={() => setFilters({ search: '', status: '' })}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {errors.general && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-400">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{errors.general}</p>
            </div>
            <button
              onClick={() => clearError('general')}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <BulkActionBar
            selectedCount={selectedIds.size}
            actions={[
              {
                label: 'Clear Selection',
                onClick: clearSelection,
                className: 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600'
              },
              {
                label: 'Confirm Selected',
                onClick: handleBatchConfirm,
                disabled: !canConfirmSelected,
                className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
              },
              {
                label: 'Export Selected',
                onClick: handleBatchExport,
                className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
              },
              {
                label: 'Delete Selected',
                onClick: () => setBatchDeleteConfirm(true),
                className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700'
              }
            ]}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50">
        {loading.list ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading imports...</p>
          </div>
        ) : (
          <PosImportsTable
            imports={imports}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onSelectAll={(checked) => checked ? selectAll() : clearSelection()}
            onDelete={(id) => {
              const item = imports.find(i => i.id === id)
              if (item) handleDeleteClick(id, item.file_name)
            }}
            isLoading={loading.delete}
          />
        )}
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        isLoading={loading.list || !!activeUpload}
        uploadProgress={uploadProgress}
        error={errors.upload}
        onClearError={() => clearError('upload')}
      />

      <AnalysisModal
        result={analyzeResult}
        onConfirm={handleConfirm}
        onCancel={clearAnalyzeResult}
        isLoading={loading.confirm}
      />

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Import"
        message="This action cannot be undone. All transactions in this import will be permanently deleted."
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        variant="danger"
        actionType="DELETE"
        entityType="POS_IMPORT"
        contextData={deleteConfirm ? {
          id: deleteConfirm.id,
          name: deleteConfirm.fileName,
          type: 'POS Import'
        } : undefined}
        requireReason={true}
        reasonPlaceholder="Why are you deleting this import?"
        requiredPermission={{
          module: 'pos_imports',
          action: 'delete'
        }}
      />

      <ConfirmModal
        isOpen={batchDeleteConfirm}
        title="Delete Multiple Imports"
        message="This action cannot be undone. All selected imports and their transactions will be permanently deleted."
        confirmText="Delete All"
        onConfirm={handleBatchDelete}
        onCancel={() => setBatchDeleteConfirm(false)}
        variant="danger"
        actionType="DELETE"
        entityType="POS_IMPORT_BATCH"
        contextData={{
          type: 'Batch Delete',
          amount: selectedIds.size
        }}
        requireReason={true}
        reasonPlaceholder="Why are you deleting these imports?"
        requiredPermission={{
          module: 'pos_imports',
          action: 'delete'
        }}
      />
    </div>
  )
}

export const PosImportsPage = () => (
  <PosImportsErrorBoundary 
    module="POS_IMPORTS"
    submodule="MAIN_PAGE"
    businessCritical={true}
  >
    <PosImportsPageContent />
  </PosImportsErrorBoundary>
)
