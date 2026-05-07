import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateCompany } from '../api/companies.api'
import { CompanyForm } from '../components/CompanyForm'
import type { CreateCompanyDto } from '../types'

export default function CreateCompanyPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createCompany = useCreateCompany()

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      await createCompany.mutateAsync(data as CreateCompanyDto)
      toast.success('Perusahaan berhasil dibuat')
      navigate('/companies')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat perusahaan')) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/companies')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <Building2 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Perusahaan</h1>
            <p className="text-xs text-gray-400">Tambah perusahaan baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <CompanyForm onSubmit={handleSubmit} isLoading={createCompany.isPending} />
        </div>
      </div>
    </div>
  )
}
