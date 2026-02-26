import { useState, useMemo } from 'react'
import { z } from 'zod'
import type { PaymentTerm, CreatePaymentTermDto, CalculationType } from '../types'

const paymentTermSchema = z.object({
  term_code: z.string().min(1, 'Term code is required').max(50, 'Max 50 characters').trim(),
  term_name: z.string().min(1, 'Term name is required').max(100, 'Max 100 characters').trim(),
  calculation_type: z.enum(['from_invoice', 'from_delivery', 'fixed_date', 'fixed_date_immediate', 'weekly', 'monthly']),
  days: z.number().min(0, 'Days must be >= 0').max(999, 'Days must be <= 999'),
  payment_dates: z.array(z.number().refine(val => (val >= 1 && val <= 31) || val === 999, {
    message: 'Payment dates must be 1-31 or 999 (end of month)'
  })).nullable(),
  payment_day_of_week: z.number().min(0).max(6).nullable(),
  early_payment_discount: z.number().min(0, 'Must be >= 0').max(100, 'Must be <= 100'),
  early_payment_days: z.number().min(0, 'Must be >= 0').max(999, 'Must be <= 999'),
  late_payment_penalty: z.number().min(0, 'Must be >= 0').max(100, 'Must be <= 100'),
  grace_period_days: z.number().min(0, 'Must be >= 0').max(999, 'Must be <= 999'),
  minimum_order_amount: z.number().min(0, 'Must be >= 0'),
  maximum_order_amount: z.number().min(0, 'Must be >= 0').nullable(),
  allowed_payment_methods: z.array(z.string()).nullable(),
  is_active: z.boolean(),
  description: z.string().max(500, 'Max 500 characters').nullable()
}).refine((data) => {
  // weekly MUST have payment_day_of_week
  if (data.calculation_type === 'weekly' && data.payment_day_of_week === null) {
    return false
  }
  // fixed_date/fixed_date_immediate/monthly MUST have payment_dates
  if (['fixed_date', 'fixed_date_immediate', 'monthly'].includes(data.calculation_type) && (!data.payment_dates || data.payment_dates.length === 0)) {
    return false
  }
  // from_invoice/from_delivery MUST NOT have payment_dates or payment_day_of_week
  if (['from_invoice', 'from_delivery'].includes(data.calculation_type)) {
    if (data.payment_dates !== null || data.payment_day_of_week !== null) {
      return false
    }
  }
  return true
}, {
  message: 'Invalid field combination for selected calculation type',
  path: ['calculation_type']
})

interface PaymentTermFormProps {
  initialData?: PaymentTerm
  isEdit?: boolean
  onSubmit: (data: CreatePaymentTermDto) => Promise<void>
  isLoading?: boolean
  onCancel?: () => void
}

const CALCULATION_TYPES: { value: CalculationType; label: string }[] = [
  { value: 'from_invoice', label: 'From Invoice Date' },
  { value: 'from_delivery', label: 'From Delivery Date' },
  { value: 'fixed_date', label: 'Fixed Dates (skip if same day)' },
  { value: 'fixed_date_immediate', label: 'Fixed Dates (pay same day if match)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
]

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit Card', 'Check', 'E-Wallet']

export const PaymentTermForm = ({ initialData, isEdit, onSubmit, isLoading, onCancel }: PaymentTermFormProps) => {
  const [formData, setFormData] = useState({
    term_code: initialData?.term_code || '',
    term_name: initialData?.term_name || '',
    calculation_type: (initialData?.calculation_type || 'from_invoice') as CalculationType,
    days: initialData?.days ?? 0,
    payment_dates: initialData?.payment_dates || null,
    payment_day_of_week: initialData?.payment_day_of_week ?? null,
    early_payment_discount: initialData?.early_payment_discount ?? 0,
    early_payment_days: initialData?.early_payment_days ?? 0,
    late_payment_penalty: initialData?.late_payment_penalty ?? 0,
    grace_period_days: initialData?.grace_period_days ?? 0,
    minimum_order_amount: initialData?.minimum_order_amount ?? 0,
    maximum_order_amount: initialData?.maximum_order_amount ?? null,
    allowed_payment_methods: initialData?.allowed_payment_methods || null,
    is_active: initialData?.is_active ?? true,
    description: initialData?.description || null
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [paymentDatesInput, setPaymentDatesInput] = useState(
    formData.payment_dates?.join(', ') || ''
  )
  const [selectedMethods, setSelectedMethods] = useState<string[]>(
    formData.allowed_payment_methods || []
  )

  // Derived state: compute errors from formData (no useEffect needed)
  const errors = useMemo(() => {
    if (Object.keys(touched).length === 0) return {}

    const result = paymentTermSchema.safeParse(formData)
    if (result.success) return {}

    const newErrors: Record<string, string> = {}
    result.error.errors.forEach(err => {
      const field = err.path[0] as string
      if (touched[field]) {
        newErrors[field] = err.message
      }
    })

    return newErrors
  }, [formData, touched])

  const showPaymentDates = ['fixed_date', 'fixed_date_immediate', 'monthly'].includes(formData.calculation_type)
  const showPaymentDayOfWeek = formData.calculation_type === 'weekly'

  // Preview due date calculation
  const getPreviewDueDate = () => {
    const today = new Date()
    const result = new Date(today)

    switch (formData.calculation_type) {
      case 'from_invoice':
      case 'from_delivery':
        result.setDate(result.getDate() + formData.days)
        return result.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

      case 'fixed_date':
        if (formData.payment_dates && formData.payment_dates.length > 0) {
          const currentDay = today.getDate()
          const nextDate = formData.payment_dates.find(d => d > currentDay) || formData.payment_dates[0]
          if (nextDate === 999) {
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            return lastDay.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          }
          result.setDate(nextDate)
          if (nextDate <= currentDay) result.setMonth(result.getMonth() + 1)
          return result.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        }
        return '-'

      case 'fixed_date_immediate':
        if (formData.payment_dates && formData.payment_dates.length > 0) {
          const currentDay = today.getDate()
          const nextDate = formData.payment_dates.find(d => d >= currentDay) || formData.payment_dates[0]
          if (nextDate === 999) {
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            return lastDay.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          }
          result.setDate(nextDate)
          if (nextDate < currentDay) result.setMonth(result.getMonth() + 1)
          return result.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        }
        return '-'

      case 'weekly':
        if (formData.payment_day_of_week !== null) {
          const daysUntil = (formData.payment_day_of_week - today.getDay() + 7) % 7 || 7
          result.setDate(result.getDate() + daysUntil)
          return result.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        }
        return '-'

      case 'monthly':
        if (formData.payment_dates && formData.payment_dates.length > 0) {
          const targetDay = formData.payment_dates[0]
          if (targetDay === 999) {
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0)
            return lastDay.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          }
          result.setMonth(result.getMonth() + 1)
          result.setDate(targetDay)
          return result.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        }
        return '-'

      default:
        return '-'
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target
    let value: string | number | boolean = e.target.value

    if (type === 'checkbox') {
      value = (e.target as HTMLInputElement).checked
    } else if (type === 'number') {
      value = e.target.value === '' ? 0 : parseFloat(e.target.value)
    }

    // Auto-clear irrelevant fields when calculation_type changes
    if (name === 'calculation_type') {
      const newType = value as CalculationType
      setFormData(prev => ({
        ...prev,
        calculation_type: newType,
        // Clear payment_dates if not fixed_date/fixed_date_immediate/monthly
        payment_dates: ['fixed_date', 'fixed_date_immediate', 'monthly'].includes(newType) ? prev.payment_dates : null,
        // Set payment_day_of_week: default to 1 (Monday) if weekly, else null
        payment_day_of_week: newType === 'weekly' ? (prev.payment_day_of_week ?? 1) : null,
        // Set days to 0 if not from_invoice/from_delivery
        days: ['from_invoice', 'from_delivery'].includes(newType) ? prev.days : 0
      }))
      if (!['fixed_date', 'fixed_date_immediate', 'monthly'].includes(newType)) {
        setPaymentDatesInput('')
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }))
    }
    
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setTouched(prev => ({ ...prev, [e.target.name]: true }))
  }

  const handlePaymentDatesChange = (value: string) => {
    setPaymentDatesInput(value)
    if (value.trim() === '') {
      setFormData(prev => ({ ...prev, payment_dates: null }))
    } else {
      // Strict validation: 1-31 or 999 only
      const dates = value.split(',').map(d => parseInt(d.trim())).filter(d => {
        if (isNaN(d)) return false
        return (d >= 1 && d <= 31) || d === 999
      })
      setFormData(prev => ({ ...prev, payment_dates: dates.length > 0 ? dates : null }))
    }
    setTouched(prev => ({ ...prev, payment_dates: true }))
  }

  const handleMethodToggle = (method: string) => {
    const updated = selectedMethods.includes(method)
      ? selectedMethods.filter(m => m !== method)
      : [...selectedMethods, method]
    setSelectedMethods(updated)
    setFormData(prev => ({ ...prev, allowed_payment_methods: updated.length > 0 ? updated : null }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const result = paymentTermSchema.safeParse(formData)
    if (!result.success) {
      const allTouched = Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {})
      setTouched(allTouched)
      return
    }
    
    // Sanitize payload: ensure unused fields are null based on calculation_type
    const sanitized = { ...result.data }
    if (['from_invoice', 'from_delivery'].includes(sanitized.calculation_type)) {
      sanitized.payment_dates = null
      sanitized.payment_day_of_week = null
    } else if (sanitized.calculation_type === 'weekly') {
      sanitized.payment_dates = null
    } else if (['fixed_date', 'fixed_date_immediate', 'monthly'].includes(sanitized.calculation_type)) {
      sanitized.payment_day_of_week = null
    }
    
    // Remove term_code from update payload (immutable)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { term_code, ...updateData } = sanitized
    const submitData = isEdit ? updateData : sanitized
    
    await onSubmit(submitData as CreatePaymentTermDto)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="term_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Term Code *
          </label>
          <input 
            id="term_code"
            name="term_code" 
            value={formData.term_code} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isEdit || isLoading}
            maxLength={50}
            aria-invalid={!!errors.term_code}
          />
          {isEdit && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Term code cannot be changed</p>
          )}
          {errors.term_code && (
            <p className="text-red-600 text-sm mt-1">{errors.term_code}</p>
          )}
        </div>

        <div>
          <label htmlFor="term_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Term Name *
          </label>
          <input 
            id="term_name"
            name="term_name" 
            value={formData.term_name} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
            maxLength={100}
            aria-invalid={!!errors.term_name}
          />
          {errors.term_name && (
            <p className="text-red-600 text-sm mt-1">{errors.term_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="calculation_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Calculation Type *
          </label>
          <select 
            id="calculation_type"
            name="calculation_type" 
            value={formData.calculation_type} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
          >
            {CALCULATION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How payment due date is calculated</p>
        </div>

        <div>
          <label htmlFor="days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Days *
          </label>
          <input 
            id="days"
            name="days" 
            type="number"
            value={formData.days} 
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading || !['from_invoice', 'from_delivery'].includes(formData.calculation_type)}
            min={0}
            max={999}
            aria-invalid={!!errors.days}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {['from_invoice', 'from_delivery'].includes(formData.calculation_type) 
              ? 'Payment period in days' 
              : 'Not used for this calculation type'}
          </p>
          {errors.days && (
            <p className="text-red-600 text-sm mt-1">{errors.days}</p>
          )}
        </div>
      </div>

      {showPaymentDates && (
        <div>
          <label htmlFor="payment_dates" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Dates *
          </label>
          <input 
            id="payment_dates"
            value={paymentDatesInput}
            onChange={e => handlePaymentDatesChange(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, payment_dates: true }))}
            placeholder="e.g., 1, 15, 30 or 999 for end of month"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              touched.payment_dates && (!formData.payment_dates || formData.payment_dates.length === 0)
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            disabled={isLoading}
            aria-invalid={touched.payment_dates && (!formData.payment_dates || formData.payment_dates.length === 0)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comma-separated day numbers (1-31) or 999 for end of month</p>
          {touched.payment_dates && (!formData.payment_dates || formData.payment_dates.length === 0) && (
            <p className="text-red-600 text-sm mt-1">Payment dates are required for this calculation type</p>
          )}
        </div>
      )}

      {showPaymentDayOfWeek && (
        <div>
          <label htmlFor="payment_day_of_week" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Day of Week
          </label>
          <select
            id="payment_day_of_week"
            value={formData.payment_day_of_week ?? ''}
            onChange={e => setFormData(prev => ({ ...prev, payment_day_of_week: e.target.value ? parseInt(e.target.value) : null }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
          >
            <option value="">Select day</option>
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Payment due every selected day of the week</p>
        </div>
      )}

      {/* Preview Due Date */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 dark:text-blue-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Preview Due Date</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {formData.calculation_type === 'fixed_date' 
                ? `Pembayaran setiap tanggal ${formData.payment_dates?.map(d => d === 999 ? '(akhir bulan)' : d).join(', ') || '-'}. Next: ${getPreviewDueDate()}`
                : formData.calculation_type === 'fixed_date_immediate'
                ? `Pembayaran setiap tanggal ${formData.payment_dates?.map(d => d === 999 ? '(akhir bulan)' : d).join(', ') || '-'} (termasuk hari ini). Next: ${getPreviewDueDate()}`
                : formData.calculation_type === 'monthly'
                ? `Monthly payment on day ${formData.payment_dates?.[0] === 999 ? 'end of month' : formData.payment_dates?.[0] || '-'}: ${getPreviewDueDate()}`
                : `If ${formData.calculation_type === 'from_delivery' ? 'delivery' : formData.calculation_type === 'weekly' ? 'any' : 'invoice'} date is today, payment due: ${getPreviewDueDate()}`
              }
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">This is an example calculation for reference</p>
          </div>
        </div>
      </div>

      <div className="border-t dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Early Payment & Penalties</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="early_payment_discount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Early Payment Discount (%)
            </label>
            <input 
              id="early_payment_discount"
              name="early_payment_discount" 
              type="number"
              step="0.01"
              value={formData.early_payment_discount} 
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
              min={0}
              max={100}
            />
          </div>

          <div>
            <label htmlFor="early_payment_days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Early Payment Days
            </label>
            <input 
              id="early_payment_days"
              name="early_payment_days" 
              type="number"
              value={formData.early_payment_days} 
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
              min={0}
            />
          </div>

          <div>
            <label htmlFor="late_payment_penalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Late Payment Penalty (%)
            </label>
            <input 
              id="late_payment_penalty"
              name="late_payment_penalty" 
              type="number"
              step="0.01"
              value={formData.late_payment_penalty} 
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
              min={0}
              max={100}
            />
          </div>

          <div>
            <label htmlFor="grace_period_days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Grace Period (Days)
            </label>
            <input 
              id="grace_period_days"
              name="grace_period_days" 
              type="number"
              value={formData.grace_period_days} 
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
              min={0}
            />
          </div>
        </div>
      </div>

      <div className="border-t dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Order Amount Constraints</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="minimum_order_amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Order Amount
            </label>
            <input 
              id="minimum_order_amount"
              name="minimum_order_amount" 
              type="number"
              step="0.01"
              value={formData.minimum_order_amount} 
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
              min={0}
            />
          </div>

          <div>
            <label htmlFor="maximum_order_amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maximum Order Amount
            </label>
            <input 
              id="maximum_order_amount"
              name="maximum_order_amount" 
              type="number"
              step="0.01"
              value={formData.maximum_order_amount ?? ''} 
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="No limit"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
              min={0}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Allowed Payment Methods
        </label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map(method => (
            <button
              key={method}
              type="button"
              onClick={() => handleMethodToggle(method)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                selectedMethods.includes(method)
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              disabled={isLoading}
            >
              {method}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select applicable payment methods</p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea 
          id="description"
          name="description" 
          value={formData.description || ''} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          rows={3}
          disabled={isLoading}
          maxLength={500}
          placeholder="Additional notes for finance team"
        />
      </div>

      <div>
        <label htmlFor="is_active" className="flex items-center cursor-pointer">
          <input 
            id="is_active"
            type="checkbox" 
            name="is_active" 
            checked={formData.is_active} 
            onChange={handleChange}
            className="mr-2 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
            disabled={isLoading}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          Only active terms can be used in transactions
        </p>
      </div>

      <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Cancel
          </button>
        )}
        <button 
          type="submit" 
          disabled={isLoading || Object.keys(errors).length > 0}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? 'Saving...' : isEdit ? 'Update Payment Term' : 'Create Payment Term'}
        </button>
      </div>
    </form>
  )
}
