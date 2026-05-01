// Supplier Product Detail Page

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { supplierProductsApi } from '../api/supplierProducts.api'
import { useSupplierProductsStore } from '../store/supplierProducts.store'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ArrowLeft } from 'lucide-react'
import { formatPrice, formatLeadTime, formatDate, getStatusColor, getPreferredColor } from '../utils/format'
import type { SupplierProductWithRelations } from '../types/supplier-product.types'

export function SupplierProductDetailPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const includeDeleted = searchParams.get('deleted') === 'true'
  const { deleteSupplierProduct, mutationLoading } = useSupplierProductsStore()

  const [supplierProduct, setSupplierProduct] = useState<SupplierProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Load supplier product data
  useEffect(() => {
    const controller = new AbortController()

    const loadData = async () => {
      if (!id) {
        setLoadError('Invalid supplier product ID')
        setLoading(false)
        return
      }

      try {
        const data = await supplierProductsApi.getById(id, true, includeDeleted, controller.signal)
        setSupplierProduct(data)
      } catch (err) {
        if (err instanceof Error && err.name === 'CanceledError') return
        setLoadError('Failed to load supplier product')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    return () => controller.abort()
  }, [id, includeDeleted])

  const handleDeleteClick = () => {
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!id || !supplierProduct) return
    try {
      await deleteSupplierProduct(id)
      toast.success('Produk supplier berhasil dihapus')
      navigate('/supplier-products')
    } catch {
      // Error handled in store
    } finally {
      setDeleteModalOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !supplierProduct) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <button
            onClick={() => navigate('/supplier-products')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium mb-4 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Gagal Memuat Data</h2>
            <p className="text-red-600 dark:text-red-400">{loadError || 'Produk supplier tidak ditemukan'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/supplier-products')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium mb-4 flex items-center"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Produk Supplier</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Lihat informasi produk supplier</p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Header Info */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {supplierProduct.supplier?.supplier_name || '-'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {supplierProduct.product?.product_name || '-'}
                </p>
              </div>
              <div className="flex gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPreferredColor(supplierProduct.is_preferred)}`}>
                  {supplierProduct.is_preferred ? '★ Supplier Utama' : 'Standar'}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(supplierProduct.is_active)}`}>
                  {supplierProduct.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pricing */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Harga</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Harga</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPrice(supplierProduct.price, supplierProduct.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Mata Uang</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{supplierProduct.currency}</dd>
                  </div>
                </dl>
              </div>

              {/* Order Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detail Pesanan</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Waktu Kirim</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatLeadTime(supplierProduct.lead_time_days)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Min. Pesanan</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {supplierProduct.min_order_qty
                        ? supplierProduct.min_order_qty.toLocaleString('id-ID')
                        : 'Tidak ada minimum'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Related Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Terkait</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Kode Supplier</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {supplierProduct.supplier?.supplier_code || '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Status Supplier</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {supplierProduct.supplier?.is_active ? 'Aktif' : 'Nonaktif'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Produk</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Kode Produk</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {supplierProduct.product?.product_code || '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Tipe Produk</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {supplierProduct.product?.product_type || '-'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Audit Info */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Audit</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Dibuat</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{formatDate(supplierProduct.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Diperbarui</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{formatDate(supplierProduct.updated_at)}</dd>
                </div>
                {supplierProduct.deleted_at && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Dihapus</dt>
                    <dd className="font-medium text-red-600 dark:text-red-400">{formatDate(supplierProduct.deleted_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
            <button
              onClick={() => navigate('/supplier-products')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Kembali
            </button>
            <button
              onClick={() => navigate(`/supplier-products/${id}/edit`)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={mutationLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {mutationLoading ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Hapus Produk Supplier"
          message="Yakin ingin menghapus produk supplier ini? Tindakan ini tidak dapat dibatalkan."
          confirmText="Hapus"
          variant="danger"
          isLoading={mutationLoading}
        />
      </div>
    </div>
  )
}

