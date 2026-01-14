import { useState, useEffect, useMemo } from 'react'
import { useBranchContext } from '@/features/branch_context'
import { useBranchesStore } from '@/features/branches'
import type { ChartOfAccount, CreateChartOfAccountDto, UpdateChartOfAccountDto, AccountType } from '../types/chart-of-account.types'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, CURRENCY_CODES, DEFAULT_CURRENCY, NORMAL_BALANCE_MAP } from '../constants/chart-of-account.constants'
import { validateAccountCode, validateAccountName, validateCurrencyCode, validateParentAccount, validateHeaderAccount, validateSortOrder } from '../utils/validation'
import { formatCode } from '../utils/format'

interface ChartOfAccountFormProps {
  initialData?: ChartOfAccount
  isEdit?: boolean
  onSubmit: (data: CreateChartOfAccountDto | UpdateChartOfAccountDto) => Promise<void>
  isLoading?: boolean
  parentAccounts?: ChartOfAccount[]
  defaultParentId?: string
  lockedAccountType?: AccountType
}

export const ChartOfAccountForm = ({ 
  initialData, 
  isEdit, 
  onSubmit, 
  isLoading, 
  parentAccounts = [],
  defaultParentId,
  lockedAccountType
}: ChartOfAccountFormProps) => {
  const currentBranch = useBranchContext()
  const { branches, fetchBranches } = useBranchesStore()
  const initialFormData = useMemo(() => {
    return {
      company_id: currentBranch?.company_id || '', // Always use context company_id
      account_code: initialData?.account_code || '',
      account_name: initialData?.account_name || '',
      account_type: (initialData?.account_type || lockedAccountType || 'ASSET') as AccountType,
      account_subtype: initialData?.account_subtype || '',
      parent_account_id: initialData?.parent_account_id || defaultParentId || '',
      branch_id: initialData?.branch_id || currentBranch?.branch_id || '',
      is_header: initialData?.is_header || false,
      is_postable: initialData?.is_postable !== undefined ? initialData.is_postable : true,
      currency_code: initialData?.currency_code || DEFAULT_CURRENCY,
      sort_order: initialData?.sort_order?.toString() || '',
      is_active: initialData?.is_active !== undefined ? initialData.is_active : true
    }
  }, [initialData, defaultParentId, lockedAccountType, currentBranch?.company_id, currentBranch?.branch_id])

  const [formData, setFormData] = useState(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setFormData(initialFormData)
  }, [initialFormData])

  useEffect(() => {
    if (formData.company_id) {
      fetchBranches(1, 100, null, { company_id: formData.company_id })
    }
  }, [formData.company_id, fetchBranches])

  // Auto-set normal balance based on account type
  const normalBalance = useMemo(() => NORMAL_BALANCE_MAP[formData.account_type], [formData.account_type])

  // Filter branches by selected company
  const availableBranches = useMemo(() => {
    return branches.filter(branch => branch.company_id === formData.company_id)
  }, [branches, formData.company_id])

  // Filter parent accounts by same type and header only
  const availableParents = useMemo(() => {
    const filtered = parentAccounts.filter(account => 
      account.account_type === formData.account_type && 
      account.is_header &&
      account.id !== initialData?.id // Prevent self-selection
    )
    return filtered
  }, [parentAccounts, formData.account_type, formData.parent_account_id, initialData?.id])

  // Get selected parent account details
  const selectedParent = useMemo(() => {
    return formData.parent_account_id 
      ? availableParents.find(p => p.id === formData.parent_account_id)
      : undefined
  }, [formData.parent_account_id, availableParents])

  const validateField = (name: string, value: string | boolean): string => {
    switch (name) {
      case 'account_code':
        return validateAccountCode(value as string)
      case 'account_name':
        return validateAccountName(value as string)
      case 'currency_code':
        return validateCurrencyCode(value as string)
      case 'parent_account_id':
        return validateParentAccount(
          (value as string) || null, 
          formData.account_type,
          selectedParent?.account_type,
          selectedParent?.is_header
        )
      case 'is_header':
        return validateHeaderAccount(value as boolean, formData.is_postable)
      case 'is_postable':
        return validateHeaderAccount(formData.is_header, value as boolean)
      case 'sort_order': {
        const sortOrder = value ? parseInt(value as string) : null
        return validateSortOrder(sortOrder)
      }
      default:
        return ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Validate all fields
    Object.entries(formData).forEach(([key, value]) => {
      const error = validateField(key, value)
      if (error) newErrors[key] = error
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const isCheckbox = e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
    const fieldValue = isCheckbox ? (e.target as HTMLInputElement).checked : value
    
    setTouched(prev => ({ ...prev, [name]: true }))
    const error = validateField(name, fieldValue)
    setErrors(prev => ({ ...prev, [name]: error }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const isCheckbox = e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
    let fieldValue: string | boolean = isCheckbox ? (e.target as HTMLInputElement).checked : value

    // Format specific fields
    if (name === 'account_code') {
      fieldValue = formatCode(value)
    } else if (name === 'currency_code') {
      fieldValue = formatCode(value)
    }

    setFormData(prev => ({ ...prev, [name]: fieldValue }))

    // Auto-adjust related fields
    if (name === 'account_type') {
      setFormData(prev => ({ 
        ...prev, 
        account_type: fieldValue as AccountType,
        parent_account_id: '' // Reset parent when type changes
      }))
    } else if (name === 'is_header' && fieldValue === true) {
      setFormData(prev => ({ ...prev, is_header: fieldValue as boolean, is_postable: false }))
    }

    // Validate if field was touched
    if (touched[name]) {
      const error = validateField(name, fieldValue)
      setErrors(prev => ({ ...prev, [name]: error }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setErrors(prev => ({ ...prev, submit: 'Please fix validation errors' }))
      return
    }

    try {
      const submitData = isEdit
        ? {
            account_name: formData.account_name,
            account_subtype: formData.account_subtype || null,
            parent_account_id: formData.parent_account_id || null,
            is_header: formData.is_header,
            is_postable: formData.is_postable,
            currency_code: formData.currency_code,
            sort_order: formData.sort_order ? parseInt(formData.sort_order) : null,
            is_active: formData.is_active
          }
        : {
            company_id: formData.company_id,
            branch_id: formData.branch_id || null,
            account_code: formData.account_code,
            account_name: formData.account_name,
            account_type: formData.account_type,
            account_subtype: formData.account_subtype || null,
            parent_account_id: formData.parent_account_id || null,
            is_header: formData.is_header,
            is_postable: formData.is_postable,
            normal_balance: normalBalance,
            currency_code: formData.currency_code,
            sort_order: formData.sort_order ? parseInt(formData.sort_order) : null
          }

      await onSubmit(submitData)
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save account'
      setErrors({ submit: errorMsg })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Account Code *</label>
          <input
            type="text"
            name="account_code"
            value={formData.account_code}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isEdit}
            className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100 uppercase"
            maxLength={30}
            placeholder="e.g., CASH-001"
          />
          {errors.account_code && <p className="text-red-500 text-xs mt-1">{errors.account_code}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Account Type *</label>
          <select 
            name="account_type" 
            value={formData.account_type} 
            onChange={handleChange}
            disabled={isEdit || !!lockedAccountType}
            className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
          >
            {ACCOUNT_TYPES.map(type => (
              <option key={type} value={type}>{ACCOUNT_TYPE_LABELS[type]}</option>
            ))}
          </select>
          {lockedAccountType && (
            <p className="text-xs text-blue-600 mt-1">Account type locked to match parent account</p>
          )}
          {errors.account_type && <p className="text-red-500 text-xs mt-1">{errors.account_type}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Account Name *</label>
        <input
          type="text"
          name="account_name"
          value={formData.account_name}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md"
          maxLength={255}
          placeholder="e.g., Cash in Hand"
        />
        {errors.account_name && <p className="text-red-500 text-xs mt-1">{errors.account_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Branch</label>
        <select
          name="branch_id"
          value={formData.branch_id}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={!formData.company_id}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
        >
          <option value="">All Branches</option>
          {availableBranches.map(branch => (
            <option key={branch.id} value={branch.id}>
              {branch.branch_code} - {branch.branch_name}
            </option>
          ))}
        </select>
        {errors.branch_id && <p className="text-red-500 text-xs mt-1">{errors.branch_id}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Account Subtype</label>
          <input
            type="text"
            name="account_subtype"
            value={formData.account_subtype}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g., Current Assets"
          />
          {errors.account_subtype && <p className="text-red-500 text-xs mt-1">{errors.account_subtype}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Parent Account</label>
          <select
            name="parent_account_id"
            value={formData.parent_account_id}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">No Parent (Root Level)</option>
            {availableParents.map(parent => (
              <option key={parent.id} value={parent.id}>
                {parent.account_code} - {parent.account_name}
              </option>
            ))}
          </select>
          {errors.parent_account_id && <p className="text-red-500 text-xs mt-1">{errors.parent_account_id}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_header"
            checked={formData.is_header}
            onChange={handleChange}
            onBlur={handleBlur}
            className="mr-2 rounded border-gray-300"
          />
          <label className="text-sm font-medium">Header Account</label>
          {errors.is_header && <p className="text-red-500 text-xs mt-1">{errors.is_header}</p>}
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_postable"
            checked={formData.is_postable}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={formData.is_header}
            className="mr-2 rounded border-gray-300 disabled:opacity-50"
          />
          <label className="text-sm font-medium">Postable</label>
          {errors.is_postable && <p className="text-red-500 text-xs mt-1">{errors.is_postable}</p>}
        </div>

        {isEdit && (
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="mr-2 rounded border-gray-300"
            />
            <label className="text-sm font-medium">Active</label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Currency Code *</label>
          <select
            name="currency_code"
            value={formData.currency_code}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border rounded-md"
          >
            {CURRENCY_CODES.map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          {errors.currency_code && <p className="text-red-500 text-xs mt-1">{errors.currency_code}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Normal Balance</label>
          <input
            type="text"
            value={normalBalance}
            disabled
            className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sort Order</label>
          <input
            type="number"
            name="sort_order"
            value={formData.sort_order}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border rounded-md"
            min="0"
            max="9999"
            placeholder="0-9999"
          />
          {errors.sort_order && <p className="text-red-500 text-xs mt-1">{errors.sort_order}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Saving...' : isEdit ? 'Update Account' : 'Create Account'}
      </button>
    </form>
  )
}