import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderTable } from '../components/JournalHeaderTable'
import { useJournalPermissions } from '../hooks/useJournalPermissions'

export function JournalHeadersDeletedPage() {
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const { journals, loading, fetchJournals, restoreJournal } = useJournalHeadersStore()

  useEffect(() => {
    fetchJournals({ show_deleted: true })
  }, [fetchJournals])

  const handleRestore = async (id: string) => {
    if (confirm('Are you sure you want to restore this journal?')) {
      await restoreJournal(id)
      fetchJournals({ show_deleted: true })
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
    </div>
  )
}
