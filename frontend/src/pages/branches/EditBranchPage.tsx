import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { BranchForm } from '@/components/branches/BranchForm'
import type { Branch } from '@/types/branch'

function EditBranchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const res = await branchService.getById(id!)
        setBranch(res.data.data)
      } catch (error) {
        console.error('Failed to fetch branch')
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
      navigate(`/branches/${id}`)
    } catch (error: any) {
      console.error('Update failed:', error.response?.data || error.message)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!branch) return <div className="p-6">Branch not found</div>

  return (
    <div className="p-6">
      <button onClick={() => navigate('/branches')} className="mb-4 text-blue-600 hover:underline">
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Edit Branch</h1>
        <BranchForm initialData={branch} isEdit onSubmit={handleSubmit} isLoading={isSubmitting} />
      </div>
    </div>
  )
}

export default EditBranchPage
