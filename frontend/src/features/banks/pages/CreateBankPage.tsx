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
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/settings/banks')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Banks
      </button>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Bank</h1>
        <BankForm onSubmit={handleSubmit} isLoading={mutationLoading} />
      </div>
    </div>
  )
}
