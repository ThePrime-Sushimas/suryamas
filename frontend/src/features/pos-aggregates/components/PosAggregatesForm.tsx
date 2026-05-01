/**
 * PosAggregatesForm.tsx
 * 
 * Form component for creating and editing aggregated transactions.
 * Uses React Hook Form with validation.
 */

import { useEffect, useState, useCallback } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { useBranchesStore } from '@/features/branches/store/branches.store'
import { posAggregatesApi } from '../api/posAggregates.api'

import {
  posAggregatesFormSchema,
  type PosAggregatesFormData,
} from "./posAggregatesForm.schema"

import {
  mapFormToCreateDto,
  mapFormToUpdateDto,
} from "./posAggregates.mapper"

import type { 
  AggregatedTransactionListItem, 
  AggregatedTransaction, 
  CreateAggregatedTransactionDto, 
  UpdateAggregatedTransactionDto,
  PaymentMethodOption 
} from '../types'

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

// =============================================================================
// PROPS
// =============================================================================

type PosAggregatesFormProps =
  | {
      mode: 'create'
      transaction?: AggregatedTransactionListItem | AggregatedTransaction | null
      onSubmit: (data: CreateAggregatedTransactionDto) => Promise<void>
      onCancel: () => void
      isLoading?: boolean
    }
  | {
      mode: 'edit'
      transaction?: AggregatedTransactionListItem | AggregatedTransaction | null
      onSubmit: (data: UpdateAggregatedTransactionDto) => Promise<void>
      onCancel: () => void
      isLoading?: boolean
    }

// Removed duplicate inline type - using imported PosAggregatesFormData from schema

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Form component for creating and editing aggregated transactions.
 * Uses discriminated union props for strict typing on onSubmit based on mode.
 */
export function PosAggregatesForm(props: PosAggregatesFormProps) {
  const { mode, transaction, onSubmit, onCancel, isLoading = false } = props
  const { branches, fetchPage: fetchBranches, loading: loadingBranches } = useBranchesStore()
// Removed showErrors state - Zod handles validation display automatically
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([])

  // React Hook Form
  const {
    handleSubmit,
    control,
    reset,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PosAggregatesFormData>({
    resolver: zodResolver(posAggregatesFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      branch_id: null,
      source_type: "POS",
      source_id: "",
      source_ref: "",
      transaction_date: new Date().toISOString().split("T")[0],
      payment_method_id: undefined as any as number,

      gross_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      service_charge_amount: 0,
      other_vat_amount: 0,
      bill_after_discount: 0,
      delivery_cost: 0,
      order_fee: 0,
      promotion_discount_amount: 0,
      voucher_discount_amount: 0,
      percentage_fee_amount: 0,
      fixed_fee_amount: 0,
      total_fee_amount: 0,
      nett_amount: 0,

      currency: "IDR",
      status: "READY",
    },
  })

  // Form values for reactive calculation and display
  const grossAmount = watch("gross_amount", 0)
  const discountAmount = watch("discount_amount", 0)
  const taxAmount = watch("tax_amount", 0)
  const serviceChargeAmount = watch("service_charge_amount", 0)
  const otherVatAmount = watch("other_vat_amount", 0)
  const promoDiscountAmount = watch("promotion_discount_amount", 0)
  const voucherDiscountAmount = watch("voucher_discount_amount", 0)
  const deliveryCost = watch("delivery_cost", 0)
  const orderFee = watch("order_fee", 0)

// Removed manual watch/parseCurrency - using Controller for number fields handles this

// Fee fields (from form state)
  const percentageFeeAmount = watch("percentage_fee_amount", 0)
  const fixedFeeAmount = watch("fixed_fee_amount", 0)
  const totalFeeAmount = watch("total_fee_amount", 0)
  
  // Calculate percentage for display
  const percentageFeeDisplay = (
    (percentageFeeAmount / (grossAmount || 1)) * 100
  ).toFixed(2)

  // Reactive calculation for Bill After Discount and Nett Amount
  useEffect(() => {
    const billAfterDiscount = grossAmount + taxAmount + serviceChargeAmount + otherVatAmount + deliveryCost + orderFee
      - discountAmount - promoDiscountAmount - voucherDiscountAmount
    const newNettAmount = billAfterDiscount - totalFeeAmount
    
    setValue("nett_amount", newNettAmount)
    setValue("bill_after_discount", billAfterDiscount)
  }, [grossAmount, taxAmount, serviceChargeAmount, otherVatAmount, discountAmount, promoDiscountAmount, voucherDiscountAmount, deliveryCost, orderFee, totalFeeAmount, setValue])

  // Net amount from backend (already calculated correctly)

  // Fetch branches on mount (skip if already loaded)
  useEffect(() => {
    if (branches.length === 0) {
      fetchBranches(1, 1000, { field: 'branch_name', order: 'asc' }, { status: 'active' })
    }
  }, [fetchBranches, branches.length])

  // Fetch payment methods on mount (skip if already loaded)
  useEffect(() => {
    if (paymentMethods.length > 0) return
    const fetchPaymentMethods = async () => {
      try {
        const methods = await posAggregatesApi.getPaymentMethodOptions()
        setPaymentMethods(methods)
      } catch (error) {
        console.error('Failed to fetch payment methods:', error)
      }
    }

    fetchPaymentMethods()
  }, [])

  // Reset logic (EDIT MODE normalization - explicit mapping)
  useEffect(() => {
    if (transaction) {
      reset({
        branch_id: transaction.branch_id ?? null,
        source_type: "POS",
        source_id: transaction.source_id ?? "",
        source_ref: transaction.source_ref ?? "",
        transaction_date: transaction.transaction_date?.split("T")[0] ?? "",
        payment_method_id:
          typeof transaction.payment_method_id === "string"
            ? Number(transaction.payment_method_id)
            : (transaction.payment_method_id ?? undefined) as any as number,

        gross_amount: transaction.gross_amount ?? 0,
        discount_amount: transaction.discount_amount ?? 0,
        tax_amount: transaction.tax_amount ?? 0,
        service_charge_amount: transaction.service_charge_amount ?? 0,
        other_vat_amount: transaction.other_vat_amount ?? 0,
        bill_after_discount: transaction.bill_after_discount ?? 0,
        delivery_cost: transaction.delivery_cost ?? 0,
        order_fee: transaction.order_fee ?? 0,
        promotion_discount_amount: transaction.promotion_discount_amount ?? 0,
        voucher_discount_amount: transaction.voucher_discount_amount ?? 0,
        percentage_fee_amount: transaction.percentage_fee_amount ?? 0,
        fixed_fee_amount: transaction.fixed_fee_amount ?? 0,
        total_fee_amount: transaction.total_fee_amount ?? 0,
        nett_amount: transaction.nett_amount ?? 0,

        currency: transaction.currency ?? "IDR",
        status: transaction.status ?? "READY",
      })
    }
  }, [transaction, reset])

  // Resolve branch_id from branch_name when branch_id is null
  useEffect(() => {
    if (!transaction || transaction.branch_id || branches.length === 0) return
    if (!transaction.branch_name) return
    const found = branches.find(b => b.branch_name.trim().toLowerCase() === transaction.branch_name!.trim().toLowerCase())
    if (found) setValue('branch_id', found.id, { shouldValidate: true, shouldDirty: true })
  }, [transaction, branches, setValue])

  // Submit Handler
  const handleFormSubmit = useCallback(async (data: PosAggregatesFormData) => {
      if (mode === "create") {
        await (onSubmit as (data: CreateAggregatedTransactionDto) => Promise<void>)(mapFormToCreateDto(data))
      } else {
        await (onSubmit as (data: UpdateAggregatedTransactionDto) => Promise<void>)(mapFormToUpdateDto(data))
      }
    },
    [mode, onSubmit]
  )

  // Handle cancel
  const handleCancel = useCallback(() => {
    reset()
    onCancel()
  }, [reset, onCancel])


  return (
    <form onSubmit={handleSubmit(handleFormSubmit as any)} className="space-y-6">
      {/* Source Information Section */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Informasi Sumber</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Source Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipe Sumber <span className="text-red-500">*</span>
            </label>
            <select
              {...register('source_type')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.source_type ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              disabled={!!transaction}
            >
              <option value="POS">POS</option>
            </select>
{errors.source_type && (
              <p className="mt-1 text-sm text-red-500">{errors.source_type.message}</p>
            )}
          </div>

          {/* Source ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ID Sumber <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('source_id')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.source_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="ID import POS"
              disabled={!!transaction}
            />
            {errors.source_id && (
              <p className="mt-1 text-sm text-red-500">{errors.source_id.message}</p>
            )}
          </div>

          {/* Source Ref */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Referensi Sumber <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('source_ref')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.source_ref ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Nomor bill"
            />
            {errors.source_ref && (
              <p className="mt-1 text-sm text-red-500">{errors.source_ref.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Details Section */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detail Transaksi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Transaction Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Transaksi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('transaction_date')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.transaction_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
            />
            {errors.transaction_date && (
              <p className="mt-1 text-sm text-red-500">{errors.transaction_date.message}</p>
            )}
          </div>

          {/* Branch Name - Read-only when editing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Cabang <span className="text-red-500">*</span>
            </label>
            <Controller
              name="branch_id"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.branch_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                  disabled={loadingBranches || !!transaction}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.branch_id && (
              <p className="mt-1 text-sm text-red-500">{errors.branch_id.message}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <Controller
              name="payment_method_id"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                >
                  <option value="">-- Pilih Metode Pembayaran --</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.payment_method_id && (
              <p className="text-red-500 text-sm">
                {errors.payment_method_id.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Amount Details Section */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detail Jumlah</h3>
  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Gross Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Jumlah Kotor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller
                name="gross_amount"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    step="0.01"
                    min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.gross_amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                  />
                )}
              />
            </div>
            {errors.gross_amount && (
              <p className="mt-1 text-sm text-red-500">{errors.gross_amount.message}</p>
            )}
          </div>

          {/* Discount Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Potongan
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller
                name="discount_amount"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    step="0.01"
                    min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              />
            </div>
          </div>

          {/* Tax Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pajak
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller
                name="tax_amount"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    step="0.01"
                    min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              />
            </div>
          </div>

          {/* Service Charge Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Service Charge
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller
                name="service_charge_amount"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    step="0.01"
                    min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              />
            </div>
          </div>

          {/* Net Amount (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Jumlah Bersih <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller
                name="nett_amount"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    readOnly
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  />
                )}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Otomatis dihitung</p>
          </div>
        </div>
      </div>

      {/* Additional Fields Section */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detail Tambahan</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Promo Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Promo Discount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller name="promotion_discount_amount" control={control}
                render={({ field }) => (
                  <input type="number" {...field} step="0.01" min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )} />
            </div>
          </div>

          {/* Voucher Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voucher Discount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller name="voucher_discount_amount" control={control}
                render={({ field }) => (
                  <input type="number" {...field} step="0.01" min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )} />
            </div>
          </div>

          {/* Delivery Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Cost</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller name="delivery_cost" control={control}
                render={({ field }) => (
                  <input type="number" {...field} step="0.01" min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )} />
            </div>
          </div>

          {/* Order Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order Fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller name="order_fee" control={control}
                render={({ field }) => (
                  <input type="number" {...field} step="0.01" min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )} />
            </div>
          </div>

          {/* Other VAT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Other VAT</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <Controller name="other_vat_amount" control={control}
                render={({ field }) => (
                  <input type="number" {...field} step="0.01" min="0"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )} />
            </div>
          </div>
        </div>
      </div>

      {/* Fee Details Section */}
      <div className="rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detail Biaya (Fee)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Percentage Fee (Rp) - Read-only (from payment method) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fee Amount (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(percentageFeeAmount)}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ({percentageFeeDisplay}% dari gross)
            </p>
          </div>

          {/* Fixed Fee - Read-only (from payment method) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fixed Fee
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(fixedFeeAmount)}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>

          {/* Total Fee (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Fee
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(totalFeeAmount)}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-200 font-medium"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Otomatis dari Payment Method</p>
          </div>

          {/* Bill After Discount (Reference) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bill After Discount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input
                type="text"
                value={formatRupiah(watch("bill_after_discount"))}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Referensi</p>
          </div>
        </div>
      </div>

      {/* Status (for edit mode) */}
      {transaction && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status Transaksi
              </label>
              {watch('status') === 'SUPERSEDED' ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">SUPERSEDED</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">— dikelola sistem</span>
                </div>
              ) : (
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="READY">READY</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mata Uang
              </label>
              <input
                type="text"
                {...register('currency')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="IDR"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
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

