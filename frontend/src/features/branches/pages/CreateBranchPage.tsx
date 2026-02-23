import { useNavigate } from 'react-router-dom'
import { useBranchesStore } from '../store/branches.store'
import { BranchForm } from '../components/BranchForm'
import type { CreateBranchDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function CreateBranchPage() {
  const navigate = useNavigate()
  const { createBranch, loading } = useBranchesStore()
  const { success, error } = useToast()

  const handleSubmit = async (data: unknown) => {
    try {
      await createBranch(data as CreateBranchDto)
      success('Branch created successfully')
      navigate('/branches')
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err && typeof err.response === 'object' && err.response && 'data' in err.response && typeof err.response.data === 'object' && err.response.data && 'error' in err.response.data ? String(err.response.data.error) : 'Failed to create branch'
      error(errorMessage)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Create Branch</h1>
        <button onClick={() => navigate('/branches')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          ✕
        </button>
      </div>
      <BranchForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
