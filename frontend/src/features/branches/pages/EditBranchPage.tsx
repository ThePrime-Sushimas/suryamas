import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { branchesApi } from '../api/branches.api'
import { useBranchesStore } from '../store/branches.store'
import { BranchForm } from '../components/BranchForm'
import { useToast } from '@/contexts/ToastContext'
import type { Branch, UpdateBranchDto } from '../types'

export default function EditBranchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateBranch, mutationLoading } = useBranchesStore()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    if (!id) return
    branchesApi.getById(id)
      .then(setBranch)
      .catch(() => { toast.error('Branch tidak ditemukan'); navigate('/branches') })
      .finally(() => setLoading(false))
  }, [id, navigate, toast])

  const handleSubmit = async (data: UpdateBranchDto) => {
    if (!id) return
    try {
      await updateBranch(id, data)
      toast.success('Branch berhasil diupdate')
      navigate(`/branches/${id}`)
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(id ? `/branches/${id}` : '/branches')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Branch</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{branch?.branch_name || 'Loading...'}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-2" />
                  <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : !branch ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Branch tidak ditemukan</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <BranchForm initialData={branch} isEdit onSubmit={handleSubmit} isLoading={mutationLoading} />
          </div>
        )}
      </div>
    </div>
  )
}
