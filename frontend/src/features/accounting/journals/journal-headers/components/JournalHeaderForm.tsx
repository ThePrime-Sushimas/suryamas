import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Plus } from 'lucide-react'
import { BalanceIndicator } from '../../journal-lines/components/BalanceIndicator'
import { JournalLinesTable } from './JournalLinesTable'
import { JOURNAL_TYPES } from '../../shared/journal.constants'
import { calculateBalance, validateJournalLines, getNextLineNumber } from '../../shared/journal.utils'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useAutoSaveDraft, loadDraft, clearDraft } from '../hooks/useAutoSaveDraft'
import type { CreateJournalDto, UpdateJournalDto, JournalHeaderWithLines } from '../types/journal-header.types'
import type { JournalLine, JournalLineWithDetails } from '../../shared/journal.types'
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
      // Include account info from backend for AccountSelector
      account_code: (l as JournalLineWithDetails).account_code,
      account_name: (l as JournalLineWithDetails).account_name,
      account_type: (l as JournalLineWithDetails).account_type,
    })) || [
      { line_number: 1, account_id: '', description: '', debit_amount: 0, credit_amount: 0, account_code: '', account_name: '', account_type: '' },
      { line_number: 2, account_id: '', description: '', debit_amount: 0, credit_amount: 0, account_code: '', account_name: '', account_type: '' },
    ]
  )
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    // Transform lines to remove account_info fields before sending to backend
    const linesForSubmit = lines.map(l => ({
      line_number: l.line_number,
      account_id: l.account_id,
      description: l.description || '',
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
    }))

    setErrors([])
    setIsSubmitting(true)
    
    try {
      const dto: CreateJournalDto | UpdateJournalDto = initialData
        ? {
            journal_date: journalDate,
            description,
            lines: linesForSubmit,
          }
        : {
            branch_id: currentBranch?.branch_id,
            journal_date: journalDate,
            journal_type: journalType as JournalType,
            description,
            lines: linesForSubmit,
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
      {/* Header Fields - Single Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tanggal <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={journalDate}
            onChange={(e) => setJournalDate(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipe <span className="text-red-500">*</span>
          </label>
          <select
            value={journalType}
            onChange={(e) => setJournalType(e.target.value as JournalType)}
            disabled={!!initialData}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
          >
            {Object.values(JOURNAL_TYPES).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deskripsi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Masukkan deskripsi jurnal"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
          />
        </div>
      </div>

      {/* Lines Table */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Baris Jurnal <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleAddLine}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Tambah Baris
          </button>
        </div>

        <JournalLinesTable
          lines={lines}
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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="font-medium text-red-800 dark:text-red-300 mb-2">Harap perbaiki kesalahan berikut:</p>
          <ul className="list-disc list-inside text-red-700 dark:text-red-400 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting || balance.total_debit !== balance.total_credit}
          className="px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? 'Menyimpan...' : initialData ? 'Update Jurnal' : 'Buat Jurnal'}
        </button>
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg py-2 px-4">
        <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-xs">Ctrl+Enter</kbd> untuk submit, <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-xs">Esc</kbd> untuk cancel
      </div>
    </form>
  )
}
