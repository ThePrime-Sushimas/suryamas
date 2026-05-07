import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, X, Filter } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePaymentTerms, useDeletePaymentTerm, useRestorePaymentTerm } from '../api/paymentTerms.api'
import { PaymentTermTable } from '../components/PaymentTermTable'
import type { FilterParams } from '../types'

export default function PaymentTermsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [calcType, setCalcType] = useState('')
  const [isActive, setIsActive] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [actionDialog, setActionDialog] = useState<{ id: number; name: string; isRestore: boolean } | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const filter = useMemo((): FilterParams | null => {
    const f: FilterParams = {}
    if (debouncedSearch) f.q = debouncedSearch
    if (calcType) f.calculation_type = calcType as FilterParams['calculation_type']
    if (isActive) f.is_active = isActive === 'true'
    return Object.keys(f).length > 0 ? f : null
  }, [debouncedSearch, calcType, isActive])

  const { data, isLoading } = usePaymentTerms({ page, limit, filter, includeDeleted: includeDeleted || undefined })
  const deleteTerm = useDeletePaymentTerm()
  const restoreTerm = useRestorePaymentTerm()

  const paymentTerms = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const activeFilterCount = (calcType ? 1 : 0) + (isActive ? 1 : 0) + (includeDeleted ? 1 : 0)

  const handleConfirmAction = async () => {
    if (!actionDialog) return
    try {
      if (actionDialog.isRestore) {
        await restoreTerm.mutateAsync(actionDialog.id)
        toast.success('Syarat pembayaran berhasil dipulihkan')
      } else {
        await deleteTerm.mutateAsync(actionDialog.id)
        toast.success('Syarat pembayaran berhasil dihapus')
      }
    } catch (err: unknown) { toast.error(parseApiError(err, 'Terjadi kesalahan')) }
    finally { setActionDialog(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Syarat Pembayaran</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/payment-terms/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Tambah Syarat
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari kode atau nama..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilter ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
          </button>
        </div>
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={calcType} onChange={e => { setCalcType(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Tipe Kalkulasi</option>
              <option value="from_invoice">Dari Invoice</option>
              <option value="from_delivery">Dari Pengiriman</option>
              <option value="fixed_date">Tanggal Tetap</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
            <select value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeDeleted} onChange={e => { setIncludeDeleted(e.target.checked); setPage(1) }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
              Tampilkan Terhapus
            </label>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <PaymentTermTable paymentTerms={paymentTerms} loading={isLoading}
          onEdit={id => navigate(`/payment-terms/${id}/edit`)}
          onDelete={(id, name) => setActionDialog({ id, name, isRestore: false })}
          onRestore={(id, name) => setActionDialog({ id, name, isRestore: true })} />
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={paymentTerms.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!actionDialog} onClose={() => setActionDialog(null)} onConfirm={handleConfirmAction}
        title={actionDialog?.isRestore ? 'Pulihkan Syarat' : 'Hapus Syarat'}
        message={`Yakin ingin ${actionDialog?.isRestore ? 'memulihkan' : 'menghapus'} "${actionDialog?.name}"?`}
        confirmText={actionDialog?.isRestore ? 'Pulihkan' : 'Hapus'}
        variant={actionDialog?.isRestore ? 'success' : 'danger'}
        isLoading={deleteTerm.isPending || restoreTerm.isPending} />
    </div>
  )
}
