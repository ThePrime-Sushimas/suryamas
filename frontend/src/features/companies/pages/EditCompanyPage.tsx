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
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to update company')
      throw err
    }
  }

  if (loading) return <div className="p-6 text-center">Loading...</div>
  if (!selectedCompany) return <div className="p-6 text-center text-red-600">Company not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Company</h1>
      <CompanyForm initialData={selectedCompany} isEdit onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
