import { memo } from 'react'
import type { EmployeeBranch } from '../api/types'

type Props = {
  data: EmployeeBranch[]
  total: number
  page: number
  limit: number
  loading: boolean
  onPageChange: (page: number) => void
  onEdit: (row: EmployeeBranch) => void
  onDelete: (row: EmployeeBranch) => void
  onSetPrimary: (row: EmployeeBranch) => void
}

export const EmployeeBranchTable = memo(function EmployeeBranchTable({
  data,
  total,
  page,
  limit,
  loading,
  onPageChange,
  onEdit,
  onDelete,
  onSetPrimary,
}: Props) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Branch</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Branch Code</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">Primary</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/4 mx-auto animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-8 bg-gray-200 rounded w-20 ml-auto animate-pulse" /></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-600">
                  Belum ada data employee branch
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{row.employee_name}</td>
                  <td className="px-4 py-3">{row.branch_name}</td>
                  <td className="px-4 py-3">{row.branch_code}</td>
                  <td className="px-4 py-3 text-center">
                    {row.is_primary ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-700">Primary</span>
                    ) : (
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => onSetPrimary(row)}
                      >
                        Set Primary
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => onEdit(row)}>Edit</button>
                    <button className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700" onClick={() => onDelete(row)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <div className="text-sm text-gray-600">Total {total} • Halaman {page}</div>
        <div className="space-x-2">
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            disabled={loading || (page * limit >= total)}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
})
