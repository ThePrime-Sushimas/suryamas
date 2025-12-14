import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { companyService } from '@/services/companyService'
import type { Company } from '@/types/company'

function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handleDelete = async () => {
    if (confirm('Delete this company?')) {
      try {
        await companyService.delete(id || '')
        alert('Deleted successfully')
        navigate('/companies')
      } catch (error) {
        alert('Delete failed')
      }
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!company) return <div className="p-4 text-red-600">Company not found</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{company.company_name}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/companies/${id}/edit`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Company Code</label>
            <p className="text-lg">{company.company_code}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Company Type</label>
            <p className="text-lg">{company.company_type}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Status</label>
            <p className="text-lg capitalize">{company.status}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">NPWP</label>
            <p className="text-lg">{company.npwp || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Email</label>
            <p className="text-lg">{company.email || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Phone</label>
            <p className="text-lg">{company.phone || '-'}</p>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-600">Website</label>
            <p className="text-lg">{company.website || '-'}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/companies')}
        className="mt-6 bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400"
      >
        Back to List
      </button>
    </div>
  )
}

export default CompanyDetailPage
