import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { usePaymentTerm, useUpdatePaymentTerm } from '../api/paymentTerms.api'
import { PaymentTermForm } from '../components/PaymentTermForm'
import type { UpdatePaymentTermDto } from '../types'

export default function EditPaymentTermPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const numId = parseInt(id || '0')
  const term = usePaymentTerm(numId)
  const updateTerm = useUpdatePaymentTerm()

  const handleSubmit = async (data: UpdatePaymentTermDto) => {
    if (!numId) return
    try {
      await updateTerm.mutateAsync({ id: numId, ...data })
      toast.success('Syarat pembayaran berhasil diperbarui')
      navigate('/payment-terms')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengupdate syarat pembayaran')) }
  }

  if (term.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!term.data) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Syarat pembayaran tidak ditemukan</h3>
          <button onClick={() => navigate('/payment-terms')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  if (term.data.deleted_at) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <p className="text-red-600 font-medium">Tidak dapat mengedit syarat yang sudah dihapus</p>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Silakan pulihkan terlebih dahulu</p>
          <button onClick={() => navigate('/payment-terms')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Syarat Pembayaran</h1>
            <p className="text-xs text-gray-400">{term.data.term_code} — {term.data.term_name}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <PaymentTermForm initialData={term.data} isEdit onSubmit={handleSubmit} isLoading={updateTerm.isPending} onCancel={() => navigate('/payment-terms')} />
        </div>
      </div>
    </div>
  )
}
