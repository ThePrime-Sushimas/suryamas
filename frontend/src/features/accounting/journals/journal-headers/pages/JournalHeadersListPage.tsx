import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderFilters } from '../components/JournalHeaderFilters'
import { JournalHeaderTable } from '../components/JournalHeaderTable'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import type { JournalHeader } from '../types/journal-header.types'

export function JournalHeadersListPage() {
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const {
    journals,
    loading,
    error,
    pagination,
    fetchJournals,
    deleteJournal,
    setPage,
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
    if (confirm('Are you sure you want to delete this journal?')) {
      await deleteJournal(id)
    }
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-gray-600 mt-1">Manage journal entries and transactions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/accounting/journals/deleted')}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            View Deleted
          </button>
          {permissions.canCreate && (
            <button
              onClick={() => navigate('/accounting/journals/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus size={20} />
              New Journal
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={clearError}
            className="text-red-600 underline mt-2 text-sm hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded p-4 shadow">
        <JournalHeaderFilters />
      </div>

      {/* Table */}
      <div className="bg-white border rounded shadow">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading journals...</div>
        ) : !hasAppliedFilters ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Please select filters and click Apply to display data</p>
          </div>
        ) : journals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No journals found</p>
          </div>
        ) : (
          <JournalHeaderTable
            journals={journals}
            onView={permissions.canView ? handleView : undefined}
            onEdit={permissions.canEdit ? handleEdit : undefined}
            onDelete={permissions.canDelete ? handleDelete : undefined}
          />
        )}
      </div>

      {/* Pagination */}
      {hasAppliedFilters && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={handlePrevPage}
            disabled={!pagination.hasPrev}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!pagination.hasNext}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

