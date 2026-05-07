import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateBranch } from '../api/branches.api'
import { BranchForm } from '../components/BranchForm'
import type { CreateBranchDto } from '../types'

export default function CreateBranchPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createBranch = useCreateBranch()

  const handleSubmit = async (data: unknown) => {
    try {
      await createBranch.mutateAsync(data as CreateBranchDto)
      toast.success('Cabang berhasil dibuat')
      navigate('/branches')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat cabang')) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/branches')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <MapPin className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Cabang</h1>
            <p className="text-xs text-gray-400">Buat cabang baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <BranchForm onSubmit={handleSubmit} isLoading={createBranch.isPending} />
        </div>
      </div>
    </div>
  )
}
