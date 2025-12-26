import { useNavigate } from 'react-router-dom'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyForm } from '../components/CompanyForm'
import type { CreateCompanyDto } from '../types'

export default function CreateCompanyPage() {
  const navigate = useNavigate()
  const { createCompany, loading } = useCompaniesStore()

  const handleSubmit = async (data: CreateCompanyDto) => {
    try {
      await createCompany(data)
      alert('Company created successfully')
      navigate('/companies')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create company')
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
