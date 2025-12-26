import { useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { BranchForm } from '@/components/branches/BranchForm'
import { useToast } from '@/contexts/ToastContext'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

function CreateBranchPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: any) => {
    setIsLoading(true)
    try {
      await branchService.create(data)
      success('Branch created successfully')
      navigate('/branches')
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to create branch')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate('/branches')} 
          className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
          aria-label="Back to branches"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Branches
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Create New Branch</h1>
          <BranchForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}

export default CreateBranchPage
