import { useEffect } from 'react'
import { Upload, FileText, Trash2 } from 'lucide-react'
import { useBankStatementImportStore } from '../store/bank-statement-import.store'
import { BankStatementImportTable } from './BankStatementImportTable'
import { BankStatementImportFilters } from './BankStatementImportFilters'
import { UploadModal } from './UploadModal'
import { AnalysisModal } from './AnalysisModal'
import { ImportProgress } from './ImportProgress'

export function BankStatementImportPage() {
  const {
    imports,
    pagination,
    filters,
    loading,
    selectedIds,
    analyzeResult,
    uploadProgress,
    showUploadModal,
    errors,
    fetchImports,
    uploadFile,
    confirmImport,
    deleteImport,
    setPagination,
    toggleSelection,
    selectAll,
    clearSelection,
    openUploadModal,
    closeUploadModal,
    closeAnalysisModal,
    clearError,
  } = useBankStatementImportStore()

  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  const handleUpload = async (file: File, bankAccountId: string) => {
    await uploadFile(file, bankAccountId)
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    await confirmImport(skipDuplicates)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus import ini?')) {
      await deleteImport(id)
    }
  }

  const handlePrevPage = () => {
    const newPage = Math.max(1, pagination.page - 1)
    setPagination(newPage)
    fetchImports({ page: newPage })
  }

  const handleNextPage = () => {
    const newPage = pagination.page + 1
    setPagination(newPage)
    fetchImports({ page: newPage })
  }

  const allIds = imports.map((imp) => imp.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const hasActiveFilters = !!(filters.status || filters.dateFrom || filters.dateTo || filters.search)
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Bank Statement Import
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Upload dan kelola import mutasi bank dari file Excel
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              // Navigate to deleted imports page if exists
              console.log('Navigate to deleted imports')
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">Import Terhapus</span>
          </button>
          <button
            type="button"
            onClick={openUploadModal}
            disabled={loading.upload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Upload size={20} />
            <span className="hidden sm:inline">Upload File</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errors.general && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <p className="text-red-700 dark:text-red-400">{errors.general}</p>
            <button
              onClick={() => clearError('general')}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <BankStatementImportFilters />

      {/* Progress Alert for Active Imports */}
      {imports.some((imp) => imp.status === 'IMPORTING' || imp.status === 'PENDING') && (
        <ImportProgress
          importId={imports[0].id}
          totalRows={imports[0].total_rows}
          processedRows={imports[0].imported_rows}
          status={imports[0].status}
        />
      )}

      {/* Table or Loading/Empty States */}
      {loading.list ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="animate-pulse space-y-4">
            <div className="flex gap-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : !hasActiveFilters && imports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-4">
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Mulai Upload Bank Statement
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Upload file Excel mutasi bank untuk diimport ke dalam sistem. 
              Klik tombol "Upload File" untuk memulai.
            </p>
          </div>
        </div>
      ) : imports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Tidak Ada Data Ditemukan
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Coba ubah kriteria pencarian atau upload file baru.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Table */}
          <BankStatementImportTable
            imports={imports}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onSelectAll={(checked) => {
              if (checked) {
                selectAll(allIds)
              } else {
                clearSelection()
              }
            }}
            onDelete={handleDelete}
            onViewDetails={(id) => {
              // Navigate to detail page if needed
              console.log('View details:', id)
            }}
            isLoading={loading.delete || loading.list}
            allSelected={allSelected}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Halaman {pagination.page} dari {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={imports.length < pagination.limit}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Next
                </button>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total {pagination.total} data
              </span>
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          closeUploadModal()
        }}
        onUpload={handleUpload}
        isLoading={loading.upload}
        uploadProgress={uploadProgress}
      />

      {/* Analysis Modal */}
      <AnalysisModal
        result={analyzeResult}
        onConfirm={handleConfirm}
        onCancel={() => {
          closeAnalysisModal()
        }}
        isLoading={loading.confirm}
      />
    </div>
  )
}

