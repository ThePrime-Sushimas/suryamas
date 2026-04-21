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
      toast.success('Bank created successfully')
      navigate('/settings/banks')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create bank')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900">
      <button onClick={() => navigate('/settings/banks')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Banks
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New Bank</h1>
        <BankForm onSubmit={handleSubmit} isLoading={mutationLoading} />
      </div>
    </div>
  )
}
