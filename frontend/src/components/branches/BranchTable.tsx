import { ArrowUpDown } from 'lucide-react'
import type { Branch, BranchStatus, BranchSortField } from '@/types/branch'

type SortOrder = 'asc' | 'desc'

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
  onSort?: (field: BranchSortField, order: SortOrder) => void
  sortField?: BranchSortField
  sortOrder?: SortOrder
  selectedIds?: string[]
  onSelectAll?: (checked: boolean) => void
  onSelectOne?: (id: string, checked: boolean) => void
  isAllSelected?: boolean
}

interface SortHeaderProps {
  label: string
  field: BranchSortField
  sortField?: BranchSortField
  sortOrder?: SortOrder
  onSort?: (field: BranchSortField, order: SortOrder) => void
}

const SortHeader = ({ label, field, sortField, sortOrder, onSort }: SortHeaderProps) => {
  const isActive = sortField === field
  const nextOrder = isActive && sortOrder === 'asc' ? 'desc' : 'asc'

  return (
    <th
      onClick={() => onSort?.(field, nextOrder)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSort?.(field, nextOrder)
        }
      }}
      tabIndex={0}
      role="button"
      aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      aria-label={`Sort by ${label}`}
      className="border px-4 py-2 text-left cursor-pointer hover:bg-gray-200 select-none focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown
          className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
          aria-hidden="true"
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
  selectedIds = [],
  onSelectAll,
  onSelectOne,
  isAllSelected = false,
}: BranchTableProps) => {
  if (branches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" role="status" aria-live="polite">
        No branches found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" role="table" aria-label="Branches table">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left" scope="col">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSelectAll?.(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                aria-label="Select all branches"
              />
            </th>
            <SortHeader label="Code" field="branch_code" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <SortHeader label="Name" field="branch_name" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <SortHeader label="City" field="city" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <SortHeader label="Status" field="status" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
            <th className="border px-4 py-2 text-left" scope="col">Jam Operasional</th>
            <th className="border px-4 py-2 text-left" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map(branch => (
            <tr key={branch.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds?.includes(branch.id) || false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSelectOne?.(branch.id, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  aria-label={`Select ${branch.branch_name}`}
                />
              </td>
              <td className="border px-4 py-2">{branch.branch_code}</td>
              <td 
                onClick={() => onView(branch.id)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onView(branch.id)
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${branch.branch_name}`}
                className="border font-semibold text-blue-900 hover:text-red-600 cursor-pointer px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branch.branch_name}
              </td>
              <td className="border px-4 py-2">{branch.city}</td>
              <td className="border px-4 py-2">
                <span 
                  className={`px-2 py-1 rounded text-xs font-medium ${statusColors[branch.status]}`}
                  role="status"
                  aria-label={`Status: ${branch.status}`}
                >
                  {branch.status}
                </span>
              </td>
              <td className="border px-4 py-2 text-sm">{branch.jam_buka} - {branch.jam_tutup}</td>
              <td className="border px-4 py-2 space-x-2">
                {canEdit && (
                  <button 
                    onClick={() => onEdit(branch.id)} 
                    className="text-green-600 hover:underline text-sm focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-1"
                    aria-label={`Edit ${branch.branch_name}`}
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => onDelete(branch.id)} 
                    className="text-red-600 hover:underline text-sm focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
                    aria-label={`Delete ${branch.branch_name}`}
                  >
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
