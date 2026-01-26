/**
 * PosAggregatesForm.tsx
 * 
 * Form component for creating and editing aggregated transactions.
 * Uses React Hook Form with validation.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useBranchContextStore } from '@/features/branch_context'
import { useBranchesStore } from '@/features/branches/store/branches.store'
import { posAggregatesApi } from '../api/posAggregates.api'
import type { AggregatedTransaction, CreateAggregatedTransactionDto, UpdateAggregatedTransactionDto, PaymentMethodOption } from '../types'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format number to Indonesian Rupiah format (without currency symbol)
 */
const formatRupiah = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Parse currency string to number
 */
const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^0-9]/g, '')) || 0
}

// =============================================================================
// PROPS
// =============================================================================

interface PosAggregatesFormProps {
  transaction?: AggregatedTransaction | null
  onSubmit: (data: CreateAggregatedTransactionDto | UpdateAggregatedTransactionDto) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Form component for creating and editing aggregated transactions
 */
export const PosAggregatesForm: React.FC<PosAggregatesFormProps> = ({
  transaction,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  const { branches, fetchBranches, loading: loadingBranches } = useBranchesStore()
  const [showErrors, setShowErrors] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    control,
    setValue,
  } = useForm<CreateAggregatedTransactionDto>({
    defaultValues: {
      company_id: currentBranch?.company_id || '',
      branch_name: null,
      source_type: 'POS',
      source_id: '',
      source_ref: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method_id: 0,
      gross_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      service_charge_amount: 0,
      net_amount: 0,
      currency: 'IDR',
      status: 'READY',
    },
  })

  // Watch fields for calculations
  const watchedFields = watch(['gross_amount', 'discount_amount', 'tax_amount', 'service_charge_amount'])
  const [grossAmount, discountAmount, taxAmount, serviceChargeAmount] = watchedFields.map((v) => parseFloat(String(v)) || 0)

  // Calculate net amount automatically
  const netAmount = useMemo(() => {
    return grossAmount + taxAmount + serviceChargeAmount - discountAmount
  }, [grossAmount, taxAmount, serviceChargeAmount, discountAmount])

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches(1, 1000, { field: 'branch_name', order: 'asc' }, { status: 'active' })
  }, [fetchBranches])

  // Fetch payment methods on mount
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      setLoadingPaymentMethods(true)
      try {
        const methods = await posAggregatesApi.getPaymentMethodOptions()
        setPaymentMethods(methods)
      } catch (error) {
        console.error('Failed to fetch payment methods:', error)
      } finally {
        setLoadingPaymentMethods(false)
      }
    }

    fetchPaymentMethods()
  }, [])

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      reset({
        company_id: transaction.company_id,
        branch_name: transaction.branch_name,
        source_type: transaction.source_type,
        source_id: transaction.source_id,
        source_ref: transaction.source_ref,
        transaction_date: transaction.transaction_date.split('T')[0],
        payment_method_id: transaction.payment_method_id,
        gross_amount: transaction.gross_amount,
        discount_amount: transaction.discount_amount,
        tax_amount: transaction.tax_amount,
        service_charge_amount: transaction.service_charge_amount,
        net_amount: transaction.net_amount,
        currency: transaction.currency,
        status: transaction.status,
      })
    } else {
      reset({
        company_id: currentBranch?.company_id || '',
        branch_name: null,
        source_type: 'POS',
        source_id: '',
        source_ref: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method_id: 0,
        gross_amount: 0,
        discount_amount: 0,
        tax_amount: 0,
        service_charge_amount: 0,
        net_amount: 0,
        currency: 'IDR',
        status: 'READY',
      })
    }
  }, [transaction, reset, currentBranch?.company_id])

  // Form submission handler
  const handleFormSubmit = useCallback(async (data: CreateAggregatedTransactionDto) => {
    setShowErrors(true)
    
    const submitData: CreateAggregatedTransactionDto | UpdateAggregatedTransactionDto = {
      ...data,
      company_id: data.company_id || currentBranch?.company_id,
      net_amount: netAmount,
      payment_method_id: typeof data.payment_method_id === 'string' && parseInt(data.payment_method_id) 
        ? parseInt(data.payment_method_id) 
        : (data.payment_method_id as number),
    }

    await onSubmit(submitData)
  }, [onSubmit, netAmount, currentBranch?.company_id])

  // Handle cancel
  const handleCancel = useCallback(() => {
    reset()
    onCancel()
  }, [reset, onCancel])

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Hidden company_id field */}
      <input type="hidden" {...register('company_id')} />

      {/* Source Information Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Informasi Sumber</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Source Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipe Sumber <span className="text-red-500">*</span>
            </label>
            <select
              {...register('source_type', {
                required: 'Tipe sumber wajib dipilih',
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.source_type ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={!!transaction}
            >
              <option value="POS">POS</option>
            </select>
            {errors.source_type && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.source_type.message}</p>
            )}
          </div>

          {/* Source ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Sumber <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('source_id', {
                required: 'ID sumber wajib diisi',
                maxLength: { value: 100, message: 'Maksimal 100 karakter' },
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.source_id ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="ID import POS"
              disabled={!!transaction}
            />
            {errors.source_id && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.source_id.message}</p>
            )}
          </div>

          {/* Source Ref */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referensi Sumber <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('source_ref', {
                required: 'Referensi sumber wajib diisi',
                maxLength: { value: 100, message: 'Maksimal 100 karakter' },
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.source_ref ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Nomor bill"
            />
            {errors.source_ref && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.source_ref.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Details Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Transaksi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Transaction Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Transaksi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('transaction_date', {
                required: 'Tanggal transaksi wajib diisi',
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.transaction_date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.transaction_date && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.transaction_date.message}</p>
            )}
          </div>

          {/* Branch Name - Read-only when editing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Cabang <span className="text-red-500">*</span>
            </label>
            <Controller
              name="branch_name"
              control={control}
              rules={{
                required: 'Nama cabang wajib dipilih',
              }}
              render={({ field }) => (
                <select
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.branch_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loadingBranches || !!transaction}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.branch_name}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.branch_name && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.branch_name.message}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <Controller
              name="payment_method_id"
              control={control}
              rules={{
                required: 'Metode pembayaran wajib dipilih',
                min: { value: 1, message: 'Metode pembayaran wajib dipilih' },
              }}
              render={({ field }) => (
                <select
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.payment_method_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loadingPaymentMethods}
                >
                  <option value={0}>-- Pilih Metode Pembayaran --</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.code} - {method.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.payment_method_id && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.payment_method_id.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Amount Details Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Jumlah</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Gross Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah Kotor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(grossAmount)}
                onChange={(e) => setValue('gross_amount', parseCurrency(e.target.value))}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.gross_amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            <input type="hidden" {...register('gross_amount', { valueAsNumber: true })} />
            {errors.gross_amount && showErrors && (
              <p className="mt-1 text-sm text-red-500">{errors.gross_amount.message}</p>
            )}
          </div>

          {/* Discount Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Potongan
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(discountAmount)}
                onChange={(e) => setValue('discount_amount', parseCurrency(e.target.value))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input type="hidden" {...register('discount_amount', { valueAsNumber: true })} />
          </div>

          {/* Tax Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pajak
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(taxAmount)}
                onChange={(e) => setValue('tax_amount', parseCurrency(e.target.value))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input type="hidden" {...register('tax_amount', { valueAsNumber: true })} />
          </div>

          {/* Service Charge Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Charge
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(serviceChargeAmount)}
                onChange={(e) => setValue('service_charge_amount', parseCurrency(e.target.value))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input type="hidden" {...register('service_charge_amount', { valueAsNumber: true })} />
          </div>

          {/* Net Amount (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah Bersih <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(netAmount)}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
              />
            </div>
            <input type="hidden" {...register('net_amount', { valueAsNumber: true })} />
            <p className="mt-1 text-xs text-gray-500">Otomatis dihitung</p>
          </div>
        </div>
      </div>

      {/* Status (for edit mode) */}
      {transaction && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Transaksi
              </label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="READY">READY</option>
                <option value="PENDING">PENDING</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mata Uang
              </label>
              <input
                type="text"
                {...register('currency')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="IDR"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {transaction ? 'Perbarui' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesForm

