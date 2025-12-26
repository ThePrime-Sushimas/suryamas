import type { Product, ProductStatus } from '../types'

const statusColors: Record<ProductStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  DISCONTINUED: 'bg-red-100 text-red-800'
}

interface ProductTableProps {
  products: Product[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const ProductTable = ({ products, onView, onEdit, onDelete }: ProductTableProps) => {
  if (products.length === 0) {
    return <div className="text-center py-8 text-gray-500">No products found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Code</th>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">BOM Name</th>
            <th className="border px-4 py-2 text-left">Status</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{product.product_code}</td>
              <td className="border px-4 py-2 font-semibold text-blue-900 hover:text-red-600 cursor-pointer" onClick={() => onView(product.id)}>
                {product.product_name}
              </td>
              <td className="border px-4 py-2">{product.bom_name || '-'}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[product.status]}`}>
                  {product.status}
                </span>
              </td>
              <td className="border px-4 py-2 space-x-2">
                <button onClick={() => onEdit(product.id)} className="text-green-600 hover:underline text-sm">Edit</button>
                <button onClick={() => onDelete(product.id)} className="text-red-600 hover:underline text-sm">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
