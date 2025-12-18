import { Edit2, Trash2, Eye } from 'lucide-react'
import type { SubCategoryWithCategory } from '@/types/category'

interface Props {
  subCategories: SubCategoryWithCategory[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function SubCategoryTable({ subCategories, onView, onEdit, onDelete }: Props) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category Name</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sub Category Name</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sort Order</th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {subCategories.map(sub => (
          <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-6 py-4 text-sm text-gray-700">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {sub.category?.category_name || '-'}
              </span>
            </td>
            <td className="px-6 py-4 text-sm font-medium text-gray-900">{sub.sub_category_code}</td>
            <td className="px-6 py-4 text-sm text-gray-700">{sub.sub_category_name}</td>
            <td className="px-6 py-4 text-sm text-gray-600">{sub.description || '-'}</td>
            <td className="px-6 py-4 text-sm text-gray-600">{sub.sort_order}</td>
            <td className="px-6 py-4 text-right">
              <div className="flex justify-end gap-2">
                <button onClick={() => onView(sub.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => onEdit(sub.id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(sub.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
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
