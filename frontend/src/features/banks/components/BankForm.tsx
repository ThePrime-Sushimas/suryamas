import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bankSchema, type BankFormData } from '../schemas/bank.schema'
import type { Bank } from '../types'

interface BankFormProps {
  initialData?: Bank
  onSubmit: SubmitHandler<BankFormData>
  isLoading?: boolean
}

export const BankForm = ({ initialData, onSubmit, isLoading }: BankFormProps) => {
  const form = useForm<BankFormData>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      bank_code: initialData?.bank_code ?? '',
      bank_name: initialData?.bank_name ?? '',
      is_active: initialData?.is_active ?? true,
    },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Bank Code */}
      <div>
        <label htmlFor="bank_code" className="block text-sm font-medium text-gray-700 mb-1">
          Bank Code <span className="text-red-500">*</span>
        </label>
        <input
          id="bank_code"
          type="text"
          disabled={!!initialData}
          {...form.register('bank_code')}
          onChange={(e) => e.target.value = e.target.value.toUpperCase()}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="e.g., BCA, MANDIRI"
        />
        {form.formState.errors.bank_code && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.bank_code.message}</p>
        )}
      </div>

      {/* Bank Name */}
      <div>
        <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-1">
          Bank Name <span className="text-red-500">*</span>
        </label>
        <input
          id="bank_name"
          type="text"
          {...form.register('bank_name')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Bank Central Asia"
        />
        {form.formState.errors.bank_name && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.bank_name.message}</p>
        )}
      </div>

      {/* Active Status */}
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

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => window.history.back()}
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
  )
}
