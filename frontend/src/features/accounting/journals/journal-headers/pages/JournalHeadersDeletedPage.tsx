import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderTable } from '../components/JournalHeaderTable'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import { Pagination } from '@/components/ui/Pagination'

export function JournalHeadersDeletedPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const permissions = useJournalPermissions()
  const { journals, loading, pagination, fetchJournals, setPage, setLimit, restoreJournal } = useJournalHeadersStore()
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)

  useEffect(() => {
    fetchJournals({ show_deleted: true })
  }, [fetchJournals])

  const handlePageChange = useCallback(async (page: number) => {
    try {
      setPage(page)
      await fetchJournals({ show_deleted: true })
    } catch (error) {
      console.error('Failed to fetch journals:', error)
    }
  }, [setPage, fetchJournals])

  const handleLimitChange = useCallback(async (limit: number) => {
    try {
      setLimit(limit)
      await fetchJournals({ show_deleted: true })
    } catch (error) {
      console.error('Failed to fetch journals:', error)
    }
  }, [setLimit, fetchJournals])

  const handleRestore = async (id: string) => {
    setRestoreTarget(id)
  }

  const confirmRestore = async () => {
    if (!restoreTarget) return
    try {
      await restoreJournal(restoreTarget)
      toast.success('Jurnal berhasil direstore')
      fetchJournals({ show_deleted: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal merestore jurnal')
    } finally {
      setRestoreTarget(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/accounting/journals')}
          className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold">Deleted Journals</h1>
          <p className="text-gray-600 mt-1">View and restore deleted journal entries</p>
        </div>
      </div>

      <div className="bg-white border rounded shadow">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : journals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No deleted journals found</div>
        ) : (
          <JournalHeaderTable
            journals={journals}
            onRestore={permissions.canRestore ? handleRestore : undefined}
            showDeleted
          />
        )}
      </div>

      {/* Global Pagination Component */}
      {pagination.total > 0 && (
        <Pagination
          pagination={{
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
            hasNext: pagination.hasNext,
            hasPrev: pagination.hasPrev
          }}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          currentLength={journals.length}
          loading={loading}
        />
      )}

      {/* Restore Confirm */}
      <ConfirmModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        title="Restore Journal"
        message="Are you sure you want to restore this journal?"
        confirmText="Restore"
        variant="success"
      />
    </div>
  )
}
