import type { Category } from '../types'

interface CategoryTableProps {
  categories: Category[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const CategoryTable = ({ categories, onView, onEdit, onDelete }: CategoryTableProps) => {
  if (categories.length === 0) {
    return <div className="text-center py-8 text-gray-500">No categories found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Code</th>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Description</th>
            <th className="border px-4 py-2 text-left">Sort Order</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => (
            <tr key={cat.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{cat.category_code}</td>
              <td className="border px-4 py-2 font-semibold text-blue-900 hover:text-red-600 cursor-pointer" onClick={() => onView(cat.id)}>
                {cat.category_name}
              </td>
              <td className="border px-4 py-2">{cat.description || '-'}</td>
              <td className="border px-4 py-2">{cat.sort_order}</td>
              <td className="border px-4 py-2 space-x-2">
                <button onClick={() => onEdit(cat.id)} className="text-green-600 hover:underline text-sm">Edit</button>
                <button onClick={() => onDelete(cat.id)} className="text-red-600 hover:underline text-sm">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
