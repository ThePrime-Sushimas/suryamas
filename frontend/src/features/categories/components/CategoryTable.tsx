import { FolderOpen, Pencil, Trash2, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Category } from '../types'

interface CategoryTableProps {
  categories: Category[]
  loading?: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onRestore: (id: string, name: string) => void
  onToggleStatus?: (id: string, currentActive: boolean) => void
  showDeleted: boolean
}

export const CategoryTable = ({ categories, loading, onView, onEdit, onDelete, onRestore, onToggleStatus, showDeleted }: CategoryTableProps) => {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="p-12 text-center">
        <FolderOpen className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Tidak ada kategori</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coba ubah pencarian atau filter</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deskripsi</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Urutan</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {categories.map(cat => (
            <tr key={cat.id} onClick={() => onView(cat.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
              <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-200">{cat.category_code}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{cat.category_name}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{cat.description || '—'}</td>
              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{cat.sort_order}</td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cat.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {cat.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                {showDeleted ? (
                  <button onClick={() => onRestore(cat.id, cat.category_name)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                    <RotateCcw className="w-3.5 h-3.5 inline mr-1" />Pulihkan
                  </button>
                ) : (
                  <div className="flex gap-1 justify-end">
                    {onToggleStatus && (
                      <button onClick={() => onToggleStatus(cat.id, cat.is_active)}
                        className={`p-1.5 rounded ${cat.is_active ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20' : 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'}`}
                        title={cat.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                        {cat.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => onEdit(cat.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(cat.id, cat.category_name)} className="p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
