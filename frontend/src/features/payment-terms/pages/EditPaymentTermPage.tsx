import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { usePaymentTermsStore } from '../store/paymentTerms.store'
import { PaymentTermForm } from '../components/PaymentTermForm'
import { useToast } from '@/contexts/ToastContext'
import type { UpdatePaymentTermDto } from '../types'
import { ArrowLeft } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/Skeleton'

export default function EditPaymentTermPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentPaymentTerm, loading, updatePaymentTerm, fetchPaymentTermById } = usePaymentTermsStore()

  useEffect(() => {
    if (!id || isNaN(Number(id))) {
      toast.error('Invalid payment term ID')
      navigate('/payment-terms')
      return
    }

    fetchPaymentTermById(parseInt(id)).catch(() => {
      toast.error('Payment term not found')
      navigate('/payment-terms')
    })
  }, [id, navigate, toast, fetchPaymentTermById])

  const handleSubmit = async (data: UpdatePaymentTermDto) => {
    if (!id) return
    try {
      await updatePaymentTerm(parseInt(id), data)
      toast.success('Payment term updated successfully')
      navigate('/payment-terms')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update payment term'
      toast.error(message)
    }
  }

  const handleCancel = () => {
    navigate('/payment-terms')
  }

  if (loading && !currentPaymentTerm) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <CardSkeleton />
          <p className="mt-2 text-gray-600">Loading payment term...</p>
        </div>
      </div>
    )
  }

  if (!currentPaymentTerm) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Payment term not found</p>
          <button
            onClick={() => navigate('/payment-terms')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Payment Terms
          </button>
        </div>
      </div>
    )
  }

  if (currentPaymentTerm.deleted_at) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Cannot edit deleted payment term</p>
          <p className="text-gray-600 mt-2">Please restore it first</p>
          <button
            onClick={() => navigate('/payment-terms')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Payment Terms
          </button>
        </div>
      </div>
    )
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
        <h1 className="text-3xl font-bold text-gray-900">Edit Payment Term</h1>
        <p className="text-gray-600 mt-1">Update payment term configuration</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <PaymentTermForm 
          initialData={currentPaymentTerm} 
          isEdit 
          onSubmit={handleSubmit} 
          isLoading={loading}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
