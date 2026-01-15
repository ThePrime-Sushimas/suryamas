import { Eye, Edit, Trash2, RotateCcw } from 'lucide-react'
import { JournalStatusBadge } from './JournalStatusBadge'
import { JournalTypeBadge } from './JournalTypeBadge'
import { formatCurrency, formatDate } from '../../shared/journal.utils'
import type { JournalHeader } from '../types/journal-header.types'

interface Props {
  journals: JournalHeader[]
  onView?: (journal: JournalHeader) => void
  onEdit?: (journal: JournalHeader) => void
  onDelete?: (id: string) => void
  onRestore?: (id: string) => void
  showDeleted?: boolean
}

export function JournalHeaderTable({ journals, onView, onEdit, onDelete, onRestore, showDeleted }: Props) {
  if (journals.length === 0) {
    return <div className="text-center py-12 text-gray-500">No journals found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Journal #</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {journals.map((journal) => (
            <tr key={journal.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-blue-600">
                {journal.journal_number}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {formatDate(journal.journal_date)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {journal.branch_name || 'All Branches'}
              </td>
              <td className="px-4 py-3">
                <JournalTypeBadge type={journal.journal_type} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                {journal.description}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-900">
                {formatCurrency(journal.total_debit)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-900">
                {formatCurrency(journal.total_credit)}
              </td>
              <td className="px-4 py-3">
                <JournalStatusBadge status={journal.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  {showDeleted ? (
                    onRestore && (
                      <button
                        onClick={() => onRestore(journal.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Restore"
                      >
                        <RotateCcw size={18} />
                      </button>
                    )
                  ) : (
                    <>
                      {onView && (
                        <button
                          onClick={() => onView(journal)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                      )}
                      {onEdit && journal.status === 'DRAFT' && (
                        <button
                          onClick={() => onEdit(journal)}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      {onDelete && journal.status === 'DRAFT' && (
                        <button
                          onClick={() => onDelete(journal.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={18} />
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
  )
}
