import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreatePaymentTerm } from '../api/paymentTerms.api'
import { PaymentTermForm } from '../components/PaymentTermForm'
import type { CreatePaymentTermDto } from '../types'

export default function CreatePaymentTermPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createTerm = useCreatePaymentTerm()

  const handleSubmit = async (data: CreatePaymentTermDto) => {
    try {
      await createTerm.mutateAsync(data)
      toast.success('Syarat pembayaran berhasil dibuat')
      navigate('/payment-terms')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat syarat pembayaran')) }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/payment-terms')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Syarat Pembayaran</h1>
            <p className="text-xs text-gray-400">Buat syarat pembayaran baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <PaymentTermForm onSubmit={handleSubmit} isLoading={createTerm.isPending} onCancel={() => navigate('/payment-terms')} />
        </div>
      </div>
    </div>
  )
}
