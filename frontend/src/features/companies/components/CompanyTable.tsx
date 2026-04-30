import { useMemo } from 'react'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Company, CompanyStatus } from '../types'

const statusColors: Record<CompanyStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface CompanyTableProps {
  companies: Company[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}

export const CompanyTable = ({ companies, onView, onEdit, onDelete, canEdit, canDelete }: CompanyTableProps) => {
  const isEmpty = useMemo(() => companies.length === 0, [companies.length])

  if (isEmpty) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Tidak ada company</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mulai dengan membuat company baru.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {companies.map(company => (
              <tr key={company.id} onClick={() => onView(company.id)}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{company.company_code}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{company.company_name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{company.company_type}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{company.email || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusColors[company.status]}`}>
                    {company.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onView(company.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Lihat">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => onEdit(company.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => onDelete(company.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
