import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { useCompaniesStore } from '@/features/companies'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountTable } from '../components/ChartOfAccountTable'
import { ChartOfAccountTree } from '../components/ChartOfAccountTree'
import { ChartOfAccountFilters } from '../components/ChartOfAccountFilters'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { useToast } from '@/contexts/ToastContext'
import { Building2, Plus, Search, Filter, X, Table, TreePine, Trash2 } from 'lucide-react'
import type { ChartOfAccountFilter } from '../types/chart-of-account.types'

const LIMIT = 25

export default function ChartOfAccountsPage() {
  const navigate = useNavigate()
  const currentBranch = useBranchContext()
  const { companies, fetchCompanies } = useCompaniesStore()
  const { 
    accounts, 
    tree, 
    loading, 
    error,
    pagination, 
    viewMode,
    fetchAccounts, 
    searchAccounts, 
    fetchTree,
    deleteAccount, 
    bulkDelete,
    bulkUpdateStatus,
    setViewMode,
    resetList,
    resetTree
  } = useChartOfAccountsStore()
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ChartOfAccountFilter>({})
  const [page, setPage] = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      // Default to current branch's company or first company
      const defaultCompanyId = currentBranch?.company_id || companies[0]?.id
      if (defaultCompanyId) {
        setSelectedCompanyId(String(defaultCompanyId))
      }
    }
  }, [companies, currentBranch?.company_id, selectedCompanyId])

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId)
  }, [companies, selectedCompanyId])

  const { error: showError, success } = useToast()
  const debouncedSearch = useDebounce(search, 500)
  
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filter.account_type) count++
    if (filter.account_subtype) count++
    if (filter.is_header !== undefined) count++
    if (filter.is_postable !== undefined) count++
    if (filter.is_active !== undefined) count++
    if (filter.parent_account_id) count++
    return count
  }, [filter])
  
  // Create a key that changes when search or filter changes
  const searchFilterKey = useMemo(() => 
    `${debouncedSearch}-${JSON.stringify(filter)}`, 
    [debouncedSearch, filter]
  )
  
  // Track the current key to detect changes
  const [currentKey, setCurrentKey] = useState(searchFilterKey)
  
  // Calculate effective page - reset to 1 when search/filter changes
  const effectivePage = currentKey === searchFilterKey ? page : 1

  const loadData = useCallback(() => {
    if (!selectedCompanyId) {
      console.log('No company selected')
      return
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(selectedCompanyId)) {
      console.error('Invalid company_id format:', selectedCompanyId)
      showError('Invalid company selected.')
      return
    }
    
    if (viewMode === 'tree') {
      return fetchTree(selectedCompanyId)
    }
    
    if (debouncedSearch) {
      return searchAccounts(selectedCompanyId, debouncedSearch, effectivePage, LIMIT, filter)
    }
    return fetchAccounts(selectedCompanyId, effectivePage, LIMIT, undefined, filter)
  }, [selectedCompanyId, viewMode, debouncedSearch, effectivePage, filter, searchAccounts, fetchAccounts, fetchTree, showError])

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
    return () => {
      resetList()
      resetTree()
    }
  }, [resetList, resetTree])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = useCallback(async (id: string) => {
    if (!selectedCompanyId) return
    if (!confirm('Are you sure you want to delete this account?')) return
    
    try {
      await deleteAccount(selectedCompanyId, id)
      success('Account deleted successfully')
    } catch {
      if (error?.scope === 'submit') {
        showError(error.message)
      } else {
        showError('Failed to delete account')
      }
    }
  }, [selectedCompanyId, deleteAccount, error, success, showError])

  const handleBulkDelete = useCallback(async () => {
    if (!selectedCompanyId) return
    if (selectedIds.length === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} accounts?`)) return
    
    try {
      await bulkDelete(selectedCompanyId, selectedIds)
      setSelectedIds([])
      success(`${selectedIds.length} accounts deleted successfully`)
    } catch {
      if (error?.scope === 'submit') {
        showError(error.message)
      } else {
        showError('Failed to delete accounts')
      }
    }
  }, [selectedCompanyId, selectedIds, bulkDelete, error, success, showError])

  const handleBulkStatusUpdate = useCallback(async (is_active: boolean) => {
    if (!selectedCompanyId) return
    if (selectedIds.length === 0) return
    
    try {
      await bulkUpdateStatus(selectedCompanyId, selectedIds, is_active)
      setSelectedIds([])
      success(`${selectedIds.length} accounts ${is_active ? 'activated' : 'deactivated'} successfully`)
    } catch {
      if (error?.scope === 'submit') {
        showError(error.message)
      } else {
        showError('Failed to update account status')
      }
    }
  }, [selectedCompanyId, selectedIds, bulkUpdateStatus, error, success, showError])

  const setFilterKey = useCallback(
    <K extends keyof ChartOfAccountFilter>(key: K, value?: ChartOfAccountFilter[K]) => {
      setFilter(prev => {
        const next = { ...prev }
        if (!value) delete next[key]
        else next[key] = value
        return next
      })
    },
    []
  )

  const handleViewModeChange = (mode: 'table' | 'tree') => {
    setViewMode(mode)
    setSelectedIds([]) // Clear selection when switching modes
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
              <p className="text-sm text-gray-500">
                {selectedCompany && (
                  <>
                    <span className="font-medium">{selectedCompany.company_name}</span>
                    <span className="mx-2">•</span>
                  </>
                )}
                {viewMode === 'tree' ? `${tree.length} root accounts` : `${pagination.total} total accounts`}
              </p>
            </div>
          </div>
          
          {/* Company Tabs */}
          {companies.length > 1 && (
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {companies.map(company => (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedCompanyId === company.id
                      ? 'bg-white text-blue-600 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {company.company_code}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/chart-of-accounts/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Account
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
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

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleViewModeChange('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'table' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Table className="w-4 h-4" />
              Table
            </button>
            <button
              onClick={() => handleViewModeChange('tree')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'tree' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <TreePine className="w-4 h-4" />
              Tree
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && viewMode === 'table' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
              <button
                onClick={() => handleBulkStatusUpdate(true)}
                className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(false)}
                className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
              >
                Deactivate
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Filter Panel */}
        <ChartOfAccountFilters
          filter={filter}
          onFilterChange={setFilterKey}
          showFilter={showFilter}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedCompanyId ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Please select a company to view chart of accounts</p>
          </div>
        ) : (viewMode === 'table' ? loading.list : loading.tree) ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <>
            {viewMode === 'table' ? (
              <ChartOfAccountTable
                accounts={accounts}
                onView={id => navigate(`/chart-of-accounts/${id}`)}
                onEdit={id => navigate(`/chart-of-accounts/${id}/edit`)}
                onDelete={handleDelete}
                onAddChild={parentId => navigate(`/chart-of-accounts/new?parent=${parentId}`)}
                canEdit={true}
                canDelete={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            ) : (
              <ChartOfAccountTree
                tree={tree}
                onView={id => navigate(`/chart-of-accounts/${id}`)}
                onEdit={id => navigate(`/chart-of-accounts/${id}/edit`)}
                onDelete={handleDelete}
                onAddChild={parentId => navigate(`/chart-of-accounts/new?parent=${parentId}`)}
                canEdit={true}
                canDelete={true}
              />
            )}
            
            {viewMode === 'table' && pagination.total > 0 && (
              <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-sm px-4 py-3">
                <div className="text-sm text-gray-600">
                  Showing {((effectivePage - 1) * LIMIT) + 1} to {Math.min(effectivePage * LIMIT, pagination.total)} of {pagination.total} accounts
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
                    onClick={() => setPage(p => Math.min((pagination.totalPages || 1), p + 1))}
                    disabled={effectivePage >= (pagination.totalPages || 1)}
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
    </div>
  )
}