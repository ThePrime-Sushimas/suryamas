import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { companiesApi } from '../api/companies.api'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyForm } from '../components/CompanyForm'
import type { Company, UpdateCompanyDto } from '../types'

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateCompany, loading: updating } = useCompaniesStore()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const data = await companiesApi.getById(id || '')
        setCompany(data)
      } catch (error) {
        alert('Company not found')
        navigate('/companies')
      } finally {
        setLoading(false)
      }
    }
    fetchCompany()
  }, [id, navigate])

  const handleSubmit = async (data: UpdateCompanyDto) => {
    try {
      await updateCompany(id || '', data)
      alert('Company updated successfully')
      navigate(`/companies/${id}`)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update company')
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!company) return <div className="p-4 text-red-600">Company not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Company</h1>
      <CompanyForm initialData={company} isEdit onSubmit={handleSubmit} isLoading={updating} />
    </div>
  )
}
