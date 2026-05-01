import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePaymentTermsStore } from '../store/paymentTerms.store'
import { PaymentTermTable } from '../components/PaymentTermTable'
import { PaymentTermFilters } from '../components/PaymentTermFilters'
import { PaymentTermDeleteDialog } from '../components/PaymentTermDeleteDialog'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { Pagination } from '@/components/ui/Pagination'
import { FileText, Plus, Search, X } from 'lucide-react'

export default function PaymentTermsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    paymentTerms,
    loading,
    pagination,
    deletePaymentTerm,
    restorePaymentTerm,
    searchPaymentTerms,
    setFilter,
    fetchPage,
  } = usePaymentTermsStore()

  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<{ calculation_type?: string; is_active?: string; include_deleted?: string }>({})
  const [showFilter, setShowFilter] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: number | null; name: string; isRestore: boolean }>({
    isOpen: false, id: null, name: '', isRestore: false,
  })

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (debouncedSearch) {
      searchPaymentTerms(debouncedSearch)
    } else {
      // Clear q from filter without wiping other active filters
      const currentFilter = usePaymentTermsStore.getState().filter
      if (currentFilter?.q) {
        const { q: _, ...rest } = currentFilter as Record<string, unknown>
        setFilter(Object.keys(rest).length > 0 ? rest : null)
      }
      fetchPage(1)
    }
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { usePaymentTermsStore.getState().reset() }
  }, [])

  const activeFilterCount = useMemo(
    () => (localFilter.calculation_type ? 1 : 0) + (localFilter.is_active ? 1 : 0) + (localFilter.include_deleted ? 1 : 0),
    [localFilter]
  )

  const handleConfirmAction = async () => {
    if (!deleteDialog.id) return
    try {
      if (deleteDialog.isRestore) {
        await restorePaymentTerm(deleteDialog.id)
        toast.success('Syarat pembayaran berhasil dipulihkan')
      } else {
        await deletePaymentTerm(deleteDialog.id)
        toast.success('Syarat pembayaran berhasil dihapus')
      }
      setDeleteDialog({ isOpen: false, id: null, name: '', isRestore: false })
    } catch (error: unknown) {
      toast.error(parseApiError(error, 'Terjadi kesalahan'))
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    const newLocalFilter = { ...localFilter }
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
    fetchPage(1)
  }

  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Syarat Pembayaran</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} total</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/payment-terms/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Tambah Syarat
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari kode, nama, atau deskripsi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
            onDelete={(id, name) => setDeleteDialog({ isOpen: true, id, name, isRestore: false })}
            onRestore={(id, name) => setDeleteDialog({ isOpen: true, id, name, isRestore: true })}
            loading={loading}
          />

          {!loading && paymentTerms.length > 0 && (
            <Pagination
              pagination={pagination}
              onPageChange={(p) => fetchPage(p)}
              onLimitChange={(l) => fetchPage(1, l)}
              currentLength={paymentTerms.length}
              loading={loading}
            />
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
