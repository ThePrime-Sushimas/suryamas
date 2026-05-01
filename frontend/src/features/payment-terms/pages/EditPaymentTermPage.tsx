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
      toast.error('Payment term tidak ditemukan')
      navigate('/payment-terms')
      return
    }

    fetchPaymentTermById(parseInt(id)).catch(() => {
      toast.error('Payment term tidak ditemukan')
      navigate('/payment-terms')
    })
  }, [id, navigate, toast, fetchPaymentTermById])

  const handleSubmit = async (data: UpdatePaymentTermDto) => {
    if (!id) return
    try {
      await updatePaymentTerm(parseInt(id), data)
      toast.success('Payment term berhasil diupdate')
      navigate('/payment-terms')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  const handleCancel = () => {
    navigate('/payment-terms')
  }

  if (loading && !currentPaymentTerm) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center py-12">
          <CardSkeleton />
          <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!currentPaymentTerm) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Payment term tidak ditemukan</p>
          <button
            onClick={() => navigate('/payment-terms')}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Kembali ke Syarat Pembayaran
          </button>
        </div>
      </div>
    )
  }

  if (currentPaymentTerm.deleted_at) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Tidak dapat mengedit payment term yang sudah dihapus</p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Silakan restore terlebih dahulu</p>
          <button
            onClick={() => navigate('/payment-terms')}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Kembali ke Syarat Pembayaran
          </button>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Payment Term</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentPaymentTerm?.term_name || ''}</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
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
