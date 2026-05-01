import { useEffect, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bankAccountSchema, type BankAccountFormData } from '../schemas/bankAccount.schema'
import { useBanksStore } from '@/features/banks/store/useBanks'
import { useBankAccountsStore } from '../store/useBankAccounts'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { BankAccount } from '../types'

interface BankAccountFormProps {
  initialData?: BankAccount
  onSubmit: SubmitHandler<BankAccountFormData>
  onCancel: () => void
  isLoading?: boolean
  companyId?: string
}

export const BankAccountForm = ({ initialData, onSubmit, onCancel, isLoading, companyId }: BankAccountFormProps) => {
  const { options, fetchOptions } = useBanksStore()
  const { coaOptions, fetchCoaOptions } = useBankAccountsStore()
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
      coa_account_id: initialData?.coa_account_id ?? null,
    },
  })

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  useEffect(() => {
    if (companyId) {
      fetchCoaOptions(companyId)
    }
  }, [companyId, fetchCoaOptions])

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
        <div>
          <label htmlFor="bank_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bank <span className="text-red-500">*</span>
          </label>
          <select
            id="bank_id"
            defaultValue={initialData?.bank_name ?? 0}
            {...form.register('bank_id', { valueAsNumber: true })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={0}>Pilih bank</option>
            {options.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.bank_code} - {bank.bank_name}
              </option>
            ))}
          </select>
          {form.formState.errors.bank_id && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.formState.errors.bank_id.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Rekening <span className="text-red-500">*</span>
          </label>
          <input
            id="account_name"
            type="text"
            {...form.register('account_name')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="cth. PT Suryamas Lestari"
          />
          {form.formState.errors.account_name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.formState.errors.account_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nomor Rekening <span className="text-red-500">*</span>
          </label>
          <input
            id="account_number"
            type="text"
            {...form.register('account_number')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="cth. 1234567890"
          />
          {form.formState.errors.account_number && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.formState.errors.account_number.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mata Uang
          </label>
          <input
            id="currency"
            type="text"
            value="IDR"
            disabled
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="coa_account_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Akun COA (Opsional)
          </label>
          <select
            id="coa_account_id"
            value={form.watch('coa_account_id') ?? ''}
            onChange={(e) => {
              const value = e.target.value
              form.setValue('coa_account_id', value === '' ? null : value)
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Pilih akun COA</option>
            {coaOptions.map((coa) => (
              <option key={coa.id} value={coa.id}>
                {coa.account_code} - {coa.account_name}
              </option>
            ))}
          </select>
          {form.formState.errors.coa_account_id && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.formState.errors.coa_account_id.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Hubungkan ke Chart of Accounts untuk integrasi akuntansi
          </p>
        </div>

        <div className="flex items-center">
          <input
            id="is_primary"
            type="checkbox"
            {...form.register('is_primary')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
          />
          <label htmlFor="is_primary" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Jadikan rekening utama
          </label>
        </div>

        <div className="flex items-center">
          <input
            id="is_active"
            type="checkbox"
            {...form.register('is_active')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Aktif
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isLoading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showPrimaryConfirm}
        onClose={() => {
          setShowPrimaryConfirm(false)
          setPendingData(null)
        }}
        onConfirm={handlePrimaryConfirm}
        title="Jadikan Rekening Utama?"
        message="Ini akan menggantikan rekening utama saat ini. Lanjutkan?"
        confirmText="Ya, Jadikan Utama"
        variant="warning"
        isLoading={isLoading}
      />
    </>
  )
}
