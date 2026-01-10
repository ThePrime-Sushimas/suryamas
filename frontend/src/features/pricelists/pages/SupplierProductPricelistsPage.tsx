/**
 * Supplier Product Pricelists Page
 * Lists pricelists for a specific supplier-product combination
 * 
 * Features:
 * - Context-aware filtering
 * - Pagination
 * - Sorting
 * - Bulk actions
 * - Export functionality
 * 
 * @module pricelists/pages
 */

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { supplierProductsApi } from '@/features/supplier-products'
import { usePricelistsStore } from '../store/pricelists.store'
import { pricelistsApi } from '../api/pricelists.api'
import { PricelistTable } from '../components/PricelistTable'
import { DEFAULT_VALUES } from '../constants/pricelist.constants'
import type { PricelistListQuery, SortField } from '../types/pricelist.types'

interface SupplierProductContext {
  id: string
  supplier_id: string
  product_id: string
  supplier?: { supplier_name: string }
  product?: { product_name: string }
}

/**
 * Main pricelists page for supplier-product context
 * Implements proper ERP domain hierarchy
 */
export const SupplierProductPricelistsPage = memo(function SupplierProductPricelistsPage() {
  const { supplierProductId } = useParams<{ supplierProductId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  // Store = SSOT for domain state
  const pricelists = usePricelistsStore(s => s.pricelists)
  const pagination = usePricelistsStore(s => s.pagination)
  const loading = usePricelistsStore(s => s.loading)
  const errors = usePricelistsStore(s => s.errors)
  const fetchPricelists = usePricelistsStore(s => s.fetchPricelists)
  const deletePricelist = usePricelistsStore(s => s.deletePricelist)
  const approvePricelist = usePricelistsStore(s => s.approvePricelist)
  const restorePricelist = usePricelistsStore(s => s.restorePricelist)
  const clearError = usePricelistsStore(s => s.clearError)
  const reset = usePricelistsStore(s => s.reset)

  // Page = Context resolver only
  const [supplierProduct, setSupplierProduct] = useState<SupplierProductContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [filters, setFilters] = useState<PricelistListQuery>({
    page: DEFAULT_VALUES.PAGE,
    limit: DEFAULT_VALUES.LIMIT,
    sort_by: DEFAULT_VALUES.SORT_BY,
    sort_order: DEFAULT_VALUES.SORT_ORDER
  })

  // Memoized query with context
  const query = useMemo(() => ({
    ...filters,
    supplier_id: supplierProduct?.supplier_id,
    product_id: supplierProduct?.product_id,
    include_deleted: showDeleted
  }), [filters, supplierProduct, showDeleted])

  // Fetch supplier product context
  useEffect(() => {
    const controller = new AbortController()

    const fetchContext = async () => {
      if (!supplierProductId) {
        navigate('/supplier-products')
        return
      }

      try {
        const data = await supplierProductsApi.getById(supplierProductId, true, false, controller.signal)
        
        if (!controller.signal.aborted) {
          setSupplierProduct(data)
          setContextError(null)
        }
      } catch {
        if (!controller.signal.aborted) {
          setContextError('Failed to load supplier product context')
        }
      } finally {
        if (!controller.signal.aborted) {
          setContextLoading(false)
        }
      }
    }

    fetchContext()
    return () => controller.abort()
  }, [supplierProductId, navigate, toast])

  // Fetch pricelists when context or filters change
  useEffect(() => {
    if (!supplierProduct) return

    const controller = new AbortController()
    fetchPricelists(query, controller.signal)
    return () => controller.abort()
  }, [query, supplierProduct, fetchPricelists])

  // Cleanup on unmount
  useEffect(() => {
    return () => reset()
  }, [reset])

  // Store error handling (domain errors only)
  useEffect(() => {
    if (errors.fetch) {
      toast.error(errors.fetch)
      clearError()
    }
    if (errors.mutation) {
      toast.error(errors.mutation)
      clearError()
    }
  }, [errors.fetch, errors.mutation, toast, clearError])

  // Context error handling (routing errors only)
  useEffect(() => {
    if (contextError) {
      toast.error(contextError)
      navigate('/supplier-products')
    }
  }, [contextError, toast, navigate])

  // Event handlers
  const handleSort = useCallback((field: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: field as SortField,
      sort_order: prev.sort_by === field && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  const handleEdit = useCallback((id: string) => {
    navigate(`/supplier-products/${supplierProductId}/pricelists/${id}/edit`)
  }, [navigate, supplierProductId])

  const handleView = useCallback((id: string) => {
    navigate(`/supplier-products/${supplierProductId}/pricelists/${id}`)
  }, [navigate, supplierProductId])

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this pricelist?')) {
      return
    }

    try {
      await deletePricelist(id)
      toast.success('Pricelist deleted successfully')
    } catch {
      // Store handles error display
    }
  }, [deletePricelist, toast])

  const handleRestore = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to restore this pricelist?')) {
      return
    }

    try {
      await restorePricelist(id)
      toast.success('Pricelist restored successfully')
    } catch {
      // Store handles error display
    }
  }, [restorePricelist, toast])

  const handleApprove = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to approve this pricelist?')) {
      return
    }

    try {
      await approvePricelist(id, { status: 'APPROVED' })
      toast.success('Pricelist approved successfully')
      // Store handles refetch automatically
    } catch {
      // Store handles error display
    }
  }, [approvePricelist, toast])

  const handleExport = useCallback(async () => {
    try {
      const blob = await pricelistsApi.exportCSV(query)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pricelists-${supplierProduct?.supplier?.supplier_name}-${supplierProduct?.product?.product_name}-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Export completed')
    } catch {
      toast.error('Export failed')
    }
  }, [query, supplierProduct, toast])

  // Loading state
  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Context not found
  if (!supplierProduct || contextError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{contextError || 'Supplier product not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Context Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-blue-900">Pricelists for:</h2>
            <p className="text-sm text-blue-700 mt-1">
              <span className="font-medium">Supplier:</span> {supplierProduct.supplier?.supplier_name || 'Unknown'}
            </p>
            <p className="text-sm text-blue-700">
              <span className="font-medium">Product:</span> {supplierProduct.product?.product_name || 'Unknown'}
            </p>
          </div>
          <button
            onClick={() => navigate('/supplier-products')}
            className="px-4 py-2 text-sm text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            ← Back to Supplier Products
          </button>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Pricelists</h1>
          <p className="text-gray-500 mt-1">Set pricing per UOM for this supplier-product combination</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Show deleted</span>
          </label>
          <button
            onClick={handleExport}
            disabled={loading.fetch || !pricelists || pricelists.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Export CSV
          </button>
          <button
            onClick={() => navigate(`/supplier-products/${supplierProductId}/pricelists/create`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add New Price
          </button>
        </div>
      </div>

      {/* Table */}
      <PricelistTable
        data={pricelists || []}
        loading={loading.fetch}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onView={handleView}
        onApprove={handleApprove}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={handleSort}
        showDeleted={showDeleted}
      />

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-sm px-4 py-3">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * (filters.limit || 10)) + 1} to {Math.min(pagination.page * (filters.limit || 10), pagination.total)} of {pagination.total} pricelists
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Previous
            </button>
            <span className="px-4 py-2 border rounded-md bg-gray-50">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay for mutations */}
      {(loading.create || loading.update || loading.delete || loading.approve) && (
        <div className="fixed inset-0 bg-gray-900/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing...</p>
          </div>
        </div>
      )}
    </div>
  )
})