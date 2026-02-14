import { useState } from 'react'
import { Trash2, FileText, Eye, ArrowUpDown, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PosImport, PosImportStatus } from '../types/pos-imports.types'
import { STATUS_COLORS } from '../constants/pos-imports.constants'

interface PosImportsTableProps {
  imports: PosImport[]
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  onSelectAll: (checked: boolean) => void
  onDelete: (id: string) => void
  isLoading: boolean
}

const SortableHeader = ({ 
  field, 
  label, 
  sortField, 
  sortDirection, 
  onSort 
}: { 
  field: keyof PosImport
  label: string
  sortField: keyof PosImport
  sortDirection: 'asc' | 'desc'
  onSort: (field: keyof PosImport) => void
}) => (
  <th 
    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      <ArrowUpDown size={12} className="text-gray-400" />
      {sortField === field && (
        <span className="text-xs font-bold">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </div>
  </th>
)

export const PosImportsTable = ({ 
  imports, 
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDelete, 
  isLoading 
}: PosImportsTableProps) => {
  const navigate = useNavigate()
  const [sortField, setSortField] = useState<keyof PosImport>('import_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Sort imports
  const sortedImports = [...imports].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    
    if (aValue === undefined || bValue === undefined) return 0
    if (aValue === bValue) return 0
    
    const comparison = aValue > bValue ? 1 : -1
    return sortDirection === 'asc' ? comparison : -comparison
  })
  
  const handleSort = (field: keyof PosImport) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }
  
  if (imports.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No imports yet</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Upload your first POS data file to get started
        </p>
        <div className="mt-6">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-upload-modal'))
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload First File
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Supported formats: .xlsx, .xls
        </p>
      </div>
    )
  }

  const getStatusColor = (status: PosImportStatus) => {
    return STATUS_COLORS[status] || STATUS_COLORS.PENDING
  }

  const isAllSelected = imports.length > 0 && selectedIds.size === imports.length

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                aria-label="Select all imports"
              />
            </th>
            <SortableHeader field="file_name" label="File Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader field="date_range_start" label="Date Range" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader field="total_rows" label="Total Rows" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">New</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duplicates</th>
            <SortableHeader field="status" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader field="import_date" label="Import Date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedImports.map((item) => (
            <tr 
              key={item.id} 
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 focus-within:bg-blue-50 dark:focus-within:bg-blue-900/20"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/pos-imports/${item.id}`)
                }
                if (e.key === ' ' || e.key === 'Spacebar') {
                  e.preventDefault()
                  onToggleSelection(item.id)
                }
              }}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelection(item.id)}
                  className="rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                  aria-label={`Select import ${item.file_name}`}
                />
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.file_name}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {new Date(item.date_range_start).toLocaleDateString()} - {new Date(item.date_range_end).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-center">{item.total_rows}</td>
              <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 text-center font-medium">{item.new_rows}</td>
              <td className="px-4 py-3 text-sm text-orange-600 dark:text-orange-400 text-center font-medium">{item.duplicate_rows}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {(item.import_date)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => navigate(`/pos-imports/${item.id}`)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="View Details"
                    aria-label={`View details for ${item.file_name}`}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                    title="Delete"
                    aria-label={`Delete ${item.file_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
