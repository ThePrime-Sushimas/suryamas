/**
 * Pricelist Form Contextual Component
 * Form for creating/editing pricelists with fixed supplier-product context
 * 
 * Features:
 * - Client-side validation
 * - Optimistic UI updates
 * - Proper error handling
 * - Accessibility compliant
 * 
 * @module pricelists/components
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useUomSearch } from '../hooks/useUomSearch'
import { CURRENCY_OPTIONS } from '../constants/pricelist.constants'
import { validateCreatePricelist, validateUpdatePricelist, hasErrors } from '../utils/validation'
import type { CreatePricelistDto, UpdatePricelistDto, Pricelist, PricelistFormErrors } from '../types/pricelist.types'

interface PricelistFormContextualProps {
  /** Initial data for edit mode */
  initialData?: Pricelist
  /** Form submit handler */
  onSubmit: (data: CreatePricelistDto | UpdatePricelistDto) => Promise<void>
  /** Cancel handler */
  onCancel: () => void
  /** Submit button label */
  submitLabel: string
  /** Edit mode flag */
  isEdit?: boolean
  /** Loading state from parent */
  loading?: boolean
  /** Fixed context values */
  companyId: string
  branchId?: string | null
  supplierId: string
  productId: string
  supplierName?: string
  productName?: string
}

/**
 * Contextual pricelist form with fixed supplier-product
 * Follows ERP domain-driven design principles
 */
export function PricelistFormContextual({
  initialData,
  onSubmit,
  onCancel,
  submitLabel,
  isEdit = false,
  loading = false,
  companyId,
  branchId,
  supplierId,
  productId,
  supplierName,
  productName
}: PricelistFormContextualProps) {
  const uomSearch = useUomSearch(productId)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<PricelistFormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Form data state
  const [formData, setFormData] = useState<CreatePricelistDto>(() => ({
    company_id: companyId,
    branch_id: branchId || null,
    supplier_id: supplierId,
    product_id: productId,
    uom_id: initialData?.uom_id || '',
    price: initialData?.price || 0,
    currency: initialData?.currency || 'IDR',
    valid_from: initialData?.valid_from || new Date().toISOString().split('T')[0],
    valid_to: initialData?.valid_to || null,
    is_active: initialData?.is_active ?? true
  }))

  // Reset form when initialData changes (switching between items)
  useEffect(() => {
    if (initialData?.id) {
      setFormData({
        company_id: companyId,
        branch_id: branchId || null,
        supplier_id: supplierId,
        product_id: productId,
        uom_id: initialData.uom_id || '',
        price: initialData.price || 0,
        currency: initialData.currency || 'IDR',
        valid_from: initialData.valid_from || new Date().toISOString().split('T')[0],
        valid_to: initialData.valid_to || null,
        is_active: initialData.is_active ?? true
      })
      setTouched({})
      setErrors({})
    }
  }, [
    initialData?.id,
    initialData?.uom_id,
    initialData?.price,
    initialData?.currency,
    initialData?.valid_from,
    initialData?.valid_to,
    initialData?.is_active,
    companyId,
    branchId,
    supplierId,
    productId
  ])

  // Memoized validation (pure function - no touched dependency needed)
  const validationErrors = useMemo(() => {
    if (isEdit) {
      const updateData: UpdatePricelistDto = {
        price: formData.price,
        currency: formData.currency,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to,
        is_active: formData.is_active
      }
      return validateUpdatePricelist(updateData)
    } else {
      return validateCreatePricelist(formData)
    }
  }, [formData, isEdit])

  // Form submission handler
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

    setSubmitting(true)
    setErrors({})

    try {
      const submitData = { ...formData }
      
      // Clean currency optimization
      if (submitData.currency === 'IDR') {
        delete submitData.currency
      }

      if (isEdit) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { company_id, branch_id, supplier_id, product_id, uom_id, ...updateData } = submitData
        await onSubmit(updateData)
      } else {
        await onSubmit(submitData)
      }
    } catch {
      // Error handled by parent component
    } finally {
      setSubmitting(false)
    }
  }, [formData, validationErrors, isEdit, onSubmit])

  // Field change handler with validation
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, type, value } = e.target
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }))

    // Update form data
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : Number(value) }))
    } else if (type === 'date') {
      setFormData(prev => ({ ...prev, [name]: value || null }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }, [])

  // Field blur handler
  const handleBlur = useCallback((fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }))
  }, [])

  // Get field error if touched
  const getFieldError = useCallback((fieldName: string) => {
    return touched[fieldName] ? validationErrors[fieldName as keyof PricelistFormErrors] : undefined
  }, [touched, validationErrors])

  const isFormDisabled = loading || submitting

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6" noValidate>
      {/* Context Display (Read-only) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Context (Fixed)</h3>
        <div className="space-y-1 text-sm text-blue-700">
          <p><span className="font-medium">Supplier:</span> {supplierName || supplierId}</p>
          <p><span className="font-medium">Product:</span> {productName || productId}</p>
        </div>
      </div>

      {/* UOM Selection */}
      <div>
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
            disabled={isEdit || isFormDisabled}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            aria-describedby={isEdit ? "uom-help" : undefined}
          />
          <select
            name="uom_id"
            value={formData.uom_id}
            onChange={handleChange}
            onBlur={() => handleBlur('uom_id')}
            required
            disabled={isEdit || isFormDisabled}
            className={`w-full px-3 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
              !isEdit && getFieldError('uom_id') ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={!!getFieldError('uom_id')}
            aria-describedby={getFieldError('uom_id') ? 'uom-error' : undefined}
          >
            <option value="">Select UOM</option>
            {uomSearch.uoms.map(u => (
              <option key={u.id} value={u.id}>{u.metric_units?.unit_name}</option>
            ))}
          </select>
          {isEdit && (
            <p id="uom-help" className="text-xs text-gray-500 mt-1">UOM cannot be changed</p>
          )}
          {!isEdit && getFieldError('uom_id') && (
            <p id="uom-error" className="text-xs text-red-600 mt-1" role="alert">
              {getFieldError('uom_id')}
            </p>
          )}
        </div>
      </div>

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
              aria-describedby="valid-to-help"
            />
            <p id="valid-to-help" className="text-xs text-gray-500 mt-1">Leave empty for permanent</p>
            {getFieldError('valid_to') && (
              <p className="text-xs text-red-600 mt-1" role="alert">
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
          onClick={onCancel}
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
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}