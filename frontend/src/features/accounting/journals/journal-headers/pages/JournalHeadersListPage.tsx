import { useNavigate } from 'react-router-dom'
import { Plus, ArrowUpDown, Trash2 } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderFilters } from '../components/JournalHeaderFilters'
import { JournalHeaderTable } from '../components/JournalHeaderTable'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import type { JournalHeader, JournalSortParams } from '../types/journal-header.types'

export function JournalHeadersListPage() {
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const {
    journals,
    loading,
    error,
    pagination,
    filters,
    fetchJournals,
    deleteJournal,
    setPage,
    setFilters,
    clearError,
    hasAppliedFilters,
  } = useJournalHeadersStore()

  const handleView = (journal: JournalHeader) => {
    navigate(`/accounting/journals/${journal.id}`)
  }

  const handleEdit = (journal: JournalHeader) => {
    navigate(`/accounting/journals/${journal.id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus journal ini?')) {
      await deleteJournal(id)
    }
  }

  const handleSort = (field: JournalSortParams['sort']) => {
    const newOrder = filters.sort === field && filters.order === 'desc' ? 'asc' : 'desc'
    setFilters({ sort: field, order: newOrder })
    fetchJournals({ sort: field, order: newOrder })
  }

  const handlePrevPage = () => {
    setPage(pagination.page - 1)
    if (hasAppliedFilters) {
      fetchJournals({})
    }
  }

  const handleNextPage = () => {
    setPage(pagination.page + 1)
    if (hasAppliedFilters) {
      fetchJournals({})
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Journal Entries</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola entri journal dan transaksi</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/accounting/journals/deleted')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">Journal Terhapus</span>
          </button>
          {permissions.canCreate && (
            <button
              onClick={() => navigate('/accounting/journals/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Journal Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <JournalHeaderFilters />

      {/* Table or Loading/Empty States */}
      {loading ? (
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
      ) : !hasAppliedFilters ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-4">
              <ArrowUpDown className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Mulai Mencari Journal
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Gunakan filter di atas untuk mencari journal berdasarkan branch, tipe, status, atau rentang tanggal.
            </p>
          </div>
        </div>
      ) : journals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <ArrowUpDown className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Tidak Ada Journal Ditemukan
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Coba ubah kriteria pencarian atau buat journal baru.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Journal</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pagination.total}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Debit</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
                  journals.reduce((sum, j) => sum + j.total_debit, 0)
                )}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Kredit</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
                  journals.reduce((sum, j) => sum + j.total_credit, 0)
                )}
              </p>
            </div>
          </div>

          {/* Table */}
          <JournalHeaderTable
            journals={journals}
            onView={permissions.canView ? handleView : undefined}
            onEdit={permissions.canEdit ? handleEdit : undefined}
            onDelete={permissions.canDelete ? handleDelete : undefined}
            onSort={handleSort}
            sortBy={filters.sort}
            sortOrder={filters.order}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Halaman {pagination.page} dari {pagination.totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={!pagination.hasNext}
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
    </div>
  )
}

