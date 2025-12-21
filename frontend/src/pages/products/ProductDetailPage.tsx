import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../../lib/axios'
import { productService } from '../../services/productService'
import type { Product, ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../../types/product'
import { UomTable } from '../../components/products/UomTable'
import { UomForm } from '../../components/products/UomForm'
import { ArrowLeft, Loader2, AlertCircle, Plus, X } from 'lucide-react'

export const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uoms, setUoms] = useState<ProductUom[]>([])
  const [loading, setLoading] = useState(true)
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error || 'Product not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const isDeleted = product.is_deleted === true

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">{product.product_name}</h1>
            {isDeleted && <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Deleted</span>}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Code</label>
              <p className="mt-1 text-gray-900 font-mono">{product.product_code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className={`mt-1 px-3 py-1 rounded w-fit text-sm font-medium ${
                product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                product.status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {product.status}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">BOM Name</label>
              <p className="mt-1 text-gray-900">{product.bom_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <p className="mt-1 text-gray-900">{product.category_id}</p>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={product.is_requestable} disabled className="rounded" />
                <span className="text-sm font-medium text-gray-700">Requestable</span>
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={product.is_purchasable} disabled className="rounded" />
                <span className="text-sm font-medium text-gray-700">Purchasable</span>
              </label>
            </div>
          </div>

          {product.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <p className="mt-1 text-gray-900">{product.notes}</p>
            </div>
          )}

          <div className="border-t pt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Product Units</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    className="rounded"
                  />
                  <span>Show Deleted</span>
                </label>
                {!isDeleted && (
                  <button
                    onClick={() => {
                      setEditingUom(null)
                      setShowUomForm(!showUomForm)
                    }}
                    className="bg-teal-600 text-white px-3 py-2 rounded flex items-center gap-2 hover:bg-teal-700"
                  >
                    <Plus size={18} /> Add Unit
                  </button>
                )}
              </div>
            </div>

            {showUomForm && (
              <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">{editingUom ? 'Edit UOM' : 'Create New UOM'}</h3>
                  <button
                    onClick={() => {
                      setShowUomForm(false)
                      setEditingUom(null)
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
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

          <div className="border-t pt-8 flex gap-4">
            {isDeleted ? (
              <button
                onClick={handleRestoreProduct}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                Restore
              </button>
            ) : (
              <button
                onClick={() => navigate(`/products/${id}/edit`)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => navigate('/products')}
              className="bg-gray-300 text-gray-900 px-6 py-2 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
