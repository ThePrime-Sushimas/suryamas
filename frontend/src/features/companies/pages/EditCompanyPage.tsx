import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyForm } from '../components/CompanyForm'
import { useToast } from '@/contexts/ToastContext'
import type { UpdateCompanyDto } from '../types'

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany, loading, getCompanyById, updateCompany, reset } = useCompaniesStore()
  const toast = useToast()

  useEffect(() => {
    if (id) {
      getCompanyById(id).catch(() => {
        toast.error('Company tidak ditemukan')
        navigate('/companies')
      })
    }
    return () => reset()
  }, [id, getCompanyById, navigate, reset, toast])

  const handleSubmit = async (data: UpdateCompanyDto) => {
    if (!id) return
    try {
      await updateCompany(id, data)
      toast.success('Company berhasil diupdate')
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Company</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCompany?.company_name || 'Loading...'}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-2" />
                  <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : !selectedCompany ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Company tidak ditemukan</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <CompanyForm initialData={selectedCompany} isEdit onSubmit={handleSubmit} isLoading={loading} />
          </div>
        )}
      </div>
    </div>
  )
}
