import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { type SubmitHandler } from 'react-hook-form'
import { BankForm } from '../components/BankForm'
import { useBanksStore } from '../store/useBanks'
import { useToast } from '@/contexts/ToastContext'
import type { BankFormData } from '../schemas/bank.schema'

export const CreateBankPage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { createBank, mutationLoading } = useBanksStore()

  const handleSubmit: SubmitHandler<BankFormData> = async (data) => {
    try {
      await createBank(data)
      toast.success('Bank berhasil dibuat')
      navigate('/settings/banks')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat bank')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900">
      <button onClick={() => navigate('/settings/banks')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6">
        <ArrowLeft size={20} />
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">Tambah Bank Baru</h1>
        <BankForm onSubmit={handleSubmit} isLoading={mutationLoading} />
      </div>
    </div>
  )
}
