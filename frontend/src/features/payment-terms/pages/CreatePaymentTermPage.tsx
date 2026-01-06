import { useNavigate } from 'react-router-dom'
import { usePaymentTermsStore } from '../store/paymentTerms.store'
import { PaymentTermForm } from '../components/PaymentTermForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreatePaymentTermDto } from '../types'
import { ArrowLeft } from 'lucide-react'

export default function CreatePaymentTermPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { createPaymentTerm, loading } = usePaymentTermsStore()

  const handleSubmit = async (data: CreatePaymentTermDto) => {
    try {
      await createPaymentTerm(data)
      toast.success('Payment term created successfully')
      navigate('/payment-terms')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create payment term'
      toast.error(message)
    }
  }

  const handleCancel = () => {
    navigate('/payment-terms')
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payment Terms
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create Payment Term</h1>
        <p className="text-gray-600 mt-1">Define new payment terms for transactions</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <PaymentTermForm 
          onSubmit={handleSubmit} 
          isLoading={loading}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
