import { Eye, Edit, Trash2, RotateCcw, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { JournalStatusBadge } from './JournalStatusBadge'
import { JournalTypeBadge } from './JournalTypeBadge'
import { formatCurrency, formatDate } from '../../shared/journal.utils'
import type { JournalHeader, JournalSortParams } from '../types/journal-header.types'

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

// Kolom yang bisa di-sort
const sortableColumns: JournalSortParams['sort'][] = ['journal_date', 'journal_number', 'total_debit', 'total_credit', 'created_at']

export function JournalHeaderTable({ 
  journals, 
  onView, 
  onEdit, 
  onDelete, 
  onRestore,
  onSort,
  sortBy = 'journal_date',
  sortOrder = 'desc',
  showDeleted 
}: Props) {
  if (journals.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <ArrowUpDown className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Tidak ada journal ditemukan</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Coba ubah filter atau buat journal baru</p>
        </div>
      </div>
    )
  }

  const columns = [
    { key: 'journal_number', label: 'Nomor', width: 'w-32' },
    { key: 'journal_date', label: 'Tanggal', width: 'w-36' },
    { key: 'branch_name', label: 'Branch', width: 'w-36' },
    { key: 'journal_type', label: 'Tipe', width: 'w-36' },
    { key: 'description', label: 'Deskripsi', width: 'flex-1' },
    { key: 'total_debit', label: 'Debit', width: 'w-36', align: 'right' as const },
    { key: 'total_credit', label: 'Kredit', width: 'w-36', align: 'right' as const },
    { key: 'status', label: 'Status', width: 'w-32' },
    { key: 'actions', label: 'Aksi', width: 'w-28', align: 'center' as const },
  ]

  const SortIcon = ({ field }: { field: string }) => {
    const sortField = field as JournalSortParams['sort']
    if (!sortableColumns.includes(sortField)) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />
    if (sortBy !== sortField) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />
    return sortOrder === 'desc' 
      ? <ChevronDown className="w-3 h-3 text-blue-600 ml-1" />
      : <ChevronUp className="w-3 h-3 text-blue-600 ml-1" />
  }

  const handleSort = (key: string) => {
    const sortField = key as JournalSortParams['sort']
    if (onSort && sortableColumns.includes(sortField)) {
      onSort(sortField)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                    col.width
                  } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {onSort && sortableColumns.includes(col.key as JournalSortParams['sort']) ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      {col.label}
                      <SortIcon field={col.key} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {journals.map((journal, index) => (
              <tr
                key={journal.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  index % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-900/20' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {journal.journal_number}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(journal.journal_date)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {journal.branch_name || 'Semua Branch'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <JournalTypeBadge type={journal.journal_type} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate block">
                    {journal.description}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(journal.total_debit)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(journal.total_credit)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <JournalStatusBadge status={journal.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {showDeleted ? (
                      onRestore && (
                        <button
                          onClick={() => onRestore(journal.id)}
                          className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                          title="Restore"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )
                    ) : (
                      <>
                        {onView && (
                          <button
                            onClick={() => onView(journal)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Lihat"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {onEdit && journal.status === 'DRAFT' && (
                          <button
                            onClick={() => onEdit(journal)}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {onDelete && journal.status === 'DRAFT' && (
                          <button
                            onClick={() => onDelete(journal.id)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
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

