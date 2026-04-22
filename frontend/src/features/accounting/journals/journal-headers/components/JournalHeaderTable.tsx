import { useEffect, useState } from 'react'
import { Eye, Edit, Trash2, RotateCcw, ChevronUp, ChevronDown, ArrowUpDown, AlertTriangle } from 'lucide-react'
import { JournalStatusBadge } from './JournalStatusBadge'
import { formatCurrency, formatDate } from '../../shared/journal.utils'
import type { JournalHeader, JournalSortParams } from '../types/journal-header.types'
import api from '@/lib/axios'

// Module-level cache — persists across strict mode remounts
let _lastCheckedKey = ''
let _lastCheckedResult = new Set<string>()

interface Props {
  journals: JournalHeader[]
  onView?: (journal: JournalHeader) => void
  onEdit?: (journal: JournalHeader) => void
  onDelete?: (id: string) => void
  onRestore?: (id: string) => void
  onSort?: (field: JournalSortParams['sort']) => void
  sortBy?: JournalSortParams['sort']
  sortOrder?: JournalSortParams['order']
  showDeleted?: boolean
}

const sortableColumns: JournalSortParams['sort'][] = ['journal_date', 'journal_number', 'total_debit', 'total_credit', 'created_at']

export function JournalHeaderTable({
  journals, onView, onEdit, onDelete, onRestore,
  onSort, sortBy = 'journal_date', sortOrder = 'desc', showDeleted
}: Props) {
  const [incompleteIds, setIncompleteIds] = useState<Set<string>>(new Set())

  const journalIdString = journals
    .filter(j => j.status === 'DRAFT' &&
      (j.source_module === 'POS_AGGREGATES' || j.journal_number?.startsWith('RCP-')))
    .map(j => j.id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!journalIdString) { setIncompleteIds(new Set()); return }

    if (_lastCheckedKey === journalIdString) {
      setIncompleteIds(_lastCheckedResult)
      return
    }

    // Claim this key immediately to prevent duplicate runs
    _lastCheckedKey = journalIdString

    let cancelled = false
    const checkAll = async () => {
      const ids = new Set<string>()
      const journalIds = journalIdString.split(',')
      const CHUNK_SIZE = 5
      for (let i = 0; i < journalIds.length; i += CHUNK_SIZE) {
        if (cancelled) return
        const chunk = journalIds.slice(i, i + CHUNK_SIZE)
        await Promise.all(chunk.map(async (id) => {
          try {
            const res = await api.get(`/accounting/journals/${id}/completeness`)
            if (!res.data.data.is_complete) ids.add(id)
          } catch { /* ignore */ }
        }))
      }
      if (!cancelled) {
        _lastCheckedResult = ids
        setIncompleteIds(ids)
      }
    }
    checkAll()
    return () => { cancelled = true }
  }, [journalIdString])

  if (journals.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <ArrowUpDown className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No journals found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try adjusting filters or create a new journal</p>
        </div>
      </div>
    )
  }

  const SortIcon = ({ field }: { field: string }) => {
    const f = field as JournalSortParams['sort']
    if (!sortableColumns.includes(f) || sortBy !== f) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />
    return sortOrder === 'desc'
      ? <ChevronDown className="w-3 h-3 text-blue-600 ml-1" />
      : <ChevronUp className="w-3 h-3 text-blue-600 ml-1" />
  }

  const SortableHeader = ({ field, label, align = 'left' }: { field: string; label: string; align?: string }) => {
    const isSortable = sortableColumns.includes(field as JournalSortParams['sort'])
    const cls = `px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap ${
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
    }`
    if (!isSortable || !onSort) return <th className={cls}>{label}</th>
    return (
      <th className={cls}>
        <button onClick={() => onSort(field as JournalSortParams['sort'])} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          {label}<SortIcon field={field} />
        </button>
      </th>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <SortableHeader field="journal_date" label="Date" />
              <SortableHeader field="journal_number" label="Journal" />
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Branch</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Description</th>
              <SortableHeader field="total_debit" label="Debit" align="right" />
              <SortableHeader field="total_credit" label="Credit" align="right" />
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Status</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {journals.map((journal) => (
              <tr
                key={journal.id}
                onClick={() => onView?.(journal)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                {/* Date */}
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {formatDate(journal.journal_date)}
                </td>

                {/* Journal Number + Type */}
                <td className="px-3 py-2 max-w-[180px]">
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate" title={journal.journal_number}>
                    {journal.journal_number}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">{journal.journal_type}</div>
                </td>

                {/* Branch — full width */}
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {journal.branch_name || '-'}
                </td>

                {/* Description — truncated */}
                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-[220px] truncate" title={journal.description}>
                  {journal.description}
                </td>

                {/* Debit */}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {journal.total_debit > 0 ? (
                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {formatCurrency(journal.total_debit)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300 dark:text-gray-600">-</span>
                  )}
                </td>

                {/* Credit */}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {journal.total_credit > 0 ? (
                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {formatCurrency(journal.total_credit)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300 dark:text-gray-600">-</span>
                  )}
                </td>

                {/* Status + Warning */}
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <JournalStatusBadge status={journal.status} />
                    {incompleteIds.has(journal.id) && (
                      <span title="Incomplete — some payment channels not yet reconciled">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {showDeleted ? (
                      onRestore && (
                        <button onClick={() => onRestore(journal.id)} className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors" title="Restore">
                          <RotateCcw size={15} />
                        </button>
                      )
                    ) : (
                      <>
                        {onView && (
                          <button onClick={() => onView(journal)} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="View">
                            <Eye size={15} />
                          </button>
                        )}
                        {onEdit && journal.status === 'DRAFT' && (
                          <button onClick={() => onEdit(journal)} className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Edit">
                            <Edit size={15} />
                          </button>
                        )}
                        {onDelete && journal.status === 'DRAFT' && (
                          <button onClick={() => onDelete(journal.id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
