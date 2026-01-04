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
}: CategoryTableProps) => {
  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No categories found</p>
        <p className="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-3 text-left w-12">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </th>
            <th className="border px-4 py-3 text-left">Code</th>
            <th className="border px-4 py-3 text-left">Name</th>
            <th className="border px-4 py-3 text-left">Description</th>
            <th className="border px-4 py-3 text-left">Sort Order</th>
            <th className="border px-4 py-3 text-left">Status</th>
            <th className="border px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => (
            <tr key={cat.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">
                <input
                  type="checkbox"
                  checked={isSelected(cat.id)}
                  onChange={(e) => onSelect(cat.id, e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </td>
              <td className="border px-4 py-2 font-mono text-sm">{cat.category_code}</td>
              <td className="border px-4 py-2 font-semibold text-blue-900 hover:text-blue-600 cursor-pointer" onClick={() => onView(cat.id)}>
                {cat.category_name}
              </td>
              <td className="border px-4 py-2 text-gray-600">{cat.description || '-'}</td>
              <td className="border px-4 py-2 text-center">{cat.sort_order}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  cat.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {cat.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="border px-4 py-2 space-x-2">
                {showDeleted ? (
                  <button onClick={() => onRestore(cat.id, cat.category_name)} className="text-blue-600 hover:underline text-sm font-medium">Restore</button>
                ) : (
                  <>
                    <button onClick={() => onEdit(cat.id)} className="text-green-600 hover:underline text-sm font-medium">Edit</button>
                    <button onClick={() => onDelete(cat.id, cat.category_name)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
