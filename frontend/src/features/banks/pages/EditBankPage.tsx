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
        toast.error('Bank not found')
        navigate('/settings/banks')
      })
    }
  }, [id, fetchBankById, navigate, toast])

  const handleSubmit: SubmitHandler<BankFormData> = async (data) => {
    if (!id) return
    try {
      await updateBank(Number(id), {
        bank_name: data.bank_name,
        is_active: data.is_active,
      })
      toast.success('Bank updated successfully')
      navigate('/settings/banks')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update bank')
    }
  }

  if (fetchLoading || !currentBank) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-center text-gray-500">Loading...</p>
        </div>
      </div>
    )
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Bank</h1>
        <BankForm 
          initialData={currentBank} 
          onSubmit={handleSubmit} 
          isLoading={mutationLoading} 
        />
      </div>
    </div>
  )
}
