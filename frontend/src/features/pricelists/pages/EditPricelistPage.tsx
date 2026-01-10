/**
 * Edit Pricelist Page
 * Edit existing pricelist (DRAFT status only)
 * 
 * @module pricelists/pages
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePricelistsStore } from '../store/pricelists.store'
import { pricelistsApi } from '../api/pricelists.api'
import { PricelistFormContextual } from '../components/PricelistFormContextual'
import { isEditable } from '../constants/pricelist.constants'
import type { CreatePricelistDto, UpdatePricelistDto, PricelistWithRelations } from '../types/pricelist.types'

export function EditPricelistPage() {
  const { supplierProductId, pricelistId } = useParams<{ 
    supplierProductId: string
    pricelistId: string 
  }>()
  const navigate = useNavigate()
  const toast = useToast()

  const currentBranch = useBranchContextStore(s => s.currentBranch)

  const updatePricelist = usePricelistsStore(s => s.updatePricelist)
  const mutationLoading = usePricelistsStore(s => s.mutationLoading)
  
  const [pricelist, setPricelist] = useState<PricelistWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchPricelist = async () => {
      if (!pricelistId) {
        setError('Invalid pricelist ID')
        setLoading(false)
        return
      }

      // Early status validation to prevent unnecessary API calls
      try {
        const data = await pricelistsApi.getById(pricelistId, controller.signal)
        
        if (!controller.signal.aborted) {
          // Business rule validation with specific error messages
          if (!isEditable(data.status)) {
            const statusMessages = {
              'APPROVED': 'Approved pricelists cannot be edited. Create a new version instead.',
              'REJECTED': 'Rejected pricelists cannot be edited. Create a new pricelist.',
              'EXPIRED': 'Expired pricelists cannot be edited. Create a new pricelist.',
              'ARCHIVED': 'Archived pricelists cannot be edited. Contact administrator if needed.'
            }
            const message = statusMessages[data.status as keyof typeof statusMessages] || 
                           `Cannot edit pricelist with status: ${data.status}`
            setError(message)
            setLoading(false)
            return
          }
          setPricelist(data)
          setError(null)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load pricelist'
          setError(errorMessage)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchPricelist()
    return () => controller.abort()
  }, [pricelistId])

  const handleSubmit = useCallback(async (data: CreatePricelistDto | UpdatePricelistDto) => {
    if (!pricelistId || !pricelist) return

    // Double-check editability before submission
    if (!isEditable(pricelist.status)) {
      toast.error('This pricelist can no longer be edited')
      return
    }

    try {
      await updatePricelist(pricelistId, data as UpdatePricelistDto)
      toast.success('Pricelist updated successfully')
      // Navigate after promise resolves, not based on flag
      navigate(`/supplier-products/${supplierProductId}/pricelists`)
    } catch (error) {
      // Enhanced error handling with business context
      const errorMessage = error instanceof Error ? error.message : 'Failed to update pricelist'
      toast.error(errorMessage)
    }
  }, [updatePricelist, pricelistId, pricelist, toast, navigate, supplierProductId])

  const handleCancel = useCallback(() => {
    navigate(`/supplier-products/${supplierProductId}/pricelists`)
  }, [navigate, supplierProductId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Pricelist</h1>
        <p className="text-gray-500 mt-1">
          Update pricing for {pricelist.supplier?.supplier_name} - {pricelist.product?.product_name}
        </p>
      </div>

      <div className="max-w-4xl">
        <PricelistFormContextual
          initialData={pricelist}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Update Pricelist"
          isEdit={true}
          loading={mutationLoading}
          companyId={currentBranch?.company_id || ''}
          branchId={currentBranch?.branch_id || null}
          supplierId={pricelist.supplier_id}
          productId={pricelist.product_id}
          supplierName={pricelist.supplier?.supplier_name}
          productName={pricelist.product?.product_name}
        />
      </div>
    </div>
  )
}