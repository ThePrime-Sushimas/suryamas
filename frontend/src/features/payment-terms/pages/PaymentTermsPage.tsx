import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePaymentTermsStore } from '../store/paymentTerms.store'
import { PaymentTermTable } from '../components/PaymentTermTable'
import { PaymentTermFilters } from '../components/PaymentTermFilters'
import { PaymentTermDeleteDialog } from '../components/PaymentTermDeleteDialog'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { FileText, Plus, Search, X } from 'lucide-react'

export default function PaymentTermsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { 
    paymentTerms, 
    loading, 
    pagination,
    filter,
    deletePaymentTerm,
    restorePaymentTerm,
    searchPaymentTerms,
    setPage,
    setFilter,
    fetchPaymentTerms
  } = usePaymentTermsStore()
  
  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<{ calculation_type?: string; is_active?: string; include_deleted?: string }>({})
  const [showFilter, setShowFilter] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: number | null; name: string; isRestore: boolean }>({
    isOpen: false,
    id: null,
    name: '',
    isRestore: false
  })

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (debouncedSearch) {
      searchPaymentTerms(debouncedSearch)
    } else {
      const currentFilter = filter
      const newFilter = currentFilter ? { ...currentFilter, q: undefined } : null
      setFilter(newFilter)
    }
  }, [debouncedSearch, searchPaymentTerms, setFilter])

  useEffect(() => {
    fetchPaymentTerms()
    
    return () => {
      usePaymentTermsStore.getState().reset()
    }
  }, [fetchPaymentTerms])

  const activeFilterCount = useMemo(
    () => (localFilter.calculation_type ? 1 : 0) + (localFilter.is_active ? 1 : 0) + (localFilter.include_deleted ? 1 : 0),
    [localFilter]
  )

  const handleDelete = useCallback((id: number, termName: string) => {
    setDeleteDialog({ isOpen: true, id, name: termName, isRestore: false })
  }, [])

  const handleRestore = useCallback((id: number, termName: string) => {
    setDeleteDialog({ isOpen: true, id, name: termName, isRestore: true })
  }, [])

  const handleConfirmAction = useCallback(async () => {
    if (!deleteDialog.id) return

    try {
      if (deleteDialog.isRestore) {
        await restorePaymentTerm(deleteDialog.id)
        toast.success('Payment term restored successfully')
      } else {
        await deletePaymentTerm(deleteDialog.id)
        toast.success('Payment term deleted successfully')
      }
      setDeleteDialog({ isOpen: false, id: null, name: '', isRestore: false })
    } catch {
      toast.error(`Failed to ${deleteDialog.isRestore ? 'restore' : 'delete'} payment term`)
    }
  }, [deleteDialog, deletePaymentTerm, restorePaymentTerm, toast])

  const handleFilterChange = (key: string, value: string) => {
    const newLocalFilter = { ...localFilter }
    
    // Remove key if value is empty ("All" selected)
    if (!value) {
      delete newLocalFilter[key as keyof typeof newLocalFilter]
    } else {
      newLocalFilter[key as keyof typeof newLocalFilter] = value
    }
    
    setLocalFilter(newLocalFilter)
    
    const apiFilter: Record<string, string | boolean> = {}
    if (newLocalFilter.calculation_type) apiFilter.calculation_type = newLocalFilter.calculation_type
    if (newLocalFilter.is_active !== undefined) apiFilter.is_active = newLocalFilter.is_active === 'true'
    if (newLocalFilter.include_deleted !== undefined) apiFilter.includeDeleted = newLocalFilter.include_deleted === 'true'
    if (search) apiFilter.q = search
    
    setFilter(Object.keys(apiFilter).length > 0 ? apiFilter : null)
    fetchPaymentTerms()
  }

  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Payment Terms</h1>
                <p className="text-sm text-gray-500">{pagination.total} total</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/payment-terms/new')} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Payment Term
            </button>
          </div>
        </div>

        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by term code, name, or description..."
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
            <PaymentTermFilters
              isOpen={showFilter}
              onToggle={() => setShowFilter(!showFilter)}
              calculationType={localFilter.calculation_type}
              isActive={localFilter.is_active}
              includeDeleted={localFilter.include_deleted}
              onCalculationTypeChange={value => handleFilterChange('calculation_type', value)}
              onIsActiveChange={value => handleFilterChange('is_active', value)}
              onIncludeDeletedChange={value => handleFilterChange('include_deleted', value)}
              activeCount={activeFilterCount}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <PaymentTermTable 
            paymentTerms={paymentTerms} 
            onEdit={id => navigate(`/payment-terms/${id}/edit`)} 
            onDelete={handleDelete}
            onRestore={handleRestore}
            loading={loading}
          />

          {!loading && paymentTerms.length > 0 && (
            <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{paymentTerms.length}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPage(pagination.page - 1)
                    fetchPaymentTerms()
                  }}
                  disabled={!pagination.hasPrev || loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page <span className="font-medium">{pagination.page}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span>
                </span>
                <button
                  onClick={() => {
                    setPage(pagination.page + 1)
                    fetchPaymentTerms()
                  }}
                  disabled={!pagination.hasNext || loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PaymentTermDeleteDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, name: '', isRestore: false })}
        onConfirm={handleConfirmAction}
        termName={deleteDialog.name}
        isRestore={deleteDialog.isRestore}
        isLoading={loading}
      />
    </>
  )
}
