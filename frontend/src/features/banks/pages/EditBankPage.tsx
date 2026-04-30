import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { type SubmitHandler } from 'react-hook-form'
import { BankForm } from '../components/BankForm'
import { useBanksStore } from '../store/useBanks'
import { useToast } from '@/contexts/ToastContext'
import type { BankFormData } from '../schemas/bank.schema'

export const EditBankPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentBank, fetchLoading, mutationLoading, fetchBankById, updateBank } = useBanksStore()

  useEffect(() => {
    if (id) {
      fetchBankById(Number(id)).catch(() => {
        toast.error('Bank tidak ditemukan')
        navigate('/settings/banks')
      })
    }
  }, [id, fetchBankById, navigate, toast])

  const handleSubmit: SubmitHandler<BankFormData> = async (data) => {
    if (!id) return
    try {
      await updateBank(Number(id), { bank_name: data.bank_name, is_active: data.is_active })
      toast.success('Bank berhasil diperbarui')
      navigate('/settings/banks')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui bank')
    }
  }

  if (fetchLoading || !currentBank) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-6" />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900">
      <button onClick={() => navigate('/settings/banks')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6">
        <ArrowLeft size={20} />
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Bank</h1>
        <BankForm initialData={currentBank} onSubmit={handleSubmit} isLoading={mutationLoading} />
      </div>
    </div>
  )
}
