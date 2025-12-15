import { useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { BranchForm } from '@/components/branches/BranchForm'
import { useState } from 'react'

function CreateBranchPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: any) => {
    setIsLoading(true)
    try {
      await branchService.create(data)
      navigate('/branches')
    } catch (error) {
      console.error('Create failed')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <button onClick={() => navigate('/branches')} className="mb-4 text-blue-600 hover:underline">
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Create Branch</h1>
        <BranchForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  )
}

export default CreateBranchPage
