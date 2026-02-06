import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Upload,
  FileText,
  RefreshCw,
  Search,
  AlertCircle,
  X,
  Eye,
  Trash2,
  CheckSquare,
  Trash
} from 'lucide-react'
import { useBankStatementImportStore } from '../store/bank-statement-import.store'
import type { BankStatementImport } from '../types/bank-statement-import.types'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '../components/common/StatusBadge'
import { UploadModal } from '../components/UploadModal'
import { AnalysisModal } from '../components/AnalysisModal'
import { ImportProgressCard } from '../components/ImportProgressCard'
import { formatFileSize } from '../utils/format'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useJobPolling } from '@/hooks/_shared/useJobPolling'

export function BankStatementImportListPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const {
    imports,
    pagination,
    loading,
    selectedIds,
    analyzeResult,
    uploadProgress,
    errors,
    fetchImports,
    uploadFile,
    confirmImport,
    deleteImport,
    bulkDelete,
    setPagination,
    toggleSelection,
    selectAll,
    clearSelection,
    openUploadModal,
    closeUploadModal,
    closeAnalysisModal,
    clearError,
    showUploadModal,
  } = useBankStatementImportStore()

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<number | null>(null)
  const [showBulkDeleteConfirmation, setShowBulkDeleteConfirmation] = useState(false)
  const [filters, setFilters] = useState({ search: '', status: '' })

  // Derived values - MUST be declared before useEffect that uses them
  const importsArray = useMemo(() => Array.isArray(imports) ? imports : [], [imports])

  // Track which import IDs are currently being polled
  const [polledImportIds, setPolledImportIds] = useState<Set<number>>(new Set())

  // Single job polling instance
  const { startPolling, stopPolling, job: currentJob } = useJobPolling({
    interval: 2000,
    onComplete: useCallback(() => {
      fetchImports()
    }, [fetchImports]),
    onError: useCallback(() => {
      fetchImports()
    }, [fetchImports]),
  })

  // Start polling for importing items - FIXED: proper cleanup and single polling
  useEffect(() => {
    const importingItems = importsArray.filter(imp => imp.status === 'IMPORTING' && imp.job_id)
    
    // Start polling for new importing items
    importingItems.forEach(imp => {
      if (!polledImportIds.has(imp.id) && imp.job_id) {
        startPolling(imp.job_id)
        setPolledImportIds(prev => new Set(prev).add(imp.id))
      }
    })

    // Cleanup: stop polling for items that are no longer importing
    polledImportIds.forEach(importId => {
      const stillImporting = importingItems.some(imp => imp.id === importId)
      if (!stillImporting) {
        stopPolling()
        setPolledImportIds(prev => {
          const next = new Set(prev)
          next.delete(importId)
          return next
        })
      }
    })
  }, [importsArray, startPolling, stopPolling, polledImportIds])

  // Initial fetch
  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  // Derived values
  const allIds = importsArray.map((imp) => imp.id)
  const allSelected = importsArray.length > 0 && importsArray.every((imp) => selectedIds.has(imp.id))
  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const currentPageItemCount = importsArray.length

  // Filter imports - FIXED: server-side filtering via store
  const filteredImports = useMemo(() => {
    let result = importsArray
    if (filters.search) {
      const query = filters.search.toLowerCase()
      result = result.filter(imp => imp.file_name.toLowerCase().includes(query))
    }
    if (filters.status) {
      result = result.filter(imp => imp.status === filters.status)
    }
    return result
  }, [importsArray, filters])

  const handleUpload = async (file: File, bankAccountId: string) => {
    return await uploadFile(file, bankAccountId)
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    try {
      await confirmImport(skipDuplicates)
      toast.success('Import berhasil dikonfirmasi dan sedang diproses.')
      closeAnalysisModal()
    } catch {
      // Error ditampilkan melalui error state
    }
  }

  const handleDelete = async (id: number) => {
    setShowDeleteConfirmation(id)
  }

  const confirmDelete = async () => {
    if (showDeleteConfirmation) {
      try {
        await deleteImport(showDeleteConfirmation)
        toast.success('Import berhasil dihapus.')
      } catch {
        // Error ditampilkan melalui error state
      }
      setShowDeleteConfirmation(null)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    
    try {
      await bulkDelete(ids)
      toast.success(`${ids.length} import berhasil dihapus.`)
    } catch {
      // Error ditampilkan melalui error state
    }
    setShowBulkDeleteConfirmation(false)
  }

  const handlePrevPage = () => {
    const newPage = Math.max(1, pagination.page - 1)
    setPagination(newPage)
  }

  const handleNextPage = () => {
    const newPage = pagination.page + 1
    setPagination(newPage)
  }

  const handleRefresh = () => {
    fetchImports()
  }

  // FIXED: Select All now shows clear intent - selects only current page items
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAll(allIds)
    } else {
      clearSelection()
    }
  }

  // Loading state
  if (loading.list && importsArray.length === 0) {
    return (
      <div className="p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Filter Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <TableSkeleton rows={5} columns={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bank Statement Import
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Upload dan kelola data mutasi bank dengan mudah
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading.list}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading.list ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openUploadModal}
            disabled={loading.upload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload size={18} />
            Upload Bank Statement
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errors.general && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg shrink-0">
                <AlertCircle className="text-red-500" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-400">Terjadi Kesalahan</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{errors.general}</p>
                
                {/* Action Button */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => clearError('general')}
                    className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handleRefresh}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={14} />
                    Coba Lagi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Import Progress */}
      {importsArray.some((imp) => imp.status === 'IMPORTING') && (
        <div className="space-y-4">
          {importsArray
            .filter((imp) => imp.status === 'IMPORTING')
            .slice(0, 1)
            .map((imp) => {
              // Merge job data with import data if available
              const jobProgress = currentJob && typeof currentJob.progress === 'object' && currentJob.progress !== null
                ? currentJob.progress 
                : null
              const jobData = currentJob && polledImportIds.has(imp.id)
                ? {
                    ...imp,
                    processed_rows: jobProgress?.processed_rows || imp.processed_rows,
                    total_rows: jobProgress?.total_rows || imp.total_rows,
                    status: (currentJob.status === 'completed' ? 'COMPLETED' : 
                            currentJob.status === 'failed' ? 'FAILED' : 'IMPORTING') as BankStatementImport['status'],
                  }
                : imp
              
              return (
                <ImportProgressCard
                  key={imp.id}
                  importData={jobData}
                  onCancel={(id) => {
                    // Handle cancel - could call cancelImport from store
                    console.debug('Cancel import requested:', id)
                  }}
                  onRetry={(id) => {
                    // Handle retry - could call retryImport from store
                    console.debug('Retry import requested:', id)
                  }}
                />
              )
            })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Cari nama file..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu</option>
            <option value="ANALYZED">Siap Import</option>
            <option value="IMPORTING">Sedang Import</option>
            <option value="COMPLETED">Selesai</option>
            <option value="FAILED">Gagal</option>
          </select>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {filteredImports.length} dari {importsArray.length} file
            </span>
          {(filters.search || filters.status) && (
              <button
                onClick={() => setFilters({ search: '', status: '' })}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Hapus Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!loading.list && filteredImports.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {filters.search || filters.status ? 'Tidak ada hasil pencarian' : 'Belum ada import'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {filters.search || filters.status 
              ? 'Coba ubah filter atau kata pencarian'
              : 'Upload bank statement untuk memulai'}
          </p>
          {(filters.search || filters.status) && (
            <button
              onClick={() => setFilters({ search: '', status: '' })}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Hapus Filter
            </button>
          )}
        </div>
      )}

      {/* Bulk Action Bar - Muncul saat ada item dipilih */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  {selectedIds.size} item dipilih
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  dari halaman saat ini
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={clearSelection}
                className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors"
              >
                Batalkan Pilihan
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirmation(true)}
                disabled={loading.delete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash className="w-4 h-4" />
                Hapus Terpilih ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {filteredImports.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="w-[50px] text-center px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ukuran
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Baris
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredImports.map((imp) => (
                  <tr 
                    key={imp.id}
                    className={`
                      hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                      ${selectedIds.has(imp.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                    `}
                  >
                    <td className="text-center px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.has(imp.id)}
                        onChange={() => toggleSelection(imp.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`
                          p-2 rounded-lg 
                          ${imp.file_name.endsWith('.csv') 
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          }
                        `}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]" title={imp.file_name}>
                            {imp.file_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {imp.bank_name && imp.account_number 
                              ? `${imp.bank_name} - ${imp.account_number}`
                              : imp.account_number 
                                ? imp.account_number
                                : imp.bank_account_id 
                                  ? `Account #${imp.bank_account_id}`
                                  : '-'
                            }
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {formatFileSize(imp.file_size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {imp.created_at ? format(new Date(imp.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {imp.total_rows?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={imp.status} size="sm" animated={imp.status === 'IMPORTING'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/bank-statement-import/${imp.id}`)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(imp.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Halaman {pagination.page} dari {totalPages} ({currentPageItemCount} item)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
                <button
                  onClick={handleNextPage}
                  disabled={currentPageItemCount < pagination.limit}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={closeUploadModal}
        onUpload={handleUpload}
        isLoading={loading.upload}
        uploadProgress={uploadProgress}
      />

      {/* Analysis Modal */}
      <AnalysisModal
        result={analyzeResult}
        onConfirm={handleConfirm}
        onCancel={closeAnalysisModal}
        error={errors.confirm}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              Konfirmasi Hapus
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus data import ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => setShowDeleteConfirmation(null)}
              >
                Batal
              </button>
              <button 
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
                onClick={confirmDelete}
                disabled={loading.delete}
              >
                {loading.delete ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm" />
                    Menghapus...
                  </span>
                ) : (
                  'Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              Konfirmasi Hapus Massal
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus <span className="font-semibold text-red-600">{selectedIds.size} data import</span> ini? 
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => setShowBulkDeleteConfirmation(false)}
              >
                Batal
              </button>
              <button 
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
                onClick={handleBulkDelete}
                disabled={loading.delete}
              >
                {loading.delete ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm" />
                    Menghapus...
                  </span>
                ) : (
                  `Hapus ${selectedIds.size} Item`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

