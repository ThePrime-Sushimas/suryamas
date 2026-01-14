import { useState, useMemo, useEffect } from 'react'
import { useBranchContext } from '@/features/branch_context'
import { branchesApi } from '@/features/branches/api/branches.api'
import { useToast } from '@/contexts/ToastContext'
import type { Branch } from '@/features/branches/types'
import type { AccountingPurpose, CreateAccountingPurposeDto, UpdateAccountingPurposeDto, AppliedToType } from '../types/accounting-purpose.types'
import { APPLIED_TO_OPTIONS } from '../constants/accounting-purpose.constants'
import { accountingPurposeSchema, updateAccountingPurposeSchema } from '../utils/validation'

interface AccountingPurposeFormProps {
  initialData?: AccountingPurpose
  isEdit?: boolean
  onSubmit: (data: CreateAccountingPurposeDto | UpdateAccountingPurposeDto) => Promise<void>
  isLoading?: boolean
  onCancel?: () => void
}

export const AccountingPurposeForm = ({ 
  initialData, 
  isEdit, 
  onSubmit, 
  isLoading, 
  onCancel
}: AccountingPurposeFormProps) => {
  const currentBranch = useBranchContext()
  const toast = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [formData, setFormData] = useState({
    purpose_code: initialData?.purpose_code || '',
    purpose_name: initialData?.purpose_name || '',
    applied_to: (initialData?.applied_to || 'SALES') as AppliedToType,
    description: initialData?.description || '',
    is_active: initialData?.is_active ?? true,
    branch_id: initialData?.branch_id || ''
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchBranches = async () => {
      if (!currentBranch?.company_id) return
      
      setLoadingBranches(true)
      try {
        const response = await branchesApi.list(1, 100, null, { company_id: currentBranch.company_id })
        setBranches(response.data || [])
      } catch (error) {
        toast.error('Failed to fetch branches')
        setBranches([])
      } finally {
        setLoadingBranches(false)
      }
    }
    
    fetchBranches()
  }, [currentBranch?.company_id])

  const schema = isEdit ? updateAccountingPurposeSchema : accountingPurposeSchema
  const isSystemPurpose = initialData?.is_system || false

  const errors = useMemo(() => {
    if (Object.keys(touched).length === 0) return {}

    const result = schema.safeParse(formData)
    if (result.success) return {}

    const newErrors: Record<string, string> = {}
    result.error.errors.forEach(err => {
      const field = err.path[0] as string
      if (touched[field]) {
        newErrors[field] = err.message
      }
    })

    return newErrors
  }, [formData, touched, schema])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target
    let value: string | boolean = e.target.value

    if (type === 'checkbox') {
      value = (e.target as HTMLInputElement).checked
    }

    setFormData(prev => ({ ...prev, [name]: value }))
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setTouched(prev => ({ ...prev, [e.target.name]: true }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const result = schema.safeParse(formData)
    if (!result.success) {
      const allTouched = Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {})
      setTouched(allTouched)
      return
    }

    const submitData = {
      ...result.data,
      branch_id: result.data.branch_id === '' ? null : result.data.branch_id
    }

    await onSubmit(isEdit ? submitData as UpdateAccountingPurposeDto : submitData as CreateAccountingPurposeDto)
  }

  if (isSystemPurpose && isEdit) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">System Purpose</h3>
          <p className="text-gray-600 mb-4">
            This is a system-defined accounting purpose and cannot be modified.
          </p>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to List
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="purpose_code" className="block text-sm font-medium text-gray-700 mb-1">
            Purpose Code *
          </label>
          <input
            id="purpose_code"
            name="purpose_code"
            type="text"
            value={formData.purpose_code}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            disabled={isEdit || isLoading}
            maxLength={50}
            placeholder="e.g., SALES_INVOICE"
            aria-invalid={!!errors.purpose_code}
          />
          {isEdit && (
            <p className="text-xs text-gray-500 mt-1">Purpose code cannot be changed</p>
          )}
          {errors.purpose_code && (
            <p className="text-red-600 text-sm mt-1">{errors.purpose_code}</p>
          )}
        </div>

        <div>
          <label htmlFor="purpose_name" className="block text-sm font-medium text-gray-700 mb-1">
            Purpose Name *
          </label>
          <input
            id="purpose_name"
            name="purpose_name"
            type="text"
            value={formData.purpose_name}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            maxLength={255}
            placeholder="e.g., Sales Invoice"
            aria-invalid={!!errors.purpose_name}
          />
          {errors.purpose_name && (
            <p className="text-red-600 text-sm mt-1">{errors.purpose_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <label htmlFor="applied_to" className="block text-sm font-medium text-gray-700 mb-1">
          Applied To *
        </label>
        <select
          id="applied_to"
          name="applied_to"
          value={formData.applied_to}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
          aria-invalid={!!errors.applied_to}
        >
          {APPLIED_TO_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Defines which type of transactions this purpose applies to
        </p>
        {errors.applied_to && (
          <p className="text-red-600 text-sm mt-1">{errors.applied_to}</p>
        )}
      </div>

      <div>
        <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 mb-1">
          Branch
        </label>
        <select
          id="branch_id"
          name="branch_id"
          value={formData.branch_id}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading || loadingBranches}
          aria-invalid={!!errors.branch_id}
        >
          <option value="">All Branches</option>
          {branches.map(branch => (
            <option key={branch.id} value={branch.id}>
              {branch.branch_name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Leave empty to apply to all branches, or select a specific branch
        </p>
        {errors.branch_id && (
          <p className="text-red-600 text-sm mt-1">{errors.branch_id}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
          maxLength={500}
          placeholder="Optional description for this accounting purpose..."
        />
        {errors.description && (
          <p className="text-red-600 text-sm mt-1">{errors.description}</p>
        )}
      </div>

      <div>
        <label htmlFor="is_active" className="flex items-center cursor-pointer">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            checked={formData.is_active}
            onChange={handleChange}
            className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={isLoading}
          />
          <span className="text-sm font-medium text-gray-700">Active</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          Only active purposes can be used in transactions
        </p>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || Object.keys(errors).length > 0}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? 'Saving...' : isEdit ? 'Update Purpose' : 'Create Purpose'}
        </button>
      </div>
    </form>
  )
}