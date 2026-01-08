import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProductUomsStore } from '../store/productUoms.store'
import { ProductUomTable } from '../components/ProductUomTable'
import { ProductUomForm } from '../components/ProductUomForm'
import { useToast } from '@/contexts/ToastContext'
import { Package, Plus, ArrowLeft, X } from 'lucide-react'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../types'
import api from '@/lib/axios'

export default function ProductUomsPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { uoms, loading, fetchUoms, createUom, updateUom, deleteUom } = useProductUomsStore()
  const { success, error } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [editingUom, setEditingUom] = useState<ProductUom | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    if (productId) {
      fetchUoms(productId, showDeleted)
    }
  }, [productId, showDeleted, fetchUoms])

  const handleCreate = async (data: CreateProductUomDto | UpdateProductUomDto) => {
    if (!productId || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createUom(productId, data as CreateProductUomDto)
      success('UOM created successfully')
      setShowForm(false)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create UOM')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (data: CreateProductUomDto | UpdateProductUomDto) => {
    if (!productId || !editingUom || isSubmitting) return

    setIsSubmitting(true)
    try {
      await updateUom(productId, editingUom.id, data as UpdateProductUomDto)
      success('UOM updated successfully')
      setEditingUom(undefined)
      setShowForm(false)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to update UOM')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (uomId: string) => {
    if (!productId || isSubmitting) return

    if (!confirm('Are you sure you want to delete this UOM?')) return

    setIsSubmitting(true)
    try {
      await deleteUom(productId, uomId)
      success('UOM deleted successfully')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to delete UOM')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestore = async (uomId: string) => {
    if (!productId || isSubmitting) return

    setIsSubmitting(true)
    try {
      await api.post(`/products/${productId}/uoms/${uomId}/restore`)
      success('UOM restored successfully')
      fetchUoms(productId, showDeleted)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to restore UOM')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (uom: ProductUom) => {
    setEditingUom(uom)
    setShowForm(true)
  }

  const handleCancel = () => {
    if (isSubmitting) return
    
    if (showForm) {
      const hasChanges = editingUom !== undefined
      if (hasChanges && !confirm('Discard changes?')) return
    }
    
    setShowForm(false)
    setEditingUom(undefined)
  }

  if (!productId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-500">Product ID is required</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/products')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Product UOMs</h1>
              <p className="text-sm text-gray-500">{uoms.length} units of measure</p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              disabled={isSubmitting || loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add UOM
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {showForm ? (
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUom ? 'Edit UOM' : 'Create New UOM'}
              </h2>
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <ProductUomForm
              uom={editingUom}
              existingUoms={uoms}
              onSubmit={editingUom ? handleUpdate : handleCreate}
              onCancel={handleCancel}
              loading={isSubmitting}
            />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="mb-4 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Show Deleted
              </label>
            </div>
            <ProductUomTable
              uoms={uoms}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRestore={handleRestore}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  )
}
