import { useEffect, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bankAccountSchema, type BankAccountFormData } from '../schemas/bankAccount.schema'
import { useBanksStore } from '@/features/banks/store/useBanks'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { BankAccount } from '../types'

interface BankAccountFormProps {
  initialData?: BankAccount
  onSubmit: SubmitHandler<BankAccountFormData>
  onCancel: () => void
  isLoading?: boolean
}

export const BankAccountForm = ({ initialData, onSubmit, onCancel, isLoading }: BankAccountFormProps) => {
  const { options, fetchOptions } = useBanksStore()
  const [showPrimaryConfirm, setShowPrimaryConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<BankAccountFormData | null>(null)

  const form = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bank_id: initialData?.bank_id ?? 0,
      account_name: initialData?.account_name ?? '',
      account_number: initialData?.account_number ?? '',
      is_primary: initialData?.is_primary ?? false,
      is_active: initialData?.is_active ?? true,
    },
  })

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  const handleFormSubmit: SubmitHandler<BankAccountFormData> = (data) => {
    if (data.is_primary && !initialData?.is_primary) {
      setPendingData(data)
      setShowPrimaryConfirm(true)
    } else {
      onSubmit(data)
    }
  }

  const handlePrimaryConfirm = () => {
    if (pendingData) {
      onSubmit(pendingData)
      setShowPrimaryConfirm(false)
      setPendingData(null)
    }
  }

  return (
    <>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Bank Selection */}
        <div>
          <label htmlFor="bank_id" className="block text-sm font-medium text-gray-700 mb-1">
            Bank <span className="text-red-500">*</span>
          </label>
          <select
            id="bank_id"
            {...form.register('bank_id', { valueAsNumber: true })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={0}>Select bank</option>
            {options.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.bank_code} - {bank.bank_name}
              </option>
            ))}
          </select>
          {form.formState.errors.bank_id && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.bank_id.message}</p>
          )}
        </div>

        {/* Account Name */}
        <div>
          <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 mb-1">
            Account Name <span className="text-red-500">*</span>
          </label>
          <input
            id="account_name"
            type="text"
            {...form.register('account_name')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., PT Suryamas Lestari"
          />
          {form.formState.errors.account_name && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.account_name.message}</p>
          )}
        </div>

        {/* Account Number */}
        <div>
          <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 mb-1">
            Account Number <span className="text-red-500">*</span>
          </label>
          <input
            id="account_number"
            type="text"
            {...form.register('account_number')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            placeholder="e.g., 1234567890"
          />
          {form.formState.errors.account_number && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.account_number.message}</p>
          )}
        </div>

        {/* Currency (Readonly) */}
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <input
            id="currency"
            type="text"
            value="IDR"
            disabled
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* Primary Toggle */}
        <div className="flex items-center">
          <input
            id="is_primary"
            type="checkbox"
            {...form.register('is_primary')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is_primary" className="ml-2 block text-sm text-gray-700">
            Set as primary account
          </label>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            id="is_active"
            type="checkbox"
            {...form.register('is_active')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
            Active
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>

      {/* Primary Confirmation Modal */}
      <ConfirmModal
        isOpen={showPrimaryConfirm}
        onClose={() => {
          setShowPrimaryConfirm(false)
          setPendingData(null)
        }}
        onConfirm={handlePrimaryConfirm}
        title="Set as Primary?"
        message="This will replace the current primary account. Continue?"
        confirmText="Yes, Set as Primary"
        variant="warning"
        isLoading={isLoading}
      />
    </>
  )
}
