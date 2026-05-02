import { Eye, Pencil, Trash2, MapPin } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import type { Branch, BranchStatus } from '../types'

const statusColors: Record<BranchStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  closed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

interface BranchTableProps {
  branches: Branch[]
  loading?: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
  canDelete: boolean
}

export const BranchTable = ({ branches, loading, onView, onEdit, onDelete, canEdit, canDelete }: BranchTableProps) => {
  if (loading) {
    return <TableSkeleton rows={6} columns={6} />
  }

  if (branches.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <MapPin className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Tidak ada cabang</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mulai dengan membuat cabang baru.</p>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kota</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Jam Operasional</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {branches.map(branch => (
              <tr key={branch.id} onClick={() => onView(branch.id)}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{branch.branch_code}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{branch.branch_name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{branch.city}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusColors[branch.status]}`}>
                    {branch.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{branch.jam_buka} - {branch.jam_tutup}</td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onView(branch.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Lihat">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => onEdit(branch.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => onDelete(branch.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Hapus">
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
