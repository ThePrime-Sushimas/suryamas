import { useMemo } from 'react'
import type { Company, CompanyStatus } from '../types'

const statusColors: Record<CompanyStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-red-100 text-red-800'
}

interface CompanyTableProps {
  companies: Company[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}

export const CompanyTable = ({
  companies,
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete
}: CompanyTableProps) => {
  const isEmpty = useMemo(() => companies.length === 0, [companies.length])
  
  if (isEmpty) {
    return <div className="text-center py-8 text-gray-500">No companies found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Code</th>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Type</th>
            <th className="border px-4 py-2 text-left">Email</th>
            <th className="border px-4 py-2 text-left">Status</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map(company => (
            <tr key={company.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{company.company_code}</td>
              <td className="border px-4 py-2">{company.company_name}</td>
              <td className="border px-4 py-2">{company.company_type}</td>
              <td className="border px-4 py-2">{company.email || '-'}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[company.status]}`}>
                  {company.status}
                </span>
              </td>
              <td className="border px-4 py-2 space-x-2">
                <button onClick={() => onView(company.id)} className="text-blue-600 hover:underline text-sm">
                  View
                </button>
                {canEdit && (
                  <button onClick={() => onEdit(company.id)} className="text-green-600 hover:underline text-sm">
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(company.id)} className="text-red-600 hover:underline text-sm">
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
