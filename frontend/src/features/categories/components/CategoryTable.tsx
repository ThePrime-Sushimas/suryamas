import { TableSkeleton } from '@/components/ui/Skeleton'

import type { Category } from '../types'

interface CategoryTableProps {
  categories: Category[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onRestore: (id: string, name: string) => void
  isSelected: (id: string) => boolean
  onSelect: (id: string, checked: boolean) => void
  isAllSelected: boolean
  onSelectAll: (checked: boolean) => void
  showDeleted: boolean
  loading?: boolean
}

export const CategoryTable = ({ 
  categories, 
  onView, 
  onEdit, 
  onDelete,
  onRestore,
  isSelected,
  onSelect,
  isAllSelected,
  onSelectAll,
  showDeleted
, loading}: CategoryTableProps) => {
  if (loading) {
    return <TableSkeleton rows={6} columns={6} />
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-12">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No categories found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sort Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map(cat => (
              <tr key={cat.id} onClick={() => onView(cat.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer">
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected(cat.id)}
                    onChange={(e) => onSelect(cat.id, e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{cat.category_code}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {cat.category_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{cat.description || '-'}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">{cat.sort_order}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    cat.is_active 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                  {showDeleted ? (
                    <button onClick={() => onRestore(cat.id, cat.category_name)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition">Restore</button>
                  ) : (
                    <>
                      <button onClick={() => onEdit(cat.id)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium transition">Edit</button>
                      <button onClick={() => onDelete(cat.id, cat.category_name)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium transition">Delete</button>
                    </>
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
