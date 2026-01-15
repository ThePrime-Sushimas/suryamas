import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderForm } from '../components/JournalHeaderForm'
import type { CreateJournalDto, UpdateJournalDto } from '../types/journal-header.types'

export function JournalHeaderFormPage() {
  const navigate = useNavigate()
  const { createJournal } = useJournalHeadersStore()

  const handleSubmit = useCallback(async (dto: CreateJournalDto | UpdateJournalDto) => {
    await createJournal(dto as CreateJournalDto)
    navigate('/accounting/journals')
  }, [createJournal, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/journals')
  }, [navigate])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Journal Entry</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <JournalHeaderForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  )
}
