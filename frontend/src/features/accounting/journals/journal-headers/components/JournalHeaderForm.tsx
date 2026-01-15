import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Plus } from 'lucide-react'
import { BalanceIndicator } from '../../journal-lines/components/BalanceIndicator'
import { JournalLinesTable } from './JournalLinesTable'
import { JOURNAL_TYPES } from '../../shared/journal.constants'
import { calculateBalance, validateJournalLines, getNextLineNumber } from '../../shared/journal.utils'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useAutoSaveDraft, loadDraft, clearDraft } from '../hooks/useAutoSaveDraft'
import type { CreateJournalDto, UpdateJournalDto, JournalHeaderWithLines } from '../types/journal-header.types'
import type { JournalLine } from '../../shared/journal.types'
import type { JournalType } from '../../shared/journal.types'

interface Props {
  initialData?: JournalHeaderWithLines
  onSubmit: (dto: CreateJournalDto | UpdateJournalDto) => Promise<void>
  onCancel: () => void
}

export function JournalHeaderForm({ initialData, onSubmit, onCancel }: Props) {
  const currentBranch = useBranchContextStore((state) => state.currentBranch)
  const hasLoadedDraft = useRef(false)
  
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [journalDate, setJournalDate] = useState(initialData?.journal_date || new Date().toISOString().split('T')[0])
  const [journalType, setJournalType] = useState(initialData?.journal_type || 'MANUAL')
  const [description, setDescription] = useState(initialData?.description || '')
  const [lines, setLines] = useState<JournalLine[]>(
    initialData?.lines?.map(l => ({
      line_number: l.line_number,
      account_id: l.account_id,
      description: l.description || '',
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
    })) || [
      { line_number: 1, account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
      { line_number: 2, account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
    ]
  )
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const branchName = currentBranch?.branch_name || 'All Branches'
  const balance = useMemo(() => calculateBalance(lines), [lines])
  
  // Auto-save draft
  useAutoSaveDraft(journalDate, description, lines, !!initialData)
  
  // Load draft on mount (useRef prevents double prompt in Strict Mode)
  useEffect(() => {
    if (!initialData && !draftLoaded && !hasLoadedDraft.current) {
      hasLoadedDraft.current = true
      const draft = loadDraft()
      if (draft) {
        const shouldLoad = window.confirm(
          `Found unsaved draft from ${new Date(draft.savedAt).toLocaleString()}. Load it?`
        )
        if (shouldLoad) {
          setJournalDate(draft.journalDate)
          setDescription(draft.description)
          setLines(draft.lines)
        } else {
          clearDraft()
        }
      }
      setDraftLoaded(true)
    }
  }, [initialData, draftLoaded])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        const form = document.querySelector('form')
        if (form) form.requestSubmit()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])
  
  // Currency formatter
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }, [])

  const handleAddLine = useCallback(() => {
    setLines(prev => [...prev, {
      line_number: getNextLineNumber(prev),
      account_id: '',
      description: '',
      debit_amount: 0,
      credit_amount: 0,
    }])
  }, [])

  const handleRemoveLine = useCallback((index: number) => {
    if (lines.length <= 2) {
      alert('Journal must have at least 2 lines')
      return
    }
    setLines(prev => {
      const newLines = prev.filter((_, i) => i !== index)
      newLines.forEach((line, i) => {
        line.line_number = i + 1
      })
      return newLines
    })
  }, [lines.length])

  const handleLineChange = useCallback((index: number, field: keyof JournalLine, value: string | number) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== index) return line
      
      const updatedLine = { ...line, [field]: value }
      
      if (field === 'debit_amount' && Number(value) > 0) {
        updatedLine.credit_amount = 0
      } else if (field === 'credit_amount' && Number(value) > 0) {
        updatedLine.debit_amount = 0
      }
      
      return updatedLine
    }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateJournalLines(lines)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setIsSubmitting(true)
    
    try {
      const dto: CreateJournalDto | UpdateJournalDto = initialData
        ? {
            journal_date: journalDate,
            description,
            lines,
          }
        : {
            branch_id: currentBranch?.branch_id,
            journal_date: journalDate,
            journal_type: journalType as JournalType,
            description,
            lines,
          }
      
      await onSubmit(dto)
      clearDraft()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save journal'
      setErrors([message])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={journalDate}
            onChange={(e) => setJournalDate(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            value={journalType}
            onChange={(e) => setJournalType(e.target.value as JournalType)}
            disabled={!!initialData}
            required
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
          >
            {Object.values(JOURNAL_TYPES).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Enter journal description"
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Lines Table */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Journal Lines <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleAddLine}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus size={16} />
            Add Line
          </button>
        </div>

        <JournalLinesTable
          lines={lines}
          branchName={branchName}
          onLineChange={handleLineChange}
          onRemoveLine={handleRemoveLine}
          formatCurrency={formatCurrency}
        />

        <div className="mt-4">
          <BalanceIndicator balance={balance} />
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="font-medium text-red-800 mb-2">Please fix the following errors:</p>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || balance.total_debit !== balance.total_credit}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update Journal' : 'Create Journal'}
        </button>
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="text-xs text-gray-500 text-center">
        Tip: Press Ctrl+Enter to submit, Esc to cancel
      </div>
    </form>
  )
}
