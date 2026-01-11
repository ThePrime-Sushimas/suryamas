/**
 * Pricelist Detail Page
 * View pricelist details with actions
 * 
 * @module pricelists/pages
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { usePricelistsStore } from '../store/pricelists.store'
import { pricelistsApi } from '../api/pricelists.api'
import { formatPrice, formatDate, formatDateTime, formatStatus, getValidityStatus } from '../utils/format'
import { getStatusColor, isEditable, isApprovable } from '../constants/pricelist.constants'
import type { PricelistWithRelations } from '../types/pricelist.types'
import { CardSkeleton } from '@/components/ui/Skeleton'

export function PricelistDetailPage() {
  const { supplierProductId, pricelistId } = useParams<{ 
    supplierProductId: string
    pricelistId: string 
  }>()
  const navigate = useNavigate()
  const toast = useToast()

  const deletePricelist = usePricelistsStore(s => s.deletePricelist)
  const approvePricelist = usePricelistsStore(s => s.approvePricelist)
  const loading = usePricelistsStore(s => s.loading)
  
  const [pricelist, setPricelist] = useState<PricelistWithRelations | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchPricelist = async () => {
      if (!pricelistId) {
        setError('Invalid pricelist ID')
        return
      }

      try {
        const data = await pricelistsApi.getById(pricelistId, controller.signal)
        
        if (!controller.signal.aborted) {
          setPricelist(data)
          setError(null)
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('Failed to load pricelist')
        }
      } finally {
        if (!controller.signal.aborted) {
          setPageLoading(false)
        }
      }
    }

    fetchPricelist()
    return () => controller.abort()
  }, [pricelistId])

  const handleEdit = useCallback(() => {
    navigate(`/supplier-products/${supplierProductId}/pricelists/${pricelistId}/edit`)
  }, [navigate, supplierProductId, pricelistId])

  const handleDelete = useCallback(async () => {
    if (!pricelistId || !window.confirm('Are you sure you want to delete this pricelist?')) {
      return
    }

    try {
      await deletePricelist(pricelistId)
      toast.success('Pricelist deleted successfully')
      navigate(`/supplier-products/${supplierProductId}/pricelists`)
    } catch {
      // Error handled in store
    }
  }, [deletePricelist, pricelistId, toast, navigate, supplierProductId])

  const handleApprove = useCallback(async () => {
    if (!pricelistId || !window.confirm('Are you sure you want to approve this pricelist?')) {
      return
    }

    try {
      const updated = await approvePricelist(pricelistId, { status: 'APPROVED' })
      setPricelist(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Pricelist approved successfully')
    } catch {
      // Error handled in store
    }
  }, [approvePricelist, pricelistId, toast])

  const handleReject = useCallback(async () => {
    if (!pricelistId || !window.confirm('Are you sure you want to reject this pricelist?')) {
      return
    }

    try {
      const updated = await approvePricelist(pricelistId, { status: 'REJECTED' })
      setPricelist(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Pricelist rejected')
    } catch {
      // Error handled in store
    }
  }, [approvePricelist, pricelistId, toast])

  if (pageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  if (error || !pricelist) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error || 'Pricelist not found'}</p>
          <button
            onClick={() => navigate(`/supplier-products/${supplierProductId}/pricelists`)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back to List
          </button>
        </div>
      </div>
    )
  }

  const validityStatus = getValidityStatus(pricelist.valid_from, pricelist.valid_to)
  const statusColor = getStatusColor(pricelist.status)
  const canEdit = isEditable(pricelist.status)
  const canApprove = isApprovable(pricelist.status)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricelist Details</h1>
          <p className="text-gray-500 mt-1">
            {pricelist.supplier_name} - {pricelist.product_name}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={handleEdit}
              disabled={loading.update || loading.delete || loading.approve}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Edit
            </button>
          )}
          {canApprove && (
            <>
              <button
                onClick={handleApprove}
                disabled={loading.approve}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={loading.approve}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={loading.delete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => navigate(`/supplier-products/${supplierProductId}/pricelists`)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Back to List
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Pricelist Information</h3>
        </div>
        <div className="px-6 py-4 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <p className="mt-1 text-sm text-gray-900">{pricelist.supplier_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Product</label>
              <p className="mt-1 text-sm text-gray-900">{pricelist.product_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">UOM</label>
              <p className="mt-1 text-sm text-gray-900">{pricelist.uom_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatPrice(pricelist.price, pricelist.currency)}
              </p>
            </div>
          </div>

          {/* Status & Validity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${statusColor}-100 text-${statusColor}-800`}>
                {formatStatus(pricelist.status)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Validity</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${validityStatus.color}-100 text-${validityStatus.color}-800`}>
                {validityStatus.label}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Active</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                pricelist.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {pricelist.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Valid From</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(pricelist.valid_from)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Valid To</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(pricelist.valid_to)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDateTime(pricelist.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Updated At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDateTime(pricelist.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {(loading.update || loading.delete || loading.approve) && (
        <div className="fixed inset-0 bg-gray-900/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing...</p>
          </div>
        </div>
      )}
    </div>
  )
}
