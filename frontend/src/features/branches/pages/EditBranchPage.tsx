import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { branchesApi } from '../api/branches.api'
import { useBranchesStore } from '../store/branches.store'
import { BranchForm } from '../components/BranchForm'
import type { Branch, UpdateBranchDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function EditBranchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateBranch, loading: updating } = useBranchesStore()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const { success, error } = useToast()

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const data = await branchesApi.getById(id || '')
        setBranch(data)
      } catch {
        error('Branch not found')
        navigate('/branches')
      } finally {
        setLoading(false)
      }
    }
    fetchBranch()
  }, [id, navigate, error])

  const handleSubmit = async (data: UpdateBranchDto) => {
    try {
      await updateBranch(id || '', data)
      success('Branch updated successfully')
      navigate(`/branches/${id}`)
    } catch (err: unknown) {
      error(err.response?.data?.error || 'Failed to update branch')
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!branch) return <div className="p-4 text-red-600">Branch not found</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Branch</h1>
      <BranchForm initialData={branch} isEdit onSubmit={handleSubmit} isLoading={updating} />
    </div>
  )
}
