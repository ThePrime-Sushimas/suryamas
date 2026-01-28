import { useState } from 'react'
import { Eye, Trash2, RotateCcw, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { BankStatementImportStatusBadge } from './BankStatementImportStatusBadge'
import { formatDate, formatFileSize } from '../utils/format'
import type { BankStatementImport } from '../types/bank-statement-import.types'

interface BankStatementImportTableProps {
  imports: BankStatementImport[]
  selectedIds: Set<string>
  allSelected?: boolean
  onToggleSelection: (id: string) => void
  onSelectAll: (checked: boolean) => void
  onDelete: (id: string) => void
  onViewDetails: (id: string) => void
  isLoading: boolean
  showDeleted?: boolean
}

type SortField = 'created_at' | 'file_name' | 'total_rows' | 'date_from'
type SortOrder = 'asc' | 'desc'

const sortableColumns: SortField[] = ['created_at', 'file_name', 'total_rows', 'date_from']

export function BankStatementImportTable({
  imports,
  selectedIds,
  allSelected = false,
  onToggleSelection,
  onSelectAll,
  onDelete,
  onViewDetails,
  isLoading,
  showDeleted = false,
}: BankStatementImportTableProps) {
  const [sortBy, setSortBy] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />
    }
    return sortOrder === 'desc' 
      ? <ChevronDown className="w-3 h-3 text-blue-600 ml-1" />
      : <ChevronUp className="w-3 h-3 text-blue-600 ml-1" />
  }

  const columns = [
    { key: 'file_name', label: 'Nama File', width: 'w-48' },
    { key: 'bank_account_id', label: 'Akun Bank', width: 'w-36' },
    { key: 'date_from', label: 'Periode', width: 'w-44' },
    { key: 'total_rows', label: 'Total Baris', width: 'w-28', align: 'right' as const },
    { key: 'status', label: 'Status', width: 'w-36' },
    { key: 'created_at', label: 'Tanggal Import', width: 'w-36' },
    { key: 'actions', label: 'Aksi', width: 'w-24', align: 'center' as const },
  ]

  if (imports.length === 0 && !isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <ArrowUpDown className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Tidak ada data import</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Upload file bank statement untuk memulai
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                    col.width
                  } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {sortableColumns.includes(col.key as SortField) ? (
                    <button
                      onClick={() => handleSort(col.key as SortField)}
                      className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      {col.label}
                      <SortIcon field={col.key as SortField} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {imports.map((imp, index) => {
              const selected = selectedIds.has(imp.id)
              
              return (
                <tr
                  key={imp.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    index % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-900/20' : ''
                  } ${selected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selected}
                      onChange={() => onToggleSelection(imp.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                        {imp.file_name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(imp.file_size)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {imp.date_from && imp.date_to 
                        ? `${formatDate(imp.date_from)} - ${formatDate(imp.date_to)}`
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {imp.total_rows.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BankStatementImportStatusBadge status={imp.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(imp.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {onViewDetails && (
                        <button
                          onClick={() => onViewDetails(imp.id)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {showDeleted ? (
                        onDelete && (
                          <button
                            onClick={() => onDelete(imp.id)}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="Pulihkan"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )
                      ) : (
                        onDelete && (
                          <button
                            onClick={() => onDelete(imp.id)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center">
          <span className="loading loading-spinner loading-sm text-blue-600" />
        </div>
      )}
    </div>
  )
}


