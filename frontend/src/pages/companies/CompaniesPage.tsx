import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { companyService } from '@/services/companyService'
import { CompanyTable } from '@/components/companies/CompanyTable'
import type { Company } from '@/types/company'

function CompaniesPage() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Record<string, any>>({})

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const res = search
        ? await companyService.search(search, 1, 1000, filter)
        : await companyService.list(1, 1000, undefined, filter)
      setCompanies(res.data.data)
    } catch (error) {
      console.error('Failed to fetch companies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [search, JSON.stringify(filter)])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this company?')) {
      try {
        await companyService.delete(id)
        fetchCompanies()
      } catch (error) {
        console.error('Delete failed')
      }
    }
  }

  const setFilterKey = (key: string, value?: string) => {
    setFilter(prev => {
      const next = { ...prev }
      if (!value) delete next[key]
      else next[key] = value
      return next
    })
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Companies</h1>
        <button
          onClick={() => navigate('/companies/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Company
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
            }}
            className="border rounded-md px-3 py-2"
          />

          <select
            value={filter.status || ''}
            onChange={e => setFilterKey('status', e.target.value || undefined)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filter.company_type || ''}
            onChange={e => setFilterKey('company_type', e.target.value || undefined)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All Types</option>
            <option value="PT">PT</option>
            <option value="CV">CV</option>
            <option value="Firma">Firma</option>
            <option value="Koperasi">Koperasi</option>
            <option value="Yayasan">Yayasan</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          <CompanyTable
            companies={companies}
            onView={id => navigate(`/companies/${id}`)}
            onEdit={id => navigate(`/companies/${id}/edit`)}
            onDelete={handleDelete}
            canEdit={true}
            canDelete={true}
          />
        </>
      )}
    </div>
  )
}

export default CompaniesPage
