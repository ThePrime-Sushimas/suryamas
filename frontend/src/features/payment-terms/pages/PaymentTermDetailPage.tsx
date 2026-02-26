import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, CheckCircle, XCircle } from 'lucide-react'
import { paymentTermsApi } from '../api/paymentTerms.api'
import type { PaymentTerm, CalculationType } from '../types'

const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  from_invoice: 'From Invoice',
  from_delivery: 'From Delivery',
  fixed_date: 'Fixed Dates',
  fixed_date_immediate: 'Fixed Dates (Immediate)',
  weekly: 'Weekly',
  monthly: 'Monthly'
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function PaymentTermDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchPaymentTerm = async () => {
      try {
        setLoading(true)
        const data = await paymentTermsApi.getById(Number(id))
        setPaymentTerm(data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load payment term'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentTerm()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !paymentTerm) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Payment term not found'}</p>
          <button
            onClick={() => navigate('/payment-terms')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Payment Terms
          </button>
        </div>
      </div>
    )
  }

  const isDeleted = !!paymentTerm.deleted_at

  const getTermDetails = () => {
    switch (paymentTerm.calculation_type) {
      case 'from_invoice':
      case 'from_delivery':
        return `${paymentTerm.days} days`
      case 'fixed_date':
      case 'fixed_date_immediate':
        return paymentTerm.payment_dates?.map(d => d === 999 ? 'End of Month' : `Day ${d}`).join(', ') || '-'
      case 'weekly':
        return paymentTerm.payment_day_of_week !== null ? WEEKDAY_LABELS[paymentTerm.payment_day_of_week] : '-'
      case 'monthly':
        return paymentTerm.payment_dates?.[0] === 999 ? 'End of month' : `Day ${paymentTerm.payment_dates?.[0] || '-'}`
      default:
        return '-'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/payment-terms')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Payment Terms
          </button>
          {!isDeleted && (
            <button
              onClick={() => navigate(`/payment-terms/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header Section */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Term Code</p>
                <h1 className="text-3xl font-bold">{paymentTerm.term_code}</h1>
              </div>
              <div className="flex items-center gap-2">
                {isDeleted ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-red-500 dark:bg-red-600 rounded-full text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Deleted
                  </span>
                ) : paymentTerm.is_active ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-green-500 dark:bg-green-600 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 bg-gray-500 dark:bg-gray-600 rounded-full text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="px-8 py-6 space-y-6">
            {/* Term Name */}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Term Name</label>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{paymentTerm.term_name}</p>
            </div>

            {/* Description */}
            {paymentTerm.description && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</label>
                <p className="mt-1 text-gray-700 dark:text-gray-300 leading-relaxed">{paymentTerm.description}</p>
              </div>
            )}

            {/* Calculation Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Calculation Type</label>
                <p className="mt-1 text-lg text-gray-900 dark:text-white">{CALCULATION_TYPE_LABELS[paymentTerm.calculation_type]}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Details</label>
                <p className="mt-1 text-lg text-gray-900 dark:text-white">{getTermDetails()}</p>
              </div>
            </div>

            {/* Discount & Penalty */}
            {(paymentTerm.early_payment_discount > 0 || paymentTerm.late_payment_penalty > 0) && (
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                {paymentTerm.early_payment_discount > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Early Payment Discount</label>
                    <p className="mt-1 text-lg text-green-600 dark:text-green-400 font-semibold">
                      {paymentTerm.early_payment_discount}% ({paymentTerm.early_payment_days} days)
                    </p>
                  </div>
                )}
                {paymentTerm.late_payment_penalty > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Late Payment Penalty</label>
                    <p className="mt-1 text-lg text-red-600 dark:text-red-400 font-semibold">
                      {paymentTerm.late_payment_penalty}% (Grace: {paymentTerm.grace_period_days} days)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Order Amount Limits */}
            {(paymentTerm.minimum_order_amount > 0 || paymentTerm.maximum_order_amount) && (
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                {paymentTerm.minimum_order_amount > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Minimum Order Amount</label>
                    <p className="mt-1 text-lg text-gray-900 dark:text-white font-mono">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(paymentTerm.minimum_order_amount)}
                    </p>
                  </div>
                )}
                {paymentTerm.maximum_order_amount && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Maximum Order Amount</label>
                    <p className="mt-1 text-lg text-gray-900 dark:text-white font-mono">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(paymentTerm.maximum_order_amount)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Payment Methods */}
            {paymentTerm.allowed_payment_methods && paymentTerm.allowed_payment_methods.length > 0 && (
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Allowed Payment Methods</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {paymentTerm.allowed_payment_methods.map((method, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
