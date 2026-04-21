import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bankSchema, type BankFormData } from '../schemas/bank.schema'
import type { Bank } from '../types'

const inputCls = "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"

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
      <div>
        <label htmlFor="bank_code" className={labelCls}>Bank Code <span className="text-red-500">*</span></label>
        <input id="bank_code" type="text" disabled={!!initialData}
          {...form.register('bank_code')}
          onChange={(e) => e.target.value = e.target.value.toUpperCase()}
          className={`${inputCls} uppercase ${initialData ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
          placeholder="e.g., BCA, MANDIRI" />
        {form.formState.errors.bank_code && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.formState.errors.bank_code.message}</p>}
      </div>

      <div>
        <label htmlFor="bank_name" className={labelCls}>Bank Name <span className="text-red-500">*</span></label>
        <input id="bank_name" type="text" {...form.register('bank_name')} className={inputCls} placeholder="e.g., Bank Central Asia" />
        {form.formState.errors.bank_name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.formState.errors.bank_name.message}</p>}
      </div>

      <div className="flex items-center">
        <input id="is_active" type="checkbox" {...form.register('is_active')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
        <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Active</label>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button type="button" onClick={() => window.history.back()} disabled={isLoading}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium">
          Cancel
        </button>
        <button type="submit" disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
