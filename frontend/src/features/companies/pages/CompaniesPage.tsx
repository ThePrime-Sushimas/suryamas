import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyTable } from '../components/CompanyTable'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { useToast } from '@/contexts/ToastContext'

type CompanyFilter = {
  status?: 'active' | 'inactive' | 'suspended' | 'closed'
  company_type?: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
}

const LIMIT = 25

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { companies, loading, pagination, fetchCompanies, searchCompanies, deleteCompany, reset } = useCompaniesStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CompanyFilter>({})
  const [page, setPage] = useState(1)
  const { error } = useToast()
  
  const debouncedSearch = useDebounce(search, 500)
  
  // Create a key that changes when search or filter changes
  const searchFilterKey = useMemo(() => 
    `${debouncedSearch}-${JSON.stringify(filter)}`, 
    [debouncedSearch, filter]
  )
  
  // Track the current key to detect changes
  const [currentKey, setCurrentKey] = useState(searchFilterKey)
  
  // Calculate effective page - reset to 1 when search/filter changes
  const effectivePage = currentKey === searchFilterKey ? page : 1

  const loadCompanies = useCallback(() => {
    if (debouncedSearch) {
      return searchCompanies(debouncedSearch, effectivePage, LIMIT, filter)
    }
    return fetchCompanies(effectivePage, LIMIT, undefined, filter)
  }, [debouncedSearch, effectivePage, filter, searchCompanies, fetchCompanies])

  // Update current key and page when search/filter changes
  useEffect(() => {
    setCurrentKey(searchFilterKey)
  }, [searchFilterKey])
  
  useEffect(() => {
    if (effectivePage === 1 && page !== 1) {
      setPage(1)
    }
  }, [effectivePage, page])

  useEffect(() => {
    return () => reset()
  }, [reset])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this company?')) return
    
    try {
      await deleteCompany(id)
      await loadCompanies()
    } catch {
      error('Failed to delete company')
    }
  }, [deleteCompany, loadCompanies, error])

  const setFilterKey = useCallback(
    <K extends keyof CompanyFilter>(key: K, value?: CompanyFilter[K]) => {
      setFilter(prev => {
        const next = { ...prev }
        if (!value) delete next[key]
        else next[key] = value
        return next
      })
    },
    []
  )

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
            onChange={e => setSearch(e.target.value)}
            className="border rounded-md px-3 py-2"
          />

          <select
            value={filter.status || ''}
            onChange={e => setFilterKey('status', (e.target.value || undefined) as CompanyFilter['status'])}
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
            onChange={e => setFilterKey('company_type', (e.target.value || undefined) as CompanyFilter['company_type'])}
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
          
          {pagination.total > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((effectivePage - 1) * LIMIT) + 1} to {Math.min(effectivePage * LIMIT, pagination.total)} of {pagination.total} companies
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={effectivePage === 1}
                  className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 border rounded-md bg-gray-50">
                  Page {effectivePage} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={effectivePage >= pagination.totalPages}
                  className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
