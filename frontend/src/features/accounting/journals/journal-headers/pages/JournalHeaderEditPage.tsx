import { useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderForm } from '../components/JournalHeaderForm'
import type { UpdateJournalDto } from '../types/journal-header.types'

export function JournalHeaderEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedJournal, isLoading, fetchJournalById, updateJournal } = useJournalHeadersStore()

  useEffect(() => {
    if (id) {
      fetchJournalById(id)
    }
  }, [id, fetchJournalById])

  const handleSubmit = useCallback(async (dto: UpdateJournalDto) => {
    if (id) {
      await updateJournal(id, dto)
      navigate('/accounting/journals')
    }
  }, [id, updateJournal, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/journals')
  }, [navigate])

  if (isLoading) {
    return <div className="p-6 text-center">Loading...</div>
  }

  if (!selectedJournal) {
    return <div className="p-6 text-center text-red-600">Journal not found</div>
  }

  if (selectedJournal.status !== 'DRAFT') {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-yellow-800">Cannot edit journal with status: {selectedJournal.status}</p>
          <button
            onClick={() => navigate('/accounting/journals')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to List
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Journal Entry</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <JournalHeaderForm
          initialData={selectedJournal}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
