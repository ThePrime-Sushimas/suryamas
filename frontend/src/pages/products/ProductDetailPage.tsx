import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../../lib/axios'
import { productService } from '../../services/productService'
import type { Product, ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../../types/product'
import { UomTable } from '../../components/products/UomTable'
import { UomForm } from '../../components/products/UomForm'
import { Plus, ArrowLeft, X } from 'lucide-react'

export const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uoms, setUoms] = useState<ProductUom[]>([])
  const [loading, setLoading] = useState(false)
  const [showUomForm, setShowUomForm] = useState(false)
  const [editingUom, setEditingUom] = useState<ProductUom | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await productService.getById(id!)
      setProduct(response.data.data)
    } catch (error: any) {
      if (error.response?.status === 410) {
        try {
          const response = await axios.get(`/products/${id}?includeDeleted=true`)
          setProduct(response.data.data)
        } catch (err) {
          setError('Product not found')
        }
      } else {
        setError('Product not found')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadUoms = useCallback(async () => {
    try {
      const response = await productService.getUoms(id!, showDeleted)
      setUoms(response.data.data)
    } catch (error) {
      console.error('Failed to load UOMs:', error)
    }
  }, [id, showDeleted])

  useEffect(() => {
    if (id) loadProduct()
  }, [id])

  useEffect(() => {
    if (product && id) loadUoms()
  }, [product, id, loadUoms])

  const handleDeleteUom = async (uomId: string) => {
    if (!confirm('Delete this UOM?')) return
    try {
      await productService.deleteUom(id!, uomId)
      loadUoms()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleEditUom = (uom: ProductUom) => {
    setEditingUom(uom)
    setShowUomForm(true)
  }

  const handleRestoreUom = async (uomId: string) => {
    if (!confirm('Restore this UOM?')) return
    try {
      await productService.restoreUom(id!, uomId)
      loadUoms()
    } catch (error) {
      console.error('Restore failed:', error)
    }
  }

  const handleUpdateDefault = async (uomId: string, field: string, value: boolean) => {
    try {
      await productService.updateUom(id!, uomId, { [field]: value })
      loadUoms()
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  const handleRestoreProduct = useCallback(async () => {
    if (!confirm('Restore this product?')) return
    try {
      await productService.restoreProduct(id!)
      loadProduct()
    } catch (error) {
      console.error('Restore failed:', error)
      alert('Failed to restore product')
    }
  }, [id, loadProduct])

  const handleCreateUom = async (data: CreateProductUomDto | UpdateProductUomDto) => {
    try {
      if (editingUom) {
        await productService.updateUom(id!, editingUom.id, data)
      } else {
        await productService.createUom(id!, data)
      }
      setShowUomForm(false)
      setEditingUom(null)
      loadUoms()
    } catch (error) {
      console.error('Operation failed:', error)
      alert('Failed to save UOM')
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!product) return <div className="p-6">Product not found</div>


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/products')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold">{product.product_name}</h1>
        </div>
        <div className="flex gap-2">
          {product.is_deleted && (
            <button
              onClick={handleRestoreProduct}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Restore
            </button>
          )}
          <button
            onClick={() => navigate(`/products/${id}/edit`)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Edit Product
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Code</label>
            <p className="font-mono text-gray-900">{product.product_code}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <p className={`px-3 py-1 rounded w-fit text-sm font-medium ${
              product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              product.status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {product.status}
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={product.is_requestable} disabled />
              <span className="text-sm">Requestable</span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={product.is_purchasable} disabled />
              <span className="text-sm">Purchasable</span>
            </label>
          </div>
        </div>

        {product.notes && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <p className="text-gray-900">{product.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded shadow space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">Product Detail</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded"
              />
              <span>Show Deleted</span>
            </label>
          </div>
          <button
            onClick={() => {
              setEditingUom(null)
              setShowUomForm(!showUomForm)
            }}
            className="bg-teal-600 text-white px-3 py-2 rounded flex items-center gap-2 hover:bg-teal-700"
          >
            <Plus size={18} /> Add Unit
          </button>
        </div>

        {showUomForm && (
          <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{editingUom ? 'Edit UOM' : 'Create New UOM'}</h3>
              <button
                onClick={() => {
                  setShowUomForm(false)
                  setEditingUom(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <UomForm
              uom={editingUom || undefined}
              onSubmit={handleCreateUom}
              hasBaseUnit={uoms.some(u => u.is_base_unit && u.id !== editingUom?.id)}
            />
          </div>
        )}

        {uoms.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No UOMs defined</p>
        ) : (
          <UomTable
            uoms={uoms}
            onDelete={handleDeleteUom}
            onEdit={handleEditUom}
            onRestore={handleRestoreUom}
            onUpdateDefault={handleUpdateDefault}
          />
        )}
      </div>
    </div>
  )
}
