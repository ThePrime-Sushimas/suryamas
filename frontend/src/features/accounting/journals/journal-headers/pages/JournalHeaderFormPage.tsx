import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderForm } from '../components/JournalHeaderForm'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import type { CreateJournalDto, UpdateJournalDto } from '../types/journal-header.types'

export function JournalHeaderFormPage() {
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const { createJournal } = useJournalHeadersStore()

  const handleSubmit = useCallback(async (dto: CreateJournalDto | UpdateJournalDto) => {
    await createJournal(dto as CreateJournalDto)
    navigate('/accounting/journals')
  }, [createJournal, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/journals')
  }, [navigate])

  if (!permissions.canCreate) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">You don't have permission to create journals</p>
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
      <h1 className="text-2xl font-bold mb-6">Create Journal Entry</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <JournalHeaderForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  )
}
