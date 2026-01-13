import { useForm, useWatch } from 'react-hook-form'
import { useMemo, useEffect } from 'react'
import type { CreateAccountingPurposeAccountDto, UpdateAccountingPurposeAccountDto } from '../types/accounting-purpose-account.types'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { SIDES } from '../constants/accounting-purpose-account.constants'
import { validateSideBalance } from '../utils/validation'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'

interface AccountingPurposeAccountFormProps {
  initialData?: UpdateAccountingPurposeAccountDto & { purpose_id?: string; account_id?: string }
  onSubmit: (data: CreateAccountingPurposeAccountDto | UpdateAccountingPurposeAccountDto) => Promise<void>
  onCancel: () => void
  isEdit?: boolean
}

export const AccountingPurposeAccountForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isEdit = false 
}: AccountingPurposeAccountFormProps) => {
  const { postableAccounts, activePurposes, loading } = useAccountingPurposeAccountsStore()
  const branchContext = useBranchContext()
  
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm({
    defaultValues: initialData
  })

  // Reset form when company changes (only for create mode)
  useEffect(() => {
    if (!isEdit && branchContext?.company_id) {
      reset({
        purpose_id: '',
        account_id: '',
        side: undefined,
        priority: undefined,
        is_active: true
      })
    }
  }, [branchContext?.company_id, isEdit, reset])

  const selectedAccountId = useWatch({
    control,
    name: 'account_id'
  })
  
  const selectedSide = useWatch({
    control,
    name: 'side'
  })
  const selectedAccount = useMemo(() => 
    postableAccounts.find(a => a.id === selectedAccountId),
    [postableAccounts, selectedAccountId]
  )

  const sideValidation = useMemo(() => {
    if (selectedAccount && selectedSide) {
      return validateSideBalance(selectedAccount.normal_balance, selectedSide)
    }
    return { isValid: true }
  }, [selectedAccount, selectedSide])

  const purposeOptions = useMemo(() => 
    activePurposes.map(p => ({ value: p.id, label: `${p.purpose_code} - ${p.purpose_name}` })),
    [activePurposes]
  )

  const accountOptions = useMemo(() => 
    postableAccounts.map(a => ({ value: a.id, label: `${a.account_code} - ${a.account_name}` })),
    [postableAccounts]
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purpose <span className="text-red-500">*</span>
          </label>
          <select
            {...register('purpose_id')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Purpose</option>
            {purposeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.purpose_id && (
            <p className="mt-1 text-sm text-red-600">{String(errors.purpose_id.message || 'Purpose is required')}</p>
          )}
        </div>
      )}

      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account <span className="text-red-500">*</span>
          </label>
          <select
            {...register('account_id')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Account</option>
            {accountOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.account_id && (
            <p className="mt-1 text-sm text-red-600">{String(errors.account_id.message || 'Account is required')}</p>
          )}
          {selectedAccount && (
            <div className="mt-1 text-sm text-gray-600">
              <p>Normal Balance: <span className="font-medium">{selectedAccount.normal_balance}</span></p>
              {sideValidation.warning && (
                <p className="text-yellow-600 font-medium">
                  ⚠️ {sideValidation.warning}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Side <span className="text-red-500">*</span>
        </label>
        <select
          {...register('side')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Side</option>
          {SIDES.map(side => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </select>
        {errors.side && (
          <p className="mt-1 text-sm text-red-600">{String(errors.side.message || 'Side is required')}</p>
        )}
        {sideValidation.warning && (
          <p className="mt-1 text-sm text-yellow-600">
            ⚠️ {sideValidation.warning}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Optional)</label>
        <input
          type="number"
          min="1"
          max="999"
          {...register('priority', { 
            setValueAs: (value) => value === '' || value === null ? undefined : Number(value)
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Leave empty for auto-assignment"
        />
        <p className="mt-1 text-xs text-gray-500">If empty, system will auto-assign the next available priority</p>
        {errors.priority && (
          <p className="mt-1 text-sm text-red-600">{String(errors.priority.message || 'Invalid priority')}</p>
        )}
      </div>

      {isEdit && (
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('is_active')}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Active</span>
          </label>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loading.submit}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting || loading.submit ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}