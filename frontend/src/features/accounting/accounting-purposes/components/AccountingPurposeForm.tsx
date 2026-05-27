import { useState, useMemo } from 'react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
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
  const branches = useBranchContextStore(s => s.branches)
  const [formData, setFormData] = useState({
    purpose_code: initialData?.purpose_code || '',
    purpose_name: initialData?.purpose_name || '',
    applied_to: (initialData?.applied_to || 'SALES') as AppliedToType,
    description: initialData?.description || '',
    is_active: initialData?.is_active ?? true,
    branch_id: initialData?.branch_id || ''
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})

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
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Purpose Sistem</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Ini adalah purpose yang didefinisikan sistem dan tidak bisa diubah.
          </p>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-600 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              Kembali
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
          <label htmlFor="purpose_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Kode Purpose *
          </label>
          <input
            id="purpose_code"
            name="purpose_code"
            type="text"
            value={formData.purpose_code}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isEdit || isLoading}
            maxLength={50}
            placeholder="cth: SALES_INVOICE"
            aria-invalid={!!errors.purpose_code}
          />
          {isEdit && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Kode purpose tidak bisa diubah</p>
          )}
          {errors.purpose_code && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.purpose_code}</p>
          )}
        </div>

        <div>
          <label htmlFor="purpose_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Purpose *
          </label>
          <input
            id="purpose_name"
            name="purpose_name"
            type="text"
            value={formData.purpose_name}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
            maxLength={255}
            placeholder="cth: Invoice Penjualan"
            aria-invalid={!!errors.purpose_name}
          />
          {errors.purpose_name && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.purpose_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="applied_to" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Diterapkan Pada *
          </label>
          <select
            id="applied_to"
            name="applied_to"
            value={formData.applied_to}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
            aria-invalid={!!errors.applied_to}
          >
            {APPLIED_TO_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Menentukan tipe transaksi yang menggunakan purpose ini
          </p>
          {errors.applied_to && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.applied_to}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Cabang
        </label>
        <select
          id="branch_id"
          name="branch_id"
          value={formData.branch_id}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isLoading}
          aria-invalid={!!errors.branch_id}
        >
          <option value="">Semua Cabang</option>
          {branches.map(branch => (
            <option key={branch.branch_id} value={branch.branch_id}>
              {branch.branch_name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Kosongkan untuk berlaku di semua cabang, atau pilih cabang tertentu
        </p>
        {errors.branch_id && (
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.branch_id}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Deskripsi
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isLoading}
          maxLength={500}
          placeholder="Deskripsi opsional untuk purpose ini..."
        />
        {errors.description && (
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.description}</p>
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
            className="mr-2 w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700"
            disabled={isLoading}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aktif</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          Hanya purpose aktif yang bisa digunakan dalam transaksi
        </p>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || Object.keys(errors).length > 0}
          className="flex-1 bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? 'Menyimpan...' : isEdit ? 'Update Purpose' : 'Buat Purpose'}
        </button>
      </div>
    </form>
  )
}
