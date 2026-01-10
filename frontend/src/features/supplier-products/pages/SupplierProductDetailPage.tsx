// Supplier Product Detail Page

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { supplierProductsApi } from '../api/supplierProducts.api'
import { useSupplierProductsStore } from '../store/supplierProducts.store'
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

  const handleDelete = async () => {
    if (!id || !supplierProduct) return

    if (window.confirm('Are you sure you want to delete this supplier product?')) {
      try {
        await deleteSupplierProduct(id)
        toast.success('Supplier product deleted successfully')
        navigate('/supplier-products')
      } catch {
        // Error handled in store
      }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
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
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 flex items-center justify-center"
          >
            ← Back to Supplier Products
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600">{loadError || 'Supplier product not found'}</p>
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
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 flex items-center"
          >
            ← Back to Supplier Products
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Product Details</h1>
          <p className="text-gray-500 mt-1">View supplier product information</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header Info */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {supplierProduct.supplier?.supplier_name || '-'}
                </h2>
                <p className="text-sm text-gray-500">
                  {supplierProduct.product?.product_name || '-'}
                </p>
              </div>
              <div className="flex gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPreferredColor(supplierProduct.is_preferred)}`}>
                  {supplierProduct.is_preferred ? '★ Preferred Supplier' : 'Standard'}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(supplierProduct.is_active)}`}>
                  {supplierProduct.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pricing */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Price</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {formatPrice(supplierProduct.price, supplierProduct.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Currency</dt>
                    <dd className="text-sm font-medium text-gray-900">{supplierProduct.currency}</dd>
                  </div>
                </dl>
              </div>

              {/* Order Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Details</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Lead Time</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {formatLeadTime(supplierProduct.lead_time_days)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Min Order Qty</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {supplierProduct.min_order_qty
                        ? supplierProduct.min_order_qty.toLocaleString('id-ID')
                        : 'No minimum'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Related Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Related Information</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Supplier Code</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {supplierProduct.supplier?.supplier_code || '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Supplier Status</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {supplierProduct.supplier?.is_active ? 'Active' : 'Inactive'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Product Information</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Product Code</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {supplierProduct.product?.product_code || '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Product Type</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {supplierProduct.product?.product_type || '-'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Audit Info */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Audit Information</h3>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="font-medium text-gray-900">{formatDate(supplierProduct.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="font-medium text-gray-900">{formatDate(supplierProduct.updated_at)}</dd>
                </div>
                {supplierProduct.deleted_at && (
                  <div>
                    <dt className="text-gray-500">Deleted</dt>
                    <dd className="font-medium text-red-600">{formatDate(supplierProduct.deleted_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => navigate('/supplier-products')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => navigate(`/supplier-products/${id}/edit`)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={mutationLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {mutationLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

