import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyTable } from '../components/CompanyTable'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { Building2, Plus, Search, Filter, X } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'

type CompanyFilter = {
  status?: 'active' | 'inactive' | 'suspended' | 'closed'
  company_type?: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
}

type ConfirmState = {
  open: boolean
  id: string
  name: string
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { 
    companies, 
    loading, 
    pagination, 
    fetchCompanies, 
    deleteCompany, 
    reset,
    setPage,
    setPageSize,
    setFilters
  } = useCompaniesStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CompanyFilter>({ status: 'active' })
  const [showFilter, setShowFilter] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()
  
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filter.status) count++
    if (filter.company_type) count++
    return count
  }, [filter.status, filter.company_type])

  useEffect(() => {
    const newFilters = { ...filter } as Record<string, unknown>
    if (debouncedSearch) {
      newFilters.search = debouncedSearch
    } else {
      delete newFilters.search
    }
    setFilters(newFilters)
  }, [debouncedSearch, filter, setFilters])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
  }, [])

  useEffect(() => {
    return () => { reset() }
  }, [reset])

  useEffect(() => {
    fetchCompanies(1, pagination.limit, undefined, filter)
  }, [])

  useEffect(() => {
    fetchCompanies(pagination.page, pagination.limit, undefined, filter)
  }, [pagination.page, pagination.limit, fetchCompanies, filter])

  const handleDeleteClick = useCallback((id: string) => {
    const company = companies.find(c => c.id === id)
    setConfirm({ open: true, id, name: company?.company_name || 'this company' })
  }, [companies])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirm) return
    
    setIsDeleting(true)
    try {
      await deleteCompany(confirm.id)
      toast.success('Company deleted successfully')
      fetchCompanies(pagination.page, pagination.limit)
    } catch {
      toast.error('Failed to delete company')
    } finally {
      setIsDeleting(false)
      setConfirm(null)
    }
  }, [confirm, deleteCompany, fetchCompanies, pagination.page, pagination.limit, toast])

  const handleCloseConfirm = useCallback(() => {
    if (!isDeleting) {
      setConfirm(null)
    }
  }, [isDeleting])

  const setFilterKey = useCallback(
    <K extends keyof CompanyFilter>(key: K, value?: CompanyFilter[K]) => {
      const newFilter = { ...filter }
      if (!value) delete newFilter[key]
      else newFilter[key] = value
      setFilter(newFilter)
      setFilters(newFilter)
    },
    [filter, setFilters]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Companies</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/companies/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Company
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter 
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' 
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filter.status || ''}
                onChange={e => setFilterKey('status', (e.target.value || undefined) as CompanyFilter['status'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Type</label>
              <select
                value={filter.company_type || ''}
                onChange={e => setFilterKey('company_type', (e.target.value || undefined) as CompanyFilter['company_type'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="PT">PT</option>
                <option value="CV">CV</option>
                <option value="Firma">Firma</option>
                <option value="Koperasi">Koperasi</option>
                <option value="Yayasan">Yayasan</option>
              </select>
            </div>
        )
      </div>
        )}
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <>
            <CompanyTable
              companies={companies}
              onView={id => navigate(`/companies/${id}`)}
              onEdit={id => navigate(`/companies/${id}/edit`)}
              onDelete={handleDeleteClick}
              canEdit={true}
              canDelete={true}
            />
            
            {pagination.total > 0 && (
              <Pagination
                pagination={pagination}
                onPageChange={setPage}
                onLimitChange={setPageSize}
                currentLength={companies.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirm?.open || false}
        title="Delete Company"
        message={`Are you sure you want to delete "${confirm?.name}"? This will change the status to inactive.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseConfirm}
      />
    </div>
  )
</div>)}
