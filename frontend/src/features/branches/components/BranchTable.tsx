import type { Branch, BranchStatus } from '../types'

const statusColors: Record<BranchStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800'
}

interface BranchTableProps {
  branches: Branch[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}

export const BranchTable = ({ branches, onView, onEdit, onDelete, canEdit, canDelete }: BranchTableProps) => {
  if (branches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No branches found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new branch.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operating Hours</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {branches.map(branch => (
              <tr key={branch.id} onClick={() => onView(branch.id)} className="hover:bg-gray-50 transition cursor-pointer">
                <td className="px-4 py-3 text-sm font-mono text-gray-900">{branch.branch_code}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {branch.branch_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{branch.city}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[branch.status]}`}>
                    {branch.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{branch.jam_buka} - {branch.jam_tutup}</td>
                <td className="px-4 py-3 text-right text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                  {canEdit && <button onClick={() => onEdit(branch.id)} className="text-green-600 hover:text-green-800 font-medium transition">Edit</button>}
                  {canDelete && <button onClick={() => onDelete(branch.id)} className="text-red-600 hover:text-red-800 font-medium transition">Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
