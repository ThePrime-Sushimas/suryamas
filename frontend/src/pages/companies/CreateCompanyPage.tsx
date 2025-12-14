import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { companyService } from '@/services/companyService'
import { CompanyForm } from '@/components/companies/CompanyForm'
import type { CreateCompanyDto } from '@/types/company'

function CreateCompanyPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: CreateCompanyDto) => {
    setLoading(true)
    try {
      await companyService.create(data)
      alert('Company created successfully')
      navigate('/companies')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Create Company</h1>
        <button
          onClick={() => navigate('/companies')}
          className="text-gray-600 hover:text-gray-900"
        >
          ✕
        </button>
      </div>
      <CompanyForm onSubmit={handleSubmit} isLoading={loading} />
      <button
        onClick={() => navigate('/companies')}
        className="mt-4 w-full bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400"
      >
        Back to List
      </button>
    </div>
  )
}

export default CreateCompanyPage
