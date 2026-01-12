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
import type { ChartOfAccountFilter, ChartOfAccountTreeNode, ChartOfAccount } from '../types/chart-of-account.types'

// Helper function to flatten tree data for table view
const flattenTree = (tree: ChartOfAccountTreeNode[]): ChartOfAccount[] => {
  const result: ChartOfAccount[] = []
  
  const traverse = (nodes: ChartOfAccountTreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  
  traverse(tree)
  return result
}

// Helper function to filter tree data based on search
const filterTree = (tree: ChartOfAccountTreeNode[], searchTerm: string): ChartOfAccount[] => {
  if (!searchTerm.trim()) return flattenTree(tree)
  
  const result: ChartOfAccount[] = []
  const searchLower = searchTerm.toLowerCase()
  
  const traverse = (nodes: ChartOfAccountTreeNode[]) => {
    for (const node of nodes) {
      const matchesSearch = 
        node.account_code.toLowerCase().includes(searchLower) ||
        node.account_name.toLowerCase().includes(searchLower)
      
      if (matchesSearch) {
        result.push(node)
      }
      
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  
  traverse(tree)
  return result
}



export default function ChartOfAccountsPage() {
  const navigate = useNavigate()
  const currentBranch = useBranchContext()
  const { companies, fetchCompanies } = useCompaniesStore()
  const { 
    tree, 
    loading, 
    error,
    viewMode,
    fetchTree,
    deleteAccount, 
    bulkDelete,
    bulkUpdateStatus,
    setViewMode,
    resetList,
    resetTree
  } = useChartOfAccountsStore()
  
  const [manualCompanyId, setManualCompanyId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ChartOfAccountFilter>({})
  const [showFilter, setShowFilter] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  useEffect(() => {
    fetchCompanies(1, 100)
  }, [fetchCompanies])

  // Compute selected company ID based on available options
  const selectedCompanyId = useMemo(() => {
    if (manualCompanyId) return manualCompanyId
    if (currentBranch?.company_id) return String(currentBranch.company_id)
    if (companies.length > 0) return String(companies[0].id)
    return ''
  }, [manualCompanyId, currentBranch?.company_id, companies])

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
    
    // Always load tree data for proper sorting
    return fetchTree(selectedCompanyId)
  }, [selectedCompanyId, fetchTree, showError])



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
                {viewMode === 'tree' ? `${tree.length} root accounts` : `${debouncedSearch ? filterTree(tree, debouncedSearch).length : flattenTree(tree).length} accounts`}
              </p>
            </div>
          </div>
          
          {/* Company Tabs */}
          {companies.length > 1 && (
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {companies.map(company => (
                <button
                  key={company.id}
                  onClick={() => setManualCompanyId(company.id)}
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
        ) : (viewMode === 'table' ? loading.tree : loading.tree) ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <>
            {viewMode === 'table' ? (
              <ChartOfAccountTable
                accounts={debouncedSearch ? filterTree(tree, debouncedSearch) : flattenTree(tree)}
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
            

          </>
        )}
      </div>
    </div>
  )
}