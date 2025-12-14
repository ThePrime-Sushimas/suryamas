import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { companyService } from '@/services/companyService'
import { CompanyForm } from '@/components/companies/CompanyForm'
import type { Company, UpdateCompanyDto } from '@/types/company'

function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await companyService.getById(id || '')
        setCompany(res.data.data)
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
    setSubmitting(true)
    try {
      await companyService.update(id || '', data)
      alert('Company updated successfully')
      navigate(`/companies/${id}`)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update company')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!company) return <div className="p-4 text-red-600">Company not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Company</h1>
      <CompanyForm initialData={company} isEdit onSubmit={handleSubmit} isLoading={submitting} />
    </div>
  )
}

export default EditCompanyPage
