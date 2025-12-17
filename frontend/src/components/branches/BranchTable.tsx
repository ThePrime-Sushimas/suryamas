import type { Branch, BranchStatus } from '@/types/branch'

const statusColors: Record<BranchStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-red-100 text-red-800',
}

interface BranchTableProps {
  branches: Branch[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}

export const BranchTable = ({
  branches,
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: BranchTableProps) => {
  if (branches.length === 0) {
    return <div className="text-center py-8 text-gray-500">No branches found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Code</th>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">City</th>
            <th className="border px-4 py-2 text-left">Status</th>
            <th className="border px-4 py-2 text-left">Jam Operasional</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map(branch => (
            <tr key={branch.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{branch.branch_code}</td>
              <td className="border px-4 py-2">{branch.branch_name}</td>
              <td className="border px-4 py-2">{branch.city}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[branch.status]}`}>
                  {branch.status}
                </span>
              </td>
              <td className="border px-4 py-2 text-sm">{branch.jam_buka} - {branch.jam_tutup}</td>
              <td className="border px-4 py-2 space-x-2">
                <button onClick={() => onView(branch.id)} className="text-blue-600 hover:underline text-sm">
                  View
                </button>
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
