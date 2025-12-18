import { Edit2, Trash2, Eye } from 'lucide-react'
import type { Category } from '@/types/category'

interface Props {
  categories: Category[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function CategoryTable({ categories, onView, onEdit, onDelete }: Props) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category Name</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sort Order</th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {categories.map(cat => (
          <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.category_code}</td>
            <td className="px-6 py-4 text-sm text-gray-700">{cat.category_name}</td>
            <td className="px-6 py-4 text-sm text-gray-600">{cat.description || '-'}</td>
            <td className="px-6 py-4 text-sm text-gray-600">{cat.sort_order}</td>
            <td className="px-6 py-4 text-right">
              <div className="flex justify-end gap-2">
                <button onClick={() => onView(cat.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => onEdit(cat.id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(cat.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
