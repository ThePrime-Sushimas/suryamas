import { Trash2, FileText, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PosImport } from '../types/pos-imports.types'

interface PosImportsTableProps {
  imports: PosImport[]
  onDelete: (id: string) => void
  isLoading: boolean
}

const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-800',
  ANALYZED: 'bg-blue-100 text-blue-800',
  IMPORTED: 'bg-green-100 text-green-800',
  MAPPED: 'bg-purple-100 text-purple-800',
  POSTED: 'bg-indigo-100 text-indigo-800',
  FAILED: 'bg-red-100 text-red-800'
}

export const PosImportsTable = ({ imports, onDelete, isLoading }: PosImportsTableProps) => {
  const navigate = useNavigate()
  if (imports.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No imports yet</h3>
        <p className="mt-1 text-sm text-gray-500">Upload an Excel file to get started</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Rows</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duplicates</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Import Date</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {imports.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">{item.file_name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {new Date(item.date_range_start).toLocaleDateString()} - {new Date(item.date_range_end).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.total_rows}</td>
              <td className="px-4 py-3 text-sm text-green-600 text-center font-medium">{item.new_rows}</td>
              <td className="px-4 py-3 text-sm text-orange-600 text-center font-medium">{item.duplicate_rows}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[item.status]}`}>
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {new Date(item.import_date).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => navigate(`/pos-imports/${item.id}`)}
                    className="text-blue-600 hover:text-blue-800"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    title="Delete"
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
