import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyForm } from '../components/CompanyForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateCompanyDto } from '../types'

export default function CreateCompanyPage() {
  const navigate = useNavigate()
  const { createCompany, loading, reset } = useCompaniesStore()
  const toast = useToast()

  useEffect(() => { return () => reset() }, [reset])

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      await createCompany(data as CreateCompanyDto)
      toast.success('Company berhasil dibuat')
      navigate('/companies')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/companies')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Company</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tambah perusahaan baru</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <CompanyForm onSubmit={handleSubmit} isLoading={loading} />
        </div>
      </div>
    </div>
  )
}
