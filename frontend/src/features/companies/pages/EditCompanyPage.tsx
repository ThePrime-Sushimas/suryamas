import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyForm } from '../components/CompanyForm'
import type { UpdateCompanyDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany, loading, getCompanyById, updateCompany, reset } = useCompaniesStore()
  const { success, error } = useToast()

  useEffect(() => {
    if (id) {
      getCompanyById(id).catch(() => {
        error('Company not found')
        navigate('/companies')
      })
    }
    return () => reset()
  }, [id, getCompanyById, navigate, reset, error])

  const handleSubmit = async (data: UpdateCompanyDto) => {
    if (!id) return
    
    try {
      await updateCompany(id, data)
      success('Company updated successfully')
      navigate('/companies')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update company'
      error(message)
      throw err
    }
  }

  if (loading) return <div className="p-6 text-center dark:text-gray-300">Loading...</div>
  if (!selectedCompany) return <div className="p-6 text-center text-red-600 dark:text-red-400">Company not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Edit Company</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <CompanyForm initialData={selectedCompany} isEdit onSubmit={handleSubmit} isLoading={loading} />
      </div>
      <button
        onClick={() => navigate('/companies')}
        className="mt-4 w-full bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
      >
        Back to List
      </button>
    </div>
  )
}
