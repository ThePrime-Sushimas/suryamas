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
import { formatPrice, formatDate, formatStatus, getValidityStatus, getStatusColorClass, getValidityColorClass } from '../utils/format'
import { isEditable, isApprovable } from '../constants/pricelist.constants'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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
  
  // Confirm modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)

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

  const handleDeleteClick = () => {
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = useCallback(async () => {
    if (!id) return

    try {
      await deletePricelist(id)
      toast.success('Pricelist deleted successfully')
      navigate('/pricelists')
    } catch {
      // Error handled in store
    } finally {
      setDeleteModalOpen(false)
    }
  }, [deletePricelist, id, toast, navigate])

  const handleApproveClick = () => {
    setApproveModalOpen(true)
  }

  const handleApproveConfirm = useCallback(async () => {
    if (!id) return

    try {
      const updated = await approvePricelist(id, { status: 'APPROVED' })
      setPricelist(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Pricelist approved successfully')
    } catch {
      // Error handled in store
    } finally {
      setApproveModalOpen(false)
    }
  }, [approvePricelist, id, toast])

  const handleRejectClick = () => {
    setRejectModalOpen(true)
  }

  const handleRejectConfirm = useCallback(async () => {
    if (!id) return

    try {
      const updated = await approvePricelist(id, { status: 'REJECTED' })
      setPricelist(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Pricelist rejected')
    } catch {
      // Error handled in store
    } finally {
      setRejectModalOpen(false)
    }
  }, [approvePricelist, id, toast])

  const handleRestoreClick = () => {
    setRestoreModalOpen(true)
  }

  const handleRestoreConfirm = useCallback(async () => {
    if (!id) return

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
    } finally {
      setRestoreModalOpen(false)
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
        <div className="max-w-md mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Error</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Pricelist not found'}</p>
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
  const statusColorClass = getStatusColorClass(pricelist.status)
  const validityColorClass = getValidityColorClass(validityStatus.color)
  const canEdit = isEditable(pricelist.status)
  const canApprove = isApprovable(pricelist.status)
  const canRestore = !!pricelist.deleted_at

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pricelist Details</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
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
                onClick={handleApproveClick}
                disabled={loading.approve}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={handleRejectClick}
                disabled={loading.approve}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {canRestore ? (
            <button
              onClick={handleRestoreClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={handleDeleteClick}
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Pricelist Information</h3>
        </div>
        <div className="px-6 py-4 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{pricelist.supplier_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{pricelist.product_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">UOM</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{pricelist.uom_name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {formatPrice(pricelist.price, pricelist.currency)}
              </p>
            </div>
          </div>

          {/* Status & Validity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColorClass}`}>
                {formatStatus(pricelist.status)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Validity</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${validityColorClass}`}>
                {validityStatus.label}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                pricelist.is_active 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              }`}>
                {pricelist.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valid From</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(pricelist.valid_from)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valid To</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(pricelist.valid_to) || 'No expiry'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Created At</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(pricelist.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Updated At</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(pricelist.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Pricelist"
        message="Are you sure you want to delete this pricelist? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={loading.delete}
      />

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Pricelist"
        message="Are you sure you want to approve this pricelist?"
        confirmText="Approve"
        variant="success"
        isLoading={loading.approve}
      />

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleRejectConfirm}
        title="Reject Pricelist"
        message="Are you sure you want to reject this pricelist?"
        confirmText="Reject"
        variant="warning"
        isLoading={loading.approve}
      />

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        onConfirm={handleRestoreConfirm}
        title="Restore Pricelist"
        message="Are you sure you want to restore this pricelist?"
        confirmText="Restore"
        variant="success"
      />
    </div>
  )
}

