import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { useCompaniesStore } from '@/features/companies'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountTable } from '../components/ChartOfAccountTable'
import { ChartOfAccountTree } from '../components/ChartOfAccountTree'
import { ChartOfAccountFilters } from '../components/ChartOfAccountFilters'
// import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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
    restoreAccount,
    bulkRestore,
    setViewMode,
    resetList,
    resetTree
  } = useChartOfAccountsStore()
  
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ChartOfAccountFilter>({})
  const [showFilter, setShowFilter] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // // Pagination state
  // const [pagination, setPagination] = useState({
  //   page: 1,
  //   limit: 25,
  //   total: 0,
  //   totalPages: 0
  // })
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'info' | 'success'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  })
  
  // Use company from branch context only
  const selectedCompanyId = currentBranch?.company_id || ''
  
  // Get company name from companies store
  const currentCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId)
  }, [companies, selectedCompanyId])
  
  const companyName = currentCompany?.company_name || currentBranch?.branch_name || 'Loading...'

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
      return
    }
    
    // Always load tree data for proper sorting
    return fetchTree(undefined, filter)
  }, [selectedCompanyId, fetchTree, filter])



  useEffect(() => {
    // Only fetch if companies list is empty
    if (companies.length === 0) {
      fetchCompanies(1, 100) // Load companies to get company name
    }
  }, [fetchCompanies, companies.length])

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
    
    // Show confirm modal instead of window.confirm()
    const accountToDelete = flattenTree(tree).find(a => a.id === id)
    setConfirmModal({
      isOpen: true,
      title: 'Delete Account',
      message: `Are you sure you want to delete "${accountToDelete?.account_name || 'this account'}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteAccount(id)
          success('Account deleted successfully')
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Failed to delete account')
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [selectedCompanyId, deleteAccount, error, success, showError, tree])

  const handleBulkDelete = useCallback(async () => {
    if (!selectedCompanyId) return
    if (selectedIds.length === 0) return
    
    setConfirmModal({
      isOpen: true,
      title: 'Delete Accounts',
      message: `Are you sure you want to delete ${selectedIds.length} accounts? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await bulkDelete(selectedIds)
          setSelectedIds([])
          success(`${selectedIds.length} accounts deleted successfully`)
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Failed to delete accounts')
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [selectedCompanyId, selectedIds, bulkDelete, error, success, showError])

  const handleRestore = useCallback(async (id: string) => {
    if (!selectedCompanyId) return
    
    setConfirmModal({
      isOpen: true,
      title: 'Restore Account',
      message: 'Are you sure you want to restore this account?',
      variant: 'success',
      onConfirm: async () => {
        try {
          await restoreAccount(id)
          success('Account restored successfully')
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Failed to restore account')
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [selectedCompanyId, restoreAccount, error, success, showError])

  const handleBulkRestore = useCallback(async () => {
    if (!selectedCompanyId) return
    if (selectedIds.length === 0) return
    
    setConfirmModal({
      isOpen: true,
      title: 'Restore Accounts',
      message: `Are you sure you want to restore ${selectedIds.length} accounts?`,
      variant: 'success',
      onConfirm: async () => {
        try {
          await bulkRestore(selectedIds)
          setSelectedIds([])
          success(`${selectedIds.length} accounts restored successfully`)
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Failed to restore accounts')
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [selectedCompanyId, selectedIds, bulkRestore, error, success, showError])

  const handleBulkStatusUpdate = useCallback(async (is_active: boolean) => {
    if (!selectedCompanyId) return
    if (selectedIds.length === 0) return
    
    try {
      await bulkUpdateStatus(selectedIds, is_active)
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chart of Accounts</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">{companyName}</span>
                <span className="mx-2">•</span>
                {viewMode === 'tree' ? `${tree.length} root accounts` : `${debouncedSearch ? filterTree(tree, debouncedSearch).length : flattenTree(tree).length} accounts`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/chart-of-accounts/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Account
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
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
              onClick={() => handleViewModeChange('tree')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'tree' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <TreePine className="w-4 h-4" />
              Tree
            </button>
            <button
              onClick={() => handleViewModeChange('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'table' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Table className="w-4 h-4" />
              Table
            </button>
            
            {/* Show Deleted Toggle */}
            <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={filter.show_deleted || false}
                onChange={(e) => setFilterKey('show_deleted', e.target.checked || undefined)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Show Deleted
            </label>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && viewMode === 'table' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{selectedIds.length} selected</span>
              {filter.show_deleted ? (
                <button
                  onClick={handleBulkRestore}
                  className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50"
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleBulkStatusUpdate(true)}
                    className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate(false)}
                    className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </>
              )}
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
            <p className="text-gray-500 dark:text-gray-400 mb-4">No branch context available</p>
          </div>
        ) : (viewMode === 'table' ? loading.tree : loading.tree) ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <>
            {viewMode === 'tree' ? (
              <ChartOfAccountTree
                tree={tree}
                onView={id => navigate(`/chart-of-accounts/${id}`)}
                onEdit={id => navigate(`/chart-of-accounts/${id}/edit`)}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onAddChild={parentId => navigate(`/chart-of-accounts/new?parent=${parentId}`)}
                canEdit={true}
                canDelete={true}
              />
            ) : (
              <ChartOfAccountTable
                accounts={debouncedSearch ? filterTree(tree, debouncedSearch) : flattenTree(tree)}
                onView={id => navigate(`/chart-of-accounts/${id}`)}
                onEdit={id => navigate(`/chart-of-accounts/${id}/edit`)}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onAddChild={parentId => navigate(`/chart-of-accounts/new?parent=${parentId}`)}
                canEdit={true}
                canDelete={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            )}
            

          </>
        )}
      </div>

      {/* Global Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  )
}
