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
import { formatPrice, formatDate, formatStatus, getValidityStatus } from '../utils/format'
import { getStatusColor, isEditable, isApprovable } from '../constants/pricelist.constants'
import type { PricelistWithRelations } from '../types/pricelist.types'
import { CardSkeleton } from '@/components/ui/Skeleton'

export function PricelistDetailPage() {
  const { id } = useParams<{ id: string }>()
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
      if (!id) {
        setError('Invalid pricelist ID')
        return
      }

      try {
        const data = await pricelistsApi.getById(id, controller.signal)
        
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
  }, [id])

  const handleEdit = useCallback(() => {
    navigate(`/pricelists/${id}/edit`)
  }, [navigate, id])

  const handleDelete = useCallback(async () => {
    if (!id || !window.confirm('Are you sure you want to delete this pricelist?')) {
      return
    }

    try {
      await deletePricelist(id)
      toast.success('Pricelist deleted successfully')
      navigate('/pricelists')
    } catch {
      // Error handled in store
    }
  }, [deletePricelist, id, toast, navigate])

  const handleApprove = useCallback(async () => {
    if (!id || !window.confirm('Are you sure you want to approve this pricelist?')) {
      return
    }

    try {
      const updated = await approvePricelist(id, { status: 'APPROVED' })
      setPricelist(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Pricelist approved successfully')
    } catch {
      // Error handled in store
    }
  }, [approvePricelist, id, toast])

  const handleReject = useCallback(async () => {
    if (!id || !window.confirm('Are you sure you want to reject this pricelist?')) {
      return
    }

    try {
      const updated = await approvePricelist(id, { status: 'REJECTED' })
      setPricelist(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Pricelist rejected')
    } catch {
      // Error handled in store
    }
  }, [approvePricelist, id, toast])

  const handleRestore = useCallback(async () => {
    if (!id || !window.confirm('Are you sure you want to restore this pricelist?')) {
      return
    }

    try {
      await pricelistsApi.restore(id)
      const data = await pricelistsApi.getById(id)
      setPricelist(data)
      toast.success('Pricelist restored successfully')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { status?: number } }
        if (apiError.response?.status === 409) {
          toast.error('Cannot restore: Another active pricelist exists for this supplier-product-UOM combination')
        } else {
          toast.error('Failed to restore pricelist')
        }
      } else {
        toast.error('Failed to restore pricelist')
      }
    }
  }, [id, toast])

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
            onClick={() => navigate('/pricelists')}
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
  const canRestore = !!pricelist.deleted_at

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
          {canRestore ? (
            <button
              onClick={handleRestore}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={loading.delete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => navigate('/pricelists')}
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
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                statusColor === 'green' ? 'bg-green-100 text-green-800' :
                statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                statusColor === 'red' ? 'bg-red-100 text-red-800' :
                statusColor === 'blue' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {formatStatus(pricelist.status)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Validity</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                validityStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                validityStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                validityStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                validityStatus.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
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
              <p className="mt-1 text-sm text-gray-900">{formatDate(pricelist.valid_to) || 'No expiry'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(pricelist.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Updated At</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(pricelist.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}