import type { Product } from '../../types/product'
import { Edit2, Trash2, Eye, RotateCcw } from 'lucide-react'

interface ProductTableProps {
  products: Product[]
  categories?: any[]
  subCategories?: any[]
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onView: (product: Product) => void
  selectedIds: string[]
  onSelectChange: (id: string, checked: boolean) => void
}

export const ProductTable = ({
  products,
  categories = [],
  subCategories = [],
  onEdit,
  onDelete,
  onRestore,
  onView,
  selectedIds,
  onSelectChange,
}: ProductTableProps) => {
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.category_name || id
  const getSubCategoryName = (id: string) => subCategories.find(s => s.id === id)?.sub_category_name || id
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="p-3 text-left">
              <input
                type="checkbox"
                checked={selectedIds.length === products.length && products.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    products.forEach(p => onSelectChange(p.id, true))
                  } else {
                    products.forEach(p => onSelectChange(p.id, false))
                  }
                }}
              />
            </th>
            <th className="p-3 text-left">Code</th>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Category</th>
            <th className="p-3 text-left">Sub Category</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Requestable</th>
            <th className="p-3 text-left">Purchasable</th>
            <th className="p-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b hover:bg-gray-50">
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={(e) => onSelectChange(product.id, e.target.checked)}
                />
              </td>
              <td className="p-3 font-mono text-sm">{product.product_code}</td>
              <td className="p-3">{product.product_name}</td>
              <td className="p-3 text-sm text-gray-600">{getCategoryName(product.category_id)}</td>
              <td className="p-3 text-sm text-gray-600">{getSubCategoryName(product.sub_category_id)}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-sm ${
                  product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  product.status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {product.status}
                </span>
              </td>
              <td className="p-3">
                <input type="checkbox" checked={product.is_requestable} disabled />
              </td>
              <td className="p-3">
                <input type="checkbox" checked={product.is_purchasable} disabled />
              </td>
              <td className="p-3 text-center space-x-2 flex justify-center">
                <button
                  onClick={() => onView(product)}
                  className="p-1 hover:bg-blue-100 rounded"
                  title="View"
                >
                  <Eye size={18} className="text-blue-600" />
                </button>
                {!product.is_deleted && (
                  <button
                    onClick={() => onEdit(product)}
                    className="p-1 hover:bg-yellow-100 rounded"
                    title="Edit"
                  >
                    <Edit2 size={18} className="text-yellow-600" />
                  </button>
                )}
                {!product.is_deleted ? (
                  <button
                    onClick={() => onDelete(product.id)}
                    className="p-1 hover:bg-red-100 rounded"
                    title="Delete"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                ) : (
                  <button
                    onClick={() => onRestore(product.id)}
                    className="p-1 hover:bg-green-100 rounded"
                    title="Restore"
                  >
                    <RotateCcw size={18} className="text-green-600" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
