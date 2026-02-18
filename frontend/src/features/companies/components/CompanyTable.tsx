import { TableSkeleton } from '@/components/ui/Skeleton'

import { useMemo } from 'react'
import type { Company, CompanyStatus } from '../types'

const statusColors: Record<CompanyStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  closed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

interface CompanyTableProps {
  companies: Company[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
  loading?: boolean
}

export const CompanyTable = ({
  companies,
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  loading
}: CompanyTableProps) => {
  const isEmpty = useMemo(() => companies.length === 0, [companies.length])
  
  if (loading) {
    return <TableSkeleton rows={6} columns={6} />
  }
  
  if (isEmpty) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No companies found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new company.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {companies.map(company => (
              <tr 
                key={company.id} 
                onClick={() => onView(company.id)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{company.company_code}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{company.company_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{company.company_type}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{company.email || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[company.status]}`}>
                    {company.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm space-x-2">
                  {canEdit && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(company.id)
                      }} 
                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium transition"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(company.id)
                      }} 
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium transition"
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
    </div>
  )
}
