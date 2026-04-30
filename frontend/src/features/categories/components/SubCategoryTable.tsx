import { TableSkeleton } from '@/components/ui/Skeleton'
import { Eye, Pencil, Trash2, RotateCcw, FolderTree } from 'lucide-react'
import type { SubCategoryWithCategory } from '../types'

interface SubCategoryTableProps {
  subCategories: SubCategoryWithCategory[]
  loading?: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onRestore: (id: string, name: string) => void
  isSelected: (id: string) => boolean
  onSelect: (id: string, checked: boolean) => void
  isAllSelected: boolean
  onSelectAll: (checked: boolean) => void
  showDeleted: boolean
}

export const SubCategoryTable = ({
  subCategories,
  loading,
  onView,
  onEdit,
  onDelete,
  onRestore,
  isSelected,
  onSelect,
  isAllSelected,
  onSelectAll,
  showDeleted,
}: SubCategoryTableProps) => {
  if (loading) {
    return <TableSkeleton rows={6} columns={6} />
  }

  if (subCategories.length === 0) {
    return (
      <div className="p-12">
        <div className="text-center">
          <FolderTree className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Tidak ada sub-kategori</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coba ubah pencarian atau filter Anda</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={e => onSelectAll(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kode</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deskripsi</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Urutan</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {subCategories.map(sub => (
            <tr key={sub.id} onClick={() => onView(sub.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer">
              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected(sub.id)}
                  onChange={e => onSelect(sub.id, e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{sub.category?.category_name || '-'}</td>
              <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{sub.sub_category_code}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{sub.sub_category_name}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{sub.description || '-'}</td>
              <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{sub.sort_order}</td>
              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  {showDeleted ? (
                    <button
                      onClick={() => onRestore(sub.id, sub.sub_category_name)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition"
                      title="Restore"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onView(sub.id)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition"
                        title="Lihat"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(sub.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 rounded-lg transition"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(sub.id, sub.sub_category_name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
