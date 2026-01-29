import { useEffect, useState } from 'react'
import { 
  Upload, 
  FileText, 
  Trash2, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Download,
  AlertCircle,
  X
} from 'lucide-react'
import { useBankStatementImportStore } from '../store/bank-statement-import.store'
import { StatsCards } from './import-page/StatsCards'
import { BulkActionsBar } from './import-page/BulkActionsBar'
import { EmptyUploadState, EmptySearchState } from './common/EmptyState'
import { TableSkeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from './common/StatusBadge'
import { UploadModal } from './UploadModal'
import { AnalysisModal } from './AnalysisModal'
import { ImportProgressCard } from './ImportProgressCard'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export function BankStatementImportPage() {
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

  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<string | null>(null)

  useEffect(() => {
    fetchImports()
  }, [fetchImports])

  // Derived values
  const importsArray = Array.isArray(imports) ? imports : []
  const allIds = importsArray.map((imp) => imp.id)
  const allSelected = importsArray.length > 0 && importsArray.every((imp) => selectedIds.has(imp.id))
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  const handleUpload = async (file: File, bankAccountId: string) => {
    await uploadFile(file, bankAccountId)
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    await confirmImport(skipDuplicates)
  }

  const handleDelete = async (id: string) => {
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

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    if (value.trim()) {
      useBankStatementImportStore.getState().setFilters({ search: value })
    } else {
      useBankStatementImportStore.getState().setFilters({ search: undefined })
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Loading state
  if (loading.list && importsArray.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <TableSkeleton rows={5} columns={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto bg-gray-50/50 dark:bg-gray-950 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Bank Statement Import
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Upload dan kelola data mutasi bank dengan mudah
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading.list}
            className="btn btn-ghost hover:bg-white hover:shadow-sm dark:hover:bg-gray-800 transition-all gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading.list ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={openUploadModal}
            disabled={loading.upload}
            className="btn btn-primary gap-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5"
          >
            <Upload size={18} />
            Upload Bank Statement
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errors.general && (
        <div className="alert alert-error shadow-sm rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <div className="flex-1">
            <span className="font-medium">Error:</span> {errors.general}
          </div>
          <button onClick={() => clearError('general')} className="btn btn-sm btn-ghost btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <StatsCards imports={importsArray} totalItems={pagination.total} />

      {/* Active Import Progress */}
      {importsArray.some((imp) => imp.status === 'IMPORTING') && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
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

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-1">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama file..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 focus:outline-none"
            />
          </div>
          <div className="w-px bg-gray-100 dark:bg-gray-700 hidden sm:block my-2" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-ghost m-1 gap-2 border-none ${showFilters ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
          >
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-300">Filter</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading.list ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <TableSkeleton rows={5} columns={6} />
        </div>
      ) : importsArray.length === 0 ? (
        searchTerm ? (
          <EmptySearchState
            onClear={() => {
              setSearchTerm('')
              useBankStatementImportStore.getState().setFilters({ search: undefined })
            }}
            searchTerm={searchTerm}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <EmptyUploadState onUpload={openUploadModal} />
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
             <BulkActionsBar
              selectedCount={selectedIds.size}
              onDelete={() => {
                if (selectedIds.size === 1) {
                  const id = Array.from(selectedIds)[0]
                  handleDelete(id)
                }
              }}
              onClearSelection={clearSelection}
              isLoading={loading.delete}
            />
          )}

          {/* Table Header Info */}
          {selectedIds.size === 0 && (
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                Riwayat Import
              </h3>
              <span className="text-sm px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 font-medium">
                {pagination.total} file
              </span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto min-h-[400px]">
            <table className="table w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="w-[50px] text-center">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm rounded-md"
                      checked={allSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAll(allIds)
                        } else {
                          clearSelection()
                        }
                      }}
                    />
                  </th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">File</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Ukuran</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Tanggal</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Total Baris</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4">Status</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 text-right pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {importsArray.map((imp) => (
                  <tr 
                    key={imp.id} 
                    className={`
                      hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors
                      ${selectedIds.has(imp.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
                    `}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm rounded-md"
                        checked={selectedIds.has(imp.id)}
                        onChange={() => toggleSelection(imp.id)}
                      />
                    </td>
                    <td>
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
                          <p className="font-medium text-gray-900 dark:text-white max-w-[200px] sm:max-w-[300px] truncate" title={imp.file_name}>
                            {imp.file_name}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            {imp.bank_account_id ? <span className="font-mono">Account #{imp.bank_account_id}</span> : '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {formatFileSize(imp.file_size)}
                    </td>
                    <td className="text-sm text-gray-600 dark:text-gray-400">
                      {imp.created_at ? format(new Date(imp.created_at), 'dd MMM yyyy, HH:mm', { locale: id }) : '-'}
                    </td>
                    <td className="text-sm font-medium text-gray-900 dark:text-white">
                      {imp.total_rows?.toLocaleString() || 0}
                    </td>
                    <td>
                      <StatusBadge status={imp.status} size="sm" animated={imp.status === 'IMPORTING'} />
                    </td>
                    <td className="text-right pr-4">
                      <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost btn-sm btn-square rounded-lg">
                          <MoreVertical className="w-4 h-4" />
                        </label>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-xl bg-white dark:bg-gray-800 rounded-xl w-52 border border-gray-100 dark:border-gray-700 text-sm">
                          <li>
                            <button onClick={() => console.log('View details:', imp.id)} className="rounded-lg">
                              <Eye className="w-4 h-4 mr-2" />
                              Lihat Detail
                            </button>
                          </li>
                          <li>
                            <button onClick={() => console.log('Download:', imp.id)} className="rounded-lg">
                              <Download className="w-4 h-4 mr-2" />
                              Download File
                            </button>
                          </li>
                          <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                          <li>
                            <button 
                              onClick={() => handleDelete(imp.id)}
                              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Hapus
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
              <span className="text-sm text-gray-500">
                Halaman {pagination.page} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pagination.page <= 1}
                  className="btn btn-sm btn-ghost hover:bg-white dark:hover:bg-gray-700 disabled:bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
                <button
                  onClick={handleNextPage}
                  disabled={importsArray.length < pagination.limit}
                  className="btn btn-sm btn-ghost hover:bg-white dark:hover:bg-gray-700 disabled:bg-transparent"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
        <div className="modal modal-open backdrop-blur-sm bg-black/30">
          <div className="modal-box bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl rounded-2xl p-6 max-w-sm">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Konfirmasi Hapus</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus data import ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                className="btn btn-ghost hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl" 
                onClick={() => setShowDeleteConfirmation(null)}
              >
                Batal
              </button>
              <button 
                className="btn btn-error text-white rounded-xl shadow-lg shadow-red-500/20" 
                onClick={confirmDelete} 
                disabled={loading.delete}
              >
                {loading.delete ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Menghapus...
                  </>
                ) : (
                  'Hapus'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDeleteConfirmation(null)} />
        </div>
      )}
    </div>
  )
}

