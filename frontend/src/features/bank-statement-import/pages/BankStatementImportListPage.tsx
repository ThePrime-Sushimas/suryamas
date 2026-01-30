import { useEffect, useState, useMemo } from 'react'
import {
  Upload,
  FileText,
  RefreshCw,
  Search,
  AlertCircle,
  X,
  Eye,
  Trash2
} from 'lucide-react'
import { useBankStatementImportStore } from '../store/bank-statement-import.store'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '../components/common/StatusBadge'
import { UploadModal } from '../components/UploadModal'
import { AnalysisModal } from '../components/AnalysisModal'
import { ImportProgressCard } from '../components/ImportProgressCard'
import { formatFileSize } from '../utils/format'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

export function BankStatementImportListPage() {
  const navigate = useNavigate()

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
    setPagination,
    toggleSelection,
    selectAll,
    clearSelection,
    openUploadModal,
    closeUploadModal,
    closeAnalysisModal,
    clearError,
  } = useBankStatementImportStore()

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<number | null>(null)
  const [filters, setFilters] = useState({ search: '', status: '' })

  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  // Derived values
  const importsArray = useMemo(() => Array.isArray(imports) ? imports : [], [imports])
  const allIds = importsArray.map((imp) => imp.id)
  const allSelected = importsArray.length > 0 && importsArray.every((imp) => selectedIds.has(imp.id))
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  // Filter imports
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
    await uploadFile(file, bankAccountId)
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    await confirmImport(skipDuplicates)
  }

  const handleDelete = async (id: number) => {
    setShowDeleteConfirmation(id)
  }

  const confirmDelete = async () => {
    if (showDeleteConfirmation) {
      await deleteImport(showDeleteConfirmation)
      setShowDeleteConfirmation(null)
    }
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAll(allIds)
    } else {
      clearSelection()
    }
  }

  // Refresh handler

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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-400">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{errors.general}</p>
            </div>
            <button
              onClick={() => clearError('general')}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Active Import Progress */}
      {importsArray.some((imp) => imp.status === 'IMPORTING') && (
        <div className="space-y-4">
          {importsArray
            .filter((imp) => imp.status === 'IMPORTING')
            .slice(0, 1)
            .map((imp) => (
              <ImportProgressCard
                key={imp.id}
                importData={imp}
                onCancel={(id) => console.log('Cancel import:', id)}
                onRetry={(id) => console.log('Retry import:', id)}
              />
            ))}
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

      {/* Main Content Area */}
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
                            {imp.bank_account_id ? `Account #${imp.bank_account_id}` : '-'}
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
                Halaman {pagination.page} dari {totalPages}
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
                  disabled={filteredImports.length < pagination.limit}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      

      {/* Upload Modal */}
      <UploadModal
        isOpen={useBankStatementImportStore.getState().showUploadModal}
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
        isLoading={loading.confirm}
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
    </div>
  )
}

