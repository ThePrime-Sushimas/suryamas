import { FolderTree, Pencil, Trash2, RotateCcw } from 'lucide-react'
import type { SubCategory } from '../types'

interface SubCategoryTableProps {
  subCategories: SubCategory[]
  loading?: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onRestore: (id: string, name: string) => void
  showDeleted: boolean
}

export const SubCategoryTable = ({ subCategories, loading, onView, onEdit, onDelete, onRestore, showDeleted }: SubCategoryTableProps) => {
  if (loading) {
    return <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
  }

  if (subCategories.length === 0) {
    return (
      <div className="p-12 text-center">
        <FolderTree className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Tidak ada sub-kategori</h3>
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
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {subCategories.map(sc => (
            <tr key={sc.id} onClick={() => onView(sc.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
              <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-200">{sc.sub_category_code}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{sc.sub_category_name}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{sc.description || '—'}</td>
              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{sc.sort_order}</td>
              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                {showDeleted ? (
                  <button onClick={() => onRestore(sc.id, sc.sub_category_name)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                    <RotateCcw className="w-3.5 h-3.5 inline mr-1" />Pulihkan
                  </button>
                ) : (
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => onEdit(sc.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(sc.id, sc.sub_category_name)} className="p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded">
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
