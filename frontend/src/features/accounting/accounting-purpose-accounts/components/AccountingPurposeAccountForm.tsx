import { useForm, useWatch } from 'react-hook-form'
import { useMemo, useEffect } from 'react'
import type { CreateAccountingPurposeAccountDto, UpdateAccountingPurposeAccountDto } from '../types/accounting-purpose-account.types'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { SIDES, FIELD_MAPPING_OPTIONS } from '../constants/accounting-purpose-account.constants'
import { validateSideBalance } from '../utils/validation'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

interface AccountingPurposeAccountFormProps {
  initialData?: UpdateAccountingPurposeAccountDto & { purpose_id?: string; account_id?: string }
  onSubmit: (data: CreateAccountingPurposeAccountDto | UpdateAccountingPurposeAccountDto) => Promise<void>
  onCancel: () => void
  isEdit?: boolean
  editInfo?: {
    purpose_code: string
    purpose_name: string
    account_code: string
    account_name: string
    side: string
  }
}

export const AccountingPurposeAccountForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isEdit = false,
  editInfo,
}: AccountingPurposeAccountFormProps) => {
  const { postableAccounts, activePurposes, loading } = useAccountingPurposeAccountsStore()
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const branches = useBranchContextStore(s => s.branches)
  const activeCompanyId = currentBranch?.company_id ?? branches[0]?.company_id
  
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm({
    defaultValues: initialData
  })

  // Reset form when company changes (only for create mode)
  useEffect(() => {
    if (!isEdit && activeCompanyId) {
      reset({
        purpose_id: '',
        account_id: '',
        side: undefined,
        priority: undefined,
        is_active: true
      })
    }
  }, [activeCompanyId, isEdit, reset])

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
      {isEdit && editInfo && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Informasi Mapping</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Purpose: </span>
              <span className="font-medium text-gray-900 dark:text-white">{editInfo.purpose_code} — {editInfo.purpose_name}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Side: </span>
              <span className={`font-medium ${editInfo.side === 'DEBIT' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>{editInfo.side}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Account: </span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{editInfo.account_code}</span>
              <span className="text-gray-600 dark:text-gray-300 ml-1">— {editInfo.account_name}</span>
            </div>
          </div>
        </div>
      )}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Purpose <span className="text-red-500">*</span>
          </label>
          <select
            {...register('purpose_id')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Pilih Purpose</option>
            {purposeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.purpose_id && (
            <p className="mt-1 text-sm text-red-600">{String(errors.purpose_id.message || 'Purpose wajib diisi')}</p>
          )}
        </div>
      )}

      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Akun <span className="text-red-500">*</span>
          </label>
          <select
            {...register('account_id')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Pilih Akun</option>
            {accountOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.account_id && (
            <p className="mt-1 text-sm text-red-600">{String(errors.account_id.message || 'Akun wajib diisi')}</p>
          )}
          {selectedAccount && (
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <p>Saldo Normal: <span className="font-medium">{selectedAccount.normal_balance}</span></p>
              {sideValidation.warning && (
                <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                  ⚠️ {sideValidation.warning}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Sisi <span className="text-red-500">*</span>
        </label>
        <select
          {...register('side')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Pilih Sisi</option>
          {SIDES.map(side => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </select>
        {errors.side && (
          <p className="mt-1 text-sm text-red-600">{String(errors.side.message || 'Sisi wajib diisi')}</p>
        )}
        {sideValidation.warning && (
          <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ {sideValidation.warning}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioritas (Opsional)</label>
        <input
          type="number"
          min="1"
          max="999"
          {...register('priority', { 
            setValueAs: (value) => value === '' || value === null ? undefined : Number(value)
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Kosongkan untuk auto-assign"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Jika kosong, sistem akan otomatis menentukan prioritas berikutnya</p>
        {errors.priority && (
          <p className="mt-1 text-sm text-red-600">{String(errors.priority.message || 'Invalid priority')}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Mapping (Opsional)</label>
        <select
          {...register('field_mapping', {
            setValueAs: (value) => value === '' ? null : value
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Tidak ada mapping</option>
          {FIELD_MAPPING_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Digunakan oleh prosesor jurnal untuk mapping field POS ke akun COA</p>
      </div>

      {isEdit && (
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('is_active')}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Aktif</span>
          </label>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loading.submit}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting || loading.submit ? 'Menyimpan...' : isEdit ? 'Update' : 'Buat'}
        </button>
      </div>
    </form>
  )
}
