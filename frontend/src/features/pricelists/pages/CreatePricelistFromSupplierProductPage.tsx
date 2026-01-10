/**
 * Create Pricelist From Supplier Product Page
 * Creates new pricelist with fixed supplier-product context
 * 
 * Features:
 * - Context validation
 * - Form state management
 * - Error handling
 * - Navigation guards
 * 
 * @module pricelists/pages
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { supplierProductsApi } from '@/features/supplier-products'
import { usePricelistsStore } from '../store/pricelists.store'
import { PricelistFormContextual } from '../components/PricelistFormContextual'
import type { CreatePricelistDto, UpdatePricelistDto } from '../types/pricelist.types'

interface SupplierProductContext {
  id: string
  supplier_id: string
  product_id: string
  supplier?: { supplier_name: string }
  product?: { product_name: string }
}

/**
 * Create pricelist page with supplier-product context
 * Follows ERP domain-driven design principles
 */
export function CreatePricelistFromSupplierProductPage() {
  const { supplierProductId } = useParams<{ supplierProductId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  // Branch context
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  // Store = SSOT for domain state
  const createPricelist = usePricelistsStore(s => s.createPricelist)
  const storeLoading = usePricelistsStore(s => s.loading)
  const storeErrors = usePricelistsStore(s => s.errors)
  const clearError = usePricelistsStore(s => s.clearError)
  
  // Page = Context resolver only
  const [supplierProduct, setSupplierProduct] = useState<SupplierProductContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState<string | null>(null)

  // Fetch supplier product context
  useEffect(() => {
    const controller = new AbortController()

    const fetchContext = async () => {
      if (!supplierProductId) {
        setContextError('Invalid supplier product ID')
        return
      }

      if (!currentBranch) {
        setContextError('No branch context available')
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
  }, [supplierProductId, currentBranch])

  // Store error handling (domain errors only)
  useEffect(() => {
    if (storeErrors.mutation) {
      toast.error(storeErrors.mutation)
      clearError()
    }
  }, [storeErrors.mutation, toast, clearError])

  // Form submission handler
  const handleSubmit = useCallback(async (data: CreatePricelistDto | UpdatePricelistDto) => {
    if (!supplierProduct || !currentBranch) {
      toast.error('Missing required context')
      return
    }

    try {
      await createPricelist(data as CreatePricelistDto)
      toast.success('Pricelist created successfully')
      navigate(`/supplier-products/${supplierProductId}/pricelists`)
    } catch {
      // Store handles error display
    }
  }, [createPricelist, supplierProduct, currentBranch, toast, navigate, supplierProductId])

  // Cancel handler
  const handleCancel = useCallback(() => {
    navigate(`/supplier-products/${supplierProductId}/pricelists`)
  }, [navigate, supplierProductId])

  // Loading state
  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading context...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (contextError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600 mb-4">{contextError}</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/supplier-products')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Context not found
  if (!supplierProduct) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Not Found</h2>
          <p className="text-yellow-600 mb-4">Supplier product not found</p>
          <button
            onClick={() => navigate('/supplier-products')}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            Back to List
          </button>
        </div>
      </div>
    )
  }

  // Branch context validation with better robustness
  if (!currentBranch?.company_id || !currentBranch?.branch_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Branch Required</h2>
          <p className="text-yellow-600 mb-4">Please select a valid branch with proper permissions to continue</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            Select Branch
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <button
              onClick={() => navigate('/supplier-products')}
              className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              Supplier Products
            </button>
          </li>
          <li>/</li>
          <li>
            <button
              onClick={() => navigate(`/supplier-products/${supplierProductId}/pricelists`)}
              className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              Pricelists
            </button>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">Create</li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Pricelist</h1>
        <p className="text-gray-500 mt-1">
          Add new pricing for {supplierProduct.supplier?.supplier_name} - {supplierProduct.product?.product_name}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <PricelistFormContextual
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Create Pricelist"
          submitting={storeLoading.create}
          companyId={currentBranch.company_id}
          branchId={currentBranch.branch_id}
          supplierId={supplierProduct.supplier_id}
          productId={supplierProduct.product_id}
          supplierName={supplierProduct.supplier?.supplier_name}
          productName={supplierProduct.product?.product_name}
        />
      </div>
    </div>
  )
}