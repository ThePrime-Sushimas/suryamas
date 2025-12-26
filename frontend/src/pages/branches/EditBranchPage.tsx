import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { BranchForm } from '@/components/branches/BranchForm'
import { useToast } from '@/contexts/ToastContext'
import { FormSkeleton } from '@/components/ui/Skeleton'
import type { Branch } from '@/types/branch'
import { ArrowLeft, AlertCircle } from 'lucide-react'

function EditBranchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const res = await branchService.getById(id!)
        setBranch(res.data.data)
      } catch (error: any) {
        showError(error.response?.data?.error || 'Failed to fetch branch')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchBranch()
  }, [id])

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      await branchService.update(id!, data)
      success('Branch updated successfully')
      navigate(`/branches/${id}`)
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update branch')
      throw error
    } finally {
      setIsSubmitting(false)
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Edit Branch</h1>
          
          {loading ? (
            <FormSkeleton />
          ) : !branch ? (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Branch Not Found</h3>
              <p className="text-gray-600 mb-6">The branch you're trying to edit doesn't exist.</p>
              <button
                onClick={() => navigate('/branches')}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Branches
              </button>
            </div>
          ) : (
            <BranchForm initialData={branch} isEdit onSubmit={handleSubmit} isLoading={isSubmitting} />
          )}
        </div>
      </div>
    </div>
  )
}

export default EditBranchPage
