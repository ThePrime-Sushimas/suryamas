/**
 * Create Pricelist Page
 * Standalone pricelist creation with supplier/product selection
 * 
 * Features:
 * - Supplier/Product search and selection
 * - Form validation with Zod schema
 * - Error handling and loading states
 * - Accessibility compliant
 * - Optimistic UI updates
 * 
 * @module pricelists/pages
 */

import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { suppliersApi } from '@/features/suppliers/api/suppliers.api'
import { supplierProductsApi } from '@/features/supplier-products/api/supplierProducts.api'
import { useUomSearch } from '@/hooks/_shared/useUomSearch'
import { usePricelistsStore } from '../store/pricelists.store'
import { CURRENCY_OPTIONS } from '../constants/pricelist.constants'
import { validateCreatePricelist, hasErrors } from '../utils/validation'
import type { CreatePricelistDto, PricelistFormErrors } from '../types/pricelist.types'

interface SupplierOption {
  id: string
  supplier_code: string
  supplier_name: string
}

interface ProductOption {
  id: string
  product_code: string
  product_name: string
}

/**
 * Create pricelist page with full supplier/product selection
 * Follows ERP domain-driven design principles
 */
export const CreatePricelistPage = memo(function CreatePricelistPage() {
  const navigate = useNavigate()
  const toast = useToast()

  // Branch context
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  // Store state
  const createPricelist = usePricelistsStore(s => s.createPricelist)
  const storeLoading = usePricelistsStore(s => s.loading)
  const storeErrors = usePricelistsStore(s => s.errors)
  const clearError = usePricelistsStore(s => s.clearError)

  // Form state
  const [formData, setFormData] = useState<CreatePricelistDto>({
    company_id: currentBranch?.company_id || '',
    supplier_id: '',
    product_id: '',
    uom_id: '',
    price: 0,
    currency: 'IDR',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: null,
    is_active: true
  })

  const [errors, setErrors] = useState<PricelistFormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Selection states
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // UOM search hook
  const uomSearch = useUomSearch(formData.product_id)

  // Update company_id when branch changes
  useEffect(() => {
    if (currentBranch?.company_id) {
      setFormData(prev => ({ ...prev, company_id: currentBranch.company_id }))
    }
  }, [currentBranch?.company_id])

  // Fetch suppliers
  useEffect(() => {
    const controller = new AbortController()

    const fetchSuppliers = async () => {
      setLoadingSuppliers(true)
      try {
        const response = await suppliersApi.list({
          search: supplierSearch,
          is_active: true,
          limit: 50
        }, controller.signal)
        
        if (!controller.signal.aborted) {
          setSuppliers(response.data)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch suppliers:', error)
          setSuppliers([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuppliers(false)
        }
      }
    }

    const timeoutId = setTimeout(fetchSuppliers, 300)
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [supplierSearch])

  // Fetch products based on selected supplier
  useEffect(() => {
    const controller = new AbortController()

    const fetchProducts = async () => {
      if (!formData.supplier_id) {
        setProducts([])
        return
      }

      setLoadingProducts(true)
      try {
        const response = await supplierProductsApi.getBySupplier(formData.supplier_id, true, controller.signal)
        
        if (!controller.signal.aborted) {
          const filteredProducts = response.filter(sp => 
            !productSearch || 
            sp.product?.product_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
            sp.product?.product_code?.toLowerCase().includes(productSearch.toLowerCase())
          ).map(sp => ({
            id: sp.product_id,
            product_code: sp.product?.product_code || '',
            product_name: sp.product?.product_name || ''
          }))
          setProducts(filteredProducts)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch supplier products:', error)
          setProducts([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false)
        }
      }
    }

    const timeoutId = setTimeout(fetchProducts, 300)
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [formData.supplier_id, productSearch])

  // Store error handling
  useEffect(() => {
    if (storeErrors.mutation) {
      toast.error(storeErrors.mutation)
      clearError()
    }
  }, [storeErrors.mutation, toast, clearError])

  // Memoized validation
  const validationErrors = useMemo(() => {
    return validateCreatePricelist(formData)
  }, [formData])

  // Form handlers
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, type, value } = e.target
    
    setTouched(prev => ({ ...prev, [name]: true }))

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : Number(value) }))
    } else if (type === 'date') {
      setFormData(prev => ({ ...prev, [name]: value || null }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Reset dependent fields
    if (name === 'product_id') {
      setFormData(prev => ({ ...prev, uom_id: '' }))
    }
  }, [])

  const handleBlur = useCallback((fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }))
  }, [])

  const getFieldError = useCallback((fieldName: string) => {
    return touched[fieldName] ? validationErrors[fieldName as keyof PricelistFormErrors] : undefined
  }, [touched, validationErrors])

  // Form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Mark all fields as touched
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {} as Record<string, boolean>)
    setTouched(allTouched)

    // Validate
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors)
      return
    }

    setErrors({})

    try {
      // Clean currency optimization - create new object without mutation
      const submitData = formData.currency === 'IDR' 
        ? { ...formData, currency: undefined }
        : { ...formData }

      await createPricelist(submitData)
      toast.success('Pricelist created successfully')
      navigate('/pricelists')
    } catch {
      // Store handles error display
    }
  }, [formData, validationErrors, createPricelist, toast, navigate])

  const handleCancel = useCallback(() => {
    navigate('/pricelists')
  }, [navigate])

  // Branch context validation
  if (!currentBranch?.company_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Branch Required</h2>
          <p className="text-yellow-600 mb-4">Please select a valid branch to continue</p>
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

  const isFormDisabled = storeLoading.create

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <button
              onClick={() => navigate('/pricelists')}
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
        <p className="text-gray-500 mt-1">Add new pricing information</p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6" noValidate>
          {/* Supplier Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Supplier Selection</h3>
            <div>
              <label htmlFor="supplier_search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Supplier *
              </label>
              <input
                id="supplier_search"
                type="text"
                placeholder="Search suppliers..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                disabled={isFormDisabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                onBlur={() => handleBlur('supplier_id')}
                required
                disabled={isFormDisabled}
                className={`w-full px-3 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                  getFieldError('supplier_id') ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!getFieldError('supplier_id')}
                aria-describedby={getFieldError('supplier_id') ? 'supplier-error' : undefined}
              >
                <option value="">Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_code} - {supplier.supplier_name}
                  </option>
                ))}
              </select>
              {loadingSuppliers && (
                <p className="text-xs text-gray-500 mt-1">Loading suppliers...</p>
              )}
              {getFieldError('supplier_id') && (
                <p id="supplier-error" className="text-xs text-red-600 mt-1" role="alert">
                  {getFieldError('supplier_id')}
                </p>
              )}
            </div>
          </div>

          {/* Product Selection */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Product Selection</h3>
            <div>
              <label htmlFor="product_search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Product *
              </label>
              <input
                id="product_search"
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                disabled={isFormDisabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <select
                name="product_id"
                value={formData.product_id}
                onChange={handleChange}
                onBlur={() => handleBlur('product_id')}
                required
                disabled={isFormDisabled}
                className={`w-full px-3 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                  getFieldError('product_id') ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!getFieldError('product_id')}
                aria-describedby={getFieldError('product_id') ? 'product-error' : undefined}
              >
                <option value="">Select Product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.product_code} - {product.product_name}
                  </option>
                ))}
              </select>
              {loadingProducts && (
                <p className="text-xs text-gray-500 mt-1">Loading products...</p>
              )}
              {getFieldError('product_id') && (
                <p id="product-error" className="text-xs text-red-600 mt-1" role="alert">
                  {getFieldError('product_id')}
                </p>
              )}
            </div>
          </div>

          {/* UOM Selection */}
          {formData.product_id && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">UOM Selection</h3>
              <div>
                <label htmlFor="uom_search" className="block text-sm font-medium text-gray-700 mb-1">
                  UOM *
                </label>
                <input
                  id="uom_search"
                  type="text"
                  placeholder="Search UOM..."
                  value={uomSearch.search}
                  onChange={(e) => uomSearch.setSearch(e.target.value)}
                  disabled={isFormDisabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <select
                  name="uom_id"
                  value={formData.uom_id}
                  onChange={handleChange}
                  onBlur={() => handleBlur('uom_id')}
                  required
                  disabled={isFormDisabled}
                  className={`w-full px-3 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                    getFieldError('uom_id') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-invalid={!!getFieldError('uom_id')}
                  aria-describedby={getFieldError('uom_id') ? 'uom-error' : undefined}
                >
                  <option value="">Select UOM</option>
                  {uomSearch.uoms.map(u => (
                    <option key={u.id} value={u.id}>{u.metric_units?.unit_name}</option>
                  ))}
                </select>
                {uomSearch.loading && (
                  <p className="text-xs text-gray-500 mt-1">Loading UOMs...</p>
                )}
                {getFieldError('uom_id') && (
                  <p id="uom-error" className="text-xs text-red-600 mt-1" role="alert">
                    {getFieldError('uom_id')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                  Price *
                </label>
                <input
                  id="price"
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  onBlur={() => handleBlur('price')}
                  required
                  min="0"
                  step="0.01"
                  disabled={isFormDisabled}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                    getFieldError('price') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-invalid={!!getFieldError('price')}
                  aria-describedby={getFieldError('price') ? 'price-error' : undefined}
                />
                {getFieldError('price') && (
                  <p id="price-error" className="text-xs text-red-600 mt-1" role="alert">
                    {getFieldError('price')}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  {CURRENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Validity Period */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Validity Period</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="valid_from" className="block text-sm font-medium text-gray-700 mb-1">
                  Valid From *
                </label>
                <input
                  id="valid_from"
                  type="date"
                  name="valid_from"
                  value={formData.valid_from}
                  onChange={handleChange}
                  onBlur={() => handleBlur('valid_from')}
                  required
                  disabled={isFormDisabled}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                    getFieldError('valid_from') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-invalid={!!getFieldError('valid_from')}
                  aria-describedby={getFieldError('valid_from') ? 'valid-from-error' : undefined}
                />
                {getFieldError('valid_from') && (
                  <p id="valid-from-error" className="text-xs text-red-600 mt-1" role="alert">
                    {getFieldError('valid_from')}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="valid_to" className="block text-sm font-medium text-gray-700 mb-1">
                  Valid To
                </label>
                <input
                  id="valid_to"
                  type="date"
                  name="valid_to"
                  value={formData.valid_to || ''}
                  onChange={handleChange}
                  onBlur={() => handleBlur('valid_to')}
                  min={formData.valid_from}
                  disabled={isFormDisabled}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                    getFieldError('valid_to') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-invalid={!!getFieldError('valid_to')}
                  aria-describedby={getFieldError('valid_to') ? 'valid-to-help valid-to-error' : 'valid-to-help'}
                />
                <p id="valid-to-help" className="text-xs text-gray-500 mt-1">Leave empty for permanent</p>
                {getFieldError('valid_to') && (
                  <p id="valid-to-error" className="text-xs text-red-600 mt-1" role="alert">
                    {getFieldError('valid_to')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="border-t pt-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                disabled={isFormDisabled}
                className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          {/* Form-level errors */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600" role="alert">{errors.general}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isFormDisabled}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isFormDisabled || hasErrors(validationErrors)}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {storeLoading.create ? 'Creating...' : 'Create Pricelist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})