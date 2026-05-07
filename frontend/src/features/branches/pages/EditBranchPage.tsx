import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useBranch, useUpdateBranch } from '../api/branches.api'
import { BranchForm } from '../components/BranchForm'
import type { UpdateBranchDto } from '../types'

export default function EditBranchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const branch = useBranch(id || '')
  const updateBranch = useUpdateBranch()

  const handleSubmit = async (data: UpdateBranchDto) => {
    if (!id) return
    try {
      await updateBranch.mutateAsync({ id, ...data })
      toast.success('Cabang berhasil diperbarui')
      navigate('/branches')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengupdate cabang')) }
  }

  if (branch.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!branch.data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <MapPin className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Cabang tidak ditemukan</h3>
          <button onClick={() => navigate('/branches')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const b = branch.data

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/branches')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <MapPin className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{b.branch_name}</h1>
            <p className="text-xs text-gray-400">{b.branch_code} • {b.city}</p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Status</p>
            <p className={`text-lg font-bold ${b.status === 'active' ? 'text-emerald-600' : b.status === 'closed' ? 'text-red-500' : 'text-gray-500'}`}>
              {b.status === 'active' ? 'Aktif' : b.status === 'closed' ? 'Tutup' : 'Nonaktif'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Kota</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{b.city}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Jam Operasional</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400" />
              {b.jam_buka?.slice(0, 5)} - {b.jam_tutup?.slice(0, 5)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Hari Operasi</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {b.hari_operasional?.some(d => d.includes('Setiap') || d.includes('Senin-Minggu'))
                ? 'Setiap Hari'
                : `${b.hari_operasional?.length || 0} hari`}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <BranchForm initialData={b} isEdit onSubmit={handleSubmit} isLoading={updateBranch.isPending} />
        </div>
      </div>
    </div>
  )
}
