import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { useCompaniesStore } from '@/features/companies'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountTable } from '../components/ChartOfAccountTable'
import { ChartOfAccountTree } from '../components/ChartOfAccountTree'
// import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { useToast } from '@/contexts/ToastContext'
import { Building2, Plus, Search, X, Table, TreePine } from 'lucide-react'
import type { ChartOfAccountTreeNode, ChartOfAccount } from '../types/chart-of-account.types'

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
  const { companies, fetchPage } = useCompaniesStore()
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
    setViewMode,
    resetList,
    resetTree
  } = useChartOfAccountsStore()
  
  const [search, setSearch] = useState('')
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
  


  const loadData = useCallback(() => {
    if (!selectedCompanyId) return
    return fetchTree()
  }, [selectedCompanyId, fetchTree])



  useEffect(() => {
    // Only fetch if companies list is empty
    if (companies.length === 0) {
      fetchPage(1, 100) // Load companies to get company name
    }
  }, [fetchPage, companies.length])

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
      title: 'Hapus Akun',
      message: `Yakin ingin menghapus "${accountToDelete?.account_name || 'akun ini'}"? Tindakan ini tidak bisa dibatalkan.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteAccount(id)
          success('Akun berhasil dihapus')
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Gagal menghapus akun')
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
      title: 'Hapus Akun',
      message: `Yakin ingin menghapus ${selectedIds.length} akun? Tindakan ini tidak bisa dibatalkan.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await bulkDelete(selectedIds)
          setSelectedIds([])
          success(`${selectedIds.length} akun berhasil dihapus`)
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Gagal menghapus akun')
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
      title: 'Pulihkan Akun',
      message: 'Yakin ingin memulihkan akun ini?',
      variant: 'success',
      onConfirm: async () => {
        try {
          await restoreAccount(id)
          success('Akun berhasil dipulihkan')
        } catch {
          if (error?.scope === 'submit') {
            showError(error.message)
          } else {
            showError('Gagal memulihkan akun')
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [selectedCompanyId, restoreAccount, error, success, showError])

  const handleBulkStatusUpdate = useCallback(async (is_active: boolean) => {
    if (!selectedCompanyId) return
    if (selectedIds.length === 0) return
    
    try {
      await bulkUpdateStatus(selectedIds, is_active)
      setSelectedIds([])
      success(`${selectedIds.length} akun berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch {
      if (error?.scope === 'submit') {
        showError(error.message)
      } else {
        showError('Gagal mengubah status akun')
      }
    }
  }, [selectedCompanyId, selectedIds, bulkUpdateStatus, error, success, showError])

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
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Daftar Akun</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">{companyName}</span>
                <span className="mx-2">•</span>
                {viewMode === 'tree' ? `${tree.length} akun induk` : `${debouncedSearch ? filterTree(tree, debouncedSearch).length : flattenTree(tree).length} akun`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/chart-of-accounts/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Buat Akun
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
              placeholder="Cari akun..."
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
            
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && viewMode === 'table' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{selectedIds.length} dipilih</span>
              <button
                onClick={() => handleBulkStatusUpdate(true)}
                className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50"
              >
                Aktifkan
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(false)}
                className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
              >
                Nonaktifkan
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1"
              >
                Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedCompanyId ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Tidak ada konteks cabang</p>
          </div>
        ) : (viewMode === 'table' ? loading.tree : loading.tree) ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Memuat...</div>
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
