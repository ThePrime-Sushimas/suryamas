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
      toast.success('Payment term berhasil dibuat')
      navigate('/payment-terms')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  const handleCancel = () => {
    navigate('/payment-terms')
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Payment Term</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Buat syarat pembayaran baru</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <PaymentTermForm 
          onSubmit={handleSubmit} 
          isLoading={loading}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
