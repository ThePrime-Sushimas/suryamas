import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { useBranchContextStore } from '@/features/branch_context'
import api from '@/lib/axios'
import type { PaymentMethod, CreatePaymentMethodDto, UpdatePaymentMethodDto, PaymentType } from '../types'

interface PaymentMethodFormProps {
  paymentMethod?: PaymentMethod | null
  onSubmit: (data: CreatePaymentMethodDto | UpdatePaymentMethodDto) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

interface BankAccountOption {
  id: number
  account_name: string
  account_number: string
  bank_name?: string
}

interface COAOption {
  id: string
  account_code: string
  account_name: string
}

const PAYMENT_TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'COMPLIMENT', label: 'Compliment' },
  { value: 'MEMBER_DEPOSIT', label: 'Member Deposit' },
  { value: 'OTHER_COST', label: 'Other Cost' }
]

export const PaymentMethodForm = ({ 
  paymentMethod, 
  onSubmit, 
  onCancel, 
  isLoading 
}: PaymentMethodFormProps) => {
  const [showErrors, setShowErrors] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [coaAccounts, setCOAAccounts] = useState<COAOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [coaSearch, setCOASearch] = useState('')
  const [showCOADropdown, setShowCOADropdown] = useState(false)
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<CreatePaymentMethodDto>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      payment_type: 'CASH',
      bank_account_id: undefined,
      coa_account_id: undefined,
      is_default: false,
      requires_bank_account: false,
      sort_order: 0,
      // === 🔥 FEE CONFIGURATION DEFAULTS ===
      fee_percentage: 0,
      fee_fixed_amount: 0,
      fee_fixed_per_transaction: false
    }
  })

  const requiresBankAccount = watch('requires_bank_account')
  const selectedCOAId = watch('coa_account_id')
  
  const filteredCOA = coaAccounts.filter(coa => 
    coaSearch === '' || 
    coa.account_code.toLowerCase().includes(coaSearch.toLowerCase()) ||
    coa.account_name.toLowerCase().includes(coaSearch.toLowerCase())
  )
  
  const selectedCOA = coaAccounts.find(coa => coa.id === selectedCOAId)

  useEffect(() => {
    const fetchOptions = async () => {
      if (!currentBranch?.company_id) return
      
      setLoadingOptions(true)
      try {
        const [bankRes, coaRes] = await Promise.all([
          api.get('/bank-accounts', { params: { limit: 100 } }),
          api.get('/chart-of-accounts', { params: { limit: 100, is_postable: true } })
        ])
        
        console.log('Bank accounts response:', bankRes.data)
        console.log('COA response:', coaRes.data)
        
        setBankAccounts(bankRes.data.data || [])
        setCOAAccounts(coaRes.data.data || [])
      } catch (error) {
        console.error('Failed to fetch options:', error)
      } finally {
        setLoadingOptions(false)
      }
    }
    
    fetchOptions()
  }, [currentBranch?.company_id])

  useEffect(() => {
    if (paymentMethod) {
      reset({
        code: paymentMethod.code,
        name: paymentMethod.name,
        description: paymentMethod.description || '',
        payment_type: paymentMethod.payment_type,
        bank_account_id: paymentMethod.bank_account_id || undefined,
        coa_account_id: paymentMethod.coa_account_id || undefined,
        is_default: paymentMethod.is_default,
        requires_bank_account: paymentMethod.requires_bank_account,
        sort_order: paymentMethod.sort_order,
        // === 🔥 FEE CONFIGURATION ===
        fee_percentage: paymentMethod.fee_percentage || 0,
        fee_fixed_amount: paymentMethod.fee_fixed_amount || 0,
        fee_fixed_per_transaction: paymentMethod.fee_fixed_per_transaction || false
      })
    } else {
      reset({
        code: '',
        name: '',
        description: '',
        payment_type: 'CASH',
        bank_account_id: undefined,
        coa_account_id: undefined,
        is_default: false,
        requires_bank_account: false,
        sort_order: 0,
        // === 🔥 FEE CONFIGURATION DEFAULTS ===
        fee_percentage: 0,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })
    }
  }, [paymentMethod, reset])

  const handleFormSubmit = async (data: CreatePaymentMethodDto) => {
    setShowErrors(true)
    
    // Convert empty string to null for numeric fields
    const bankAccountId = data.bank_account_id && !isNaN(Number(data.bank_account_id)) 
      ? Number(data.bank_account_id) 
      : null
    
    const submitData = {
      ...data,
      company_id: currentBranch?.company_id,
      bank_account_id: bankAccountId,
      coa_account_id: data.coa_account_id || null,
      description: data.description || null
    }
    
    console.log('Submitting payment method:', submitData)
    await onSubmit(submitData)
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('code', {
            required: 'Kode wajib diisi',
            maxLength: { value: 20, message: 'Kode maksimal 20 karakter' },
            pattern: {
              value: /^[A-Z0-9_]+$/,
              message: 'Kode hanya boleh berisi huruf besar, angka, dan underscore'
            }
          })}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.code ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g: CASH, BANK_TRANSFER"
          disabled={!!paymentMethod}
        />
        {errors.code && showErrors && (
          <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('name', {
            required: 'Nama wajib diisi',
            maxLength: { value: 100, message: 'Nama maksimal 100 karakter' }
          })}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g: Cash, BCA Bank Transfer"
        />
        {errors.name && showErrors && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Type <span className="text-red-500">*</span>
        </label>
        <select
          {...register('payment_type', {
            required: 'Tipe pembayaran wajib dipilih'
          })}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.payment_type ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          {PAYMENT_TYPE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.payment_type && showErrors && (
          <p className="mt-1 text-sm text-red-500">{errors.payment_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          {...register('description', {
            maxLength: { value: 500, message: 'Deskripsi maksimal 500 karakter' }
          })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Payment method description (optional)"
        />
        {errors.description && showErrors && (
          <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank Account {requiresBankAccount && <span className="text-red-500">*</span>}
        </label>
        <select
          {...register('bank_account_id', {
            valueAsNumber: true,
            validate: (value) => {
              if (requiresBankAccount && !value) {
                return 'Rekening bank wajib dipilih'
              }
              return true
            }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loadingOptions}
        >
          <option value="">-- Select Bank Account (Optional) --</option>
          {bankAccounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.bank_name ? `${acc.bank_name} - ` : ''}{acc.account_number} - {acc.account_name}
            </option>
          ))}
        </select>
        {errors.bank_account_id && showErrors && (
          <p className="mt-1 text-sm text-red-500">{errors.bank_account_id.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Link to specific bank account (for bank-based payment methods)
        </p>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chart of Accounts
        </label>
        <div className="relative">
          <input
            type="text"
            value={selectedCOA ? `${selectedCOA.account_code} - ${selectedCOA.account_name}` : coaSearch}
            onChange={(e) => {
              setCOASearch(e.target.value)
              setShowCOADropdown(true)
              if (!e.target.value) setValue('coa_account_id', '')
            }}
            onFocus={() => setShowCOADropdown(true)}
            placeholder="Search account code or name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loadingOptions}
          />
          {showCOADropdown && filteredCOA.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredCOA.map(coa => (
                <button
                  key={coa.id}
                  type="button"
                  onClick={() => {
                    setValue('coa_account_id', coa.id)
                    setCOASearch('')
                    setShowCOADropdown(false)
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <div className="font-mono text-sm text-gray-900">{coa.account_code}</div>
                  <div className="text-sm text-gray-600">{coa.account_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="hidden" {...register('coa_account_id')} />
        <p className="mt-1 text-xs text-gray-500">
          Link to Chart of Accounts for automatic journal entry posting
        </p>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('requires_bank_account')}
          id="requires_bank_account"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="requires_bank_account" className="ml-2 block text-sm text-gray-700">
          Requires bank account
          <p className="text-xs text-gray-500 mt-0.5">
            Check if this payment method requires a bank account (e.g: Bank Transfer)
          </p>
        </label>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('is_default')}
          id="is_default"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
          Set as default
          <p className="text-xs text-gray-500 mt-0.5">
            Default payment method will be selected automatically
          </p>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sort Order
        </label>
        <input
          type="number"
          {...register('sort_order', {
            valueAsNumber: true,
            min: { value: 0, message: 'Minimum sort order is 0' },
            max: { value: 9999, message: 'Maximum sort order is 9999' }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="0"
        />
        {errors.sort_order && showErrors && (
          <p className="mt-1 text-sm text-red-500">{errors.sort_order.message}</p>
        )}
      </div>

      {/* === 🔥 FEE CONFIGURATION SECTION === */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Fee Configuration
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure fees untuk reconciliation. Fee dihitung saat settlement.
          <br />
          <span className="text-xs">Marketing fee = Expected Net - Actual dari Bank (selisih)</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fee Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fee Percentage (%)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              max="100"
              {...register('fee_percentage', {
                valueAsNumber: true,
                min: { value: 0, message: 'Fee percentage tidak boleh negatif' },
                max: { value: 100, message: 'Fee percentage maksimal 100%' }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
            {errors.fee_percentage && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.fee_percentage.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Persentase biaya (MDR)</p>
          </div>

          {/* Fixed Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fixed Amount (Rp)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              {...register('fee_fixed_amount', {
                valueAsNumber: true,
                min: { value: 0, message: 'Fixed amount tidak boleh negatif' }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
            {errors.fee_fixed_amount && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.fee_fixed_amount.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Jumlah biaya tetap</p>
          </div>

          {/* Per Transaction Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fixed Fee Type
            </label>
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  {...register('fee_fixed_per_transaction')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Per Transaksi
                </span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              ✓ Per tx: Gojek, OVO, Grab
              <br />
              ✗ Per total: QRIS, Card, EDC
            </p>
          </div>
        </div>

        {/* Fee Preview */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Fee Preview:</p>
          <div className="text-sm text-gray-600">
            {(() => {
              const percentage = watch('fee_percentage') || 0
              const fixed = watch('fee_fixed_amount') || 0
              const perTx = watch('fee_fixed_per_transaction') || false
              
              const parts: string[] = []
              if (percentage > 0) parts.push(`${percentage}%`)
              if (fixed > 0) {
                parts.push(perTx ? `Rp ${fixed.toLocaleString()}/tx` : `Rp ${fixed.toLocaleString()}`)
              }
              
              return parts.length > 0 ? parts.join(' + ') : 'Gratis'
            })()}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || loadingOptions}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {paymentMethod ? 'Update' : 'Save'}
        </button>
      </div>
    </form>
  )
}
