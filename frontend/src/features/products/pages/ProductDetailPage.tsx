import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useProductsStore } from '../store/products.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Package, ArrowLeft, Edit2, Trash2, Building2, Ruler, Plus } from 'lucide-react'
import { ProductUomTable } from '@/features/product-uoms/components/ProductUomTable'
import { ProductUomForm } from '@/features/product-uoms/components/ProductUomForm'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '@/features/product-uoms/types'
import api from '@/lib/axios'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

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
  const [uomToDelete, setUomToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleteProductModalOpen, setIsDeleteProductModalOpen] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('ID produk tidak valid')
        return
      }

      try {
        await fetchProductById(id)
      } catch {
        setError('Produk tidak ditemukan')
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
      showError('Gagal memuat UOM')
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
        success('UOM berhasil diperbarui')
      } else {
        await api.post(`/products/${id}/uoms`, data)
        success('UOM berhasil dibuat')
      }
      setShowUomForm(false)
      setEditingUom(undefined)
      fetchUoms()
    } catch {
      showError('Gagal menyimpan UOM')
    }
  }

  const handleDeleteUom = (uom: ProductUom) => {
    setUomToDelete({ id: uom.id, name: uom.metric_units?.unit_name || 'UOM ini' })
  }

  const handleConfirmDeleteUom = async () => {
    if (!uomToDelete) return
    try {
      await api.delete(`/products/${id}/uoms/${uomToDelete.id}`)
      success('UOM berhasil dihapus')
      fetchUoms()
    } catch {
      showError('Gagal menghapus UOM')
    } finally {
      setUomToDelete(null)
    }
  }

  const handleCloseUomDeleteModal = () => {
    setUomToDelete(null)
  }

  const handleRestoreUom = async (uomId: string) => {
    try {
      await api.post(`/products/${id}/uoms/${uomId}/restore`)
      success('UOM berhasil dipulihkan')
      fetchUoms()
    } catch {
      showError('Gagal memulihkan UOM')
    }
  }

  useEffect(() => {
    if (storeError) {
      showError(storeError)
      clearError()
    }
  }, [storeError, showError, clearError])

  const handleDelete = () => {
    if (!id || !currentProduct) return
    setIsDeleteProductModalOpen(true)
  }

  const handleConfirmDeleteProduct = async () => {
    if (!id) return
    try {
      await deleteProduct(id)
      success('Produk berhasil dihapus')
      navigate('/products')
    } catch (err) {
      showError(parseApiError(err, 'Gagal menghapus produk'))
    } finally {
      setIsDeleteProductModalOpen(false)
    }
  }

  const handleCloseDeleteProductModal = () => {
    setIsDeleteProductModalOpen(false)
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Produk tidak ditemukan</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error || 'Produk yang Anda cari tidak ada.'}</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Kembali ke Produk
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
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300 mb-4"
        >
          <ArrowLeft size={20} />
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
              Detail Produk
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
              Satuan Ukur
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
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informasi Dasar</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tipe Produk</label>
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
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Biaya Rata-rata</label>
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
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Penanda</h2>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={currentProduct.is_requestable}
                        disabled
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      />
                      <label className="ml-2 text-gray-700 dark:text-gray-300">Dapat Diminta</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={currentProduct.is_purchasable}
                        disabled
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      />
                      <label className="ml-2 text-gray-700 dark:text-gray-300">Dapat Dibeli</label>
                    </div>
                  </div>
                </div>

                {/* BOM Name */}
                {currentProduct.bom_name && (
                  <div className="bg-white dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informasi BOM</h2>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nama BOM</label>
                      <p className="text-gray-900 dark:text-gray-200">{currentProduct.bom_name}</p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {currentProduct.notes && (
                  <div className="bg-white dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Catatan</h2>
                    <p className="text-gray-700 dark:text-gray-300">{currentProduct.notes}</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="mt-6 bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Metadata</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="text-gray-600 dark:text-gray-400">Dibuat</label>
                    <p className="text-gray-900 dark:text-gray-200">{new Date(currentProduct.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-gray-600 dark:text-gray-400">Diperbarui</label>
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
                      {editingUom ? 'Edit UOM' : 'Tambah UOM Baru'}
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
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Satuan Ukur</h3>
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input
                          type="checkbox"
                          checked={showDeleted}
                          onChange={(e) => setShowDeleted(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                        Tampilkan Terhapus
                      </label>
                    </div>
                    <button
                      onClick={handleAddUom}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah UOM
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

      {/* Delete Product Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteProductModalOpen}
        onClose={handleCloseDeleteProductModal}
        onConfirm={handleConfirmDeleteProduct}
        title="Hapus Produk"
        message={`Yakin ingin menghapus "${currentProduct.product_name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={mutationLoading}
      />

      {/* Delete UOM Confirmation Modal */}
      <ConfirmModal
        isOpen={!!uomToDelete}
        onClose={handleCloseUomDeleteModal}
        onConfirm={handleConfirmDeleteUom}
        title="Hapus UOM"
        message={`Yakin ingin menghapus UOM "${uomToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  )
}
