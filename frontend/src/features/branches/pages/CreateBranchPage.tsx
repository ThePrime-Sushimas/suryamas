import { useNavigate } from 'react-router-dom'
import { useBranchesStore } from '../store/branches.store'
import { BranchForm } from '../components/BranchForm'
import type { CreateBranchDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function CreateBranchPage() {
  const navigate = useNavigate()
  const { createBranch, loading } = useBranchesStore()
  const { success, error } = useToast()

  const handleSubmit = async (data: any) => {
    try {
      await createBranch(data as CreateBranchDto)
      success('Branch created successfully')
      navigate('/branches')
    } catch (err: unknown) {
      error(err.response?.data?.error || 'Failed to create branch')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Create Branch</h1>
        <button onClick={() => navigate('/branches')} className="text-gray-600 hover:text-gray-900">
          ✕
        </button>
      </div>
      <BranchForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
