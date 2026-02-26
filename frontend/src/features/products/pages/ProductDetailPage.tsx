import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useProductsStore } from '../store/products.store'
import { useToast } from '@/contexts/ToastContext'
import { Package, ArrowLeft, Edit2, Trash2, Building2, Ruler, Plus } from 'lucide-react'
import { ProductUomTable } from '@/features/product-uoms/components/ProductUomTable'
import { ProductUomForm } from '@/features/product-uoms/components/ProductUomForm'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '@/features/product-uoms/types'
import api from '@/lib/axios'
import { CardSkeleton } from '@/components/ui/Skeleton'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProduct, fetchProductById, deleteProduct, fetchLoading, mutationLoading, error: storeError, clearError } = useProductsStore()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'uoms'>('details')
  const [uoms, setUoms] = useState<ProductUom[]>([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [uomsLoading, setUomsLoading] = useState(false)
  const [showUomForm, setShowUomForm] = useState(false)
  const [editingUom, setEditingUom] = useState<ProductUom | undefined>(undefined)
  const { success, error: showError } = useToast()

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('Invalid product ID')
        return
      }

      try {
        await fetchProductById(id)
      } catch {
        setError('Product not found')
      }
    }
    fetchProduct()
  }, [id, fetchProductById])

  const fetchUoms = async () => {
    if (!id) return
    setUomsLoading(true)
    try {
      const response = await api.get<{ success: boolean; data: ProductUom[] }>(`/products/${id}/uoms`, {
        params: { includeDeleted: showDeleted }
      })
      const sortedUoms = (response.data.data || []).sort((a, b) => {
        if (a.is_base_unit) return -1
        if (b.is_base_unit) return 1
        return a.conversion_factor - b.conversion_factor
      })
      setUoms(sortedUoms)
    } catch (err) {
      console.error('Failed to fetch UOMs:', err)
      showError('Failed to load UOMs')
    } finally {
      setUomsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'uoms' && id) {
      fetchUoms()
      setShowUomForm(false)
      setEditingUom(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, showDeleted])

  const handleEditUom = (uom: ProductUom) => {
    setEditingUom(uom)
    setShowUomForm(true)
  }

  const handleAddUom = () => {
    setEditingUom(undefined)
    setShowUomForm(true)
  }

  const handleSubmitUom = async (data: CreateProductUomDto | UpdateProductUomDto) => {
    try {
      if (editingUom) {
        await api.put(`/products/${id}/uoms/${editingUom.id}`, data)
        success('UOM updated successfully')
      } else {
        await api.post(`/products/${id}/uoms`, data)
        success('UOM created successfully')
      }
      setShowUomForm(false)
      setEditingUom(undefined)
      fetchUoms()
    } catch {
      showError('Failed to save UOM')
    }
  }

  const handleDeleteUom = async (uomId: string) => {
    if (!confirm('Are you sure you want to delete this UOM?')) return
    try {
      await api.delete(`/products/${id}/uoms/${uomId}`)
      success('UOM deleted successfully')
      fetchUoms()
    } catch {
      showError('Failed to delete UOM')
    }
  }

  const handleRestoreUom = async (uomId: string) => {
    try {
      await api.post(`/products/${id}/uoms/${uomId}/restore`)
      success('UOM restored successfully')
      fetchUoms()
    } catch {
      showError('Failed to restore UOM')
    }
  }

  useEffect(() => {
    if (storeError) {
      showError(storeError)
      clearError()
    }
  }, [storeError, showError, clearError])

  const handleDelete = async () => {
    if (!id || !currentProduct) return
    
    if (confirm(`Are you sure you want to delete "${currentProduct.product_name}"?`)) {
      try {
        await deleteProduct(id)
        success('Product deleted successfully')
        navigate('/products')
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to delete product')
      }
    }
  }

  if (fetchLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <CardSkeleton />
            <p className="text-gray-500 dark:text-gray-400">Loading product...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !currentProduct) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
          <div className="text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Product not found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error || 'The product you are looking for does not exist.'}</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Back to Products
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Products
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{currentProduct.product_name}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Product Code: {currentProduct.product_code}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/products/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={mutationLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
            >
              <Trash2 className="w-4 h-4" />
              {mutationLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-6 py-4 text-lg font-medium transition-all duration-200 ${
              activeTab === 'details'
                ? 'bg-linear-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-400 border-b-4 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 className="h-5 w-5" />
              Product Details
            </div>
          </button>
          <button
            onClick={() => setActiveTab('uoms')}
            className={`flex-1 px-6 py-4 text-lg font-medium transition-all duration-200 ${
              activeTab === 'uoms'
                ? 'bg-linear-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-400 border-b-4 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Ruler className="h-5 w-5" />
              Unit Of Measures
              <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs px-2 py-1 rounded-full">
                {uoms.length}
              </span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'details' ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Product Type</label>
                      <p className="text-gray-900 dark:text-gray-200 capitalize">{currentProduct.product_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
                      <div className="mt-1">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          currentProduct.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          currentProduct.status === 'INACTIVE' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' :
                          'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {currentProduct.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Cost</label>
                      <p className="text-gray-900 dark:text-gray-200">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0
                        }).format(currentProduct.average_cost)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Flags */}
                <div className="bg-white dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Flags</h2>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={currentProduct.is_requestable}
                        disabled
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      />
                      <label className="ml-2 text-gray-700 dark:text-gray-300">Requestable</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={currentProduct.is_purchasable}
                        disabled
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      />
                      <label className="ml-2 text-gray-700 dark:text-gray-300">Purchasable</label>
                    </div>
                  </div>
                </div>

                {/* BOM Name */}
                {currentProduct.bom_name && (
                  <div className="bg-white dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">BOM Information</h2>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">BOM Name</label>
                      <p className="text-gray-900 dark:text-gray-200">{currentProduct.bom_name}</p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {currentProduct.notes && (
                  <div className="bg-white dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h2>
                    <p className="text-gray-700 dark:text-gray-300">{currentProduct.notes}</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="mt-6 bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Metadata</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="text-gray-600 dark:text-gray-400">Created</label>
                    <p className="text-gray-900 dark:text-gray-200">{new Date(currentProduct.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-gray-600 dark:text-gray-400">Updated</label>
                    <p className="text-gray-900 dark:text-gray-200">{new Date(currentProduct.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {showUomForm ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingUom ? 'Edit UOM' : 'Add New UOM'}
                    </h3>
                  </div>
                  <ProductUomForm
                    uom={editingUom}
                    existingUoms={uoms}
                    onSubmit={handleSubmitUom}
                    onCancel={() => {
                      setShowUomForm(false)
                      setEditingUom(undefined)
                    }}
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Units of Measure</h3>
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input
                          type="checkbox"
                          checked={showDeleted}
                          onChange={(e) => setShowDeleted(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                        Show Deleted
                      </label>
                    </div>
                    <button
                      onClick={handleAddUom}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add UOM
                    </button>
                  </div>
                  <ProductUomTable
                    uoms={uoms}
                    onEdit={handleEditUom}
                    onDelete={handleDeleteUom}
                    onRestore={handleRestoreUom}
                    loading={uomsLoading}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
