import { ArrowUpDown } from 'lucide-react'
import type { Branch, BranchStatus } from '@/types/branch'

const statusColors: Record<BranchStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
}

interface BranchTableProps {
  branches: Branch[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
  onSort?: (field: string, order: 'asc' | 'desc') => void
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

const SortHeader = ({ label, field, sortField, sortOrder, onSort }: any) => {
  const isActive = sortField === field
  const nextOrder = isActive && sortOrder === 'asc' ? 'desc' : 'asc'

  return (
    <th
      onClick={() => onSort?.(field, nextOrder)}
      className="border px-4 py-2 text-left cursor-pointer hover:bg-gray-200 select-none"
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown
          className={`h-4 w-4 ${
            isActive ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
      </div>
    </th>
  )
}

export const BranchTable = ({
  branches,
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  onSort,
  sortField,
  sortOrder,
}: BranchTableProps) => {
  if (branches.length === 0) {
    return <div className="text-center py-8 text-gray-500">No branches found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <SortHeader label="Code" field="branch_code" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <SortHeader label="Name" field="branch_name" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <SortHeader label="City" field="city" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <SortHeader label="Status" field="status" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <th className="border px-4 py-2 text-left">Jam Operasional</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map(branch => (
            <tr key={branch.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{branch.branch_code}</td>
              <td onClick={() => onView(branch.id)} className="border font-semibold text-blue-900 hover:text-red-600 cursor-pointer px-4 py-2">{branch.branch_name}</td>
              <td className="border px-4 py-2">{branch.city}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[branch.status]}`}>
                  {branch.status}
                </span>
              </td>
              <td className="border px-4 py-2 text-sm">{branch.jam_buka} - {branch.jam_tutup}</td>
              <td className="border px-4 py-2 space-x-2">
                {canEdit && (
                  <button onClick={() => onEdit(branch.id)} className="text-green-600 hover:underline text-sm">
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(branch.id)} className="text-red-600 hover:underline text-sm">
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
