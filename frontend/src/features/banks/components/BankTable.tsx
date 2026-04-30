import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Search, X, Landmark, RefreshCw } from 'lucide-react'
import { useBanksStore } from '../store/useBanks'
import { BankStatusBadge } from './BankStatusBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import type { BankListQuery } from '../types'

const TABLE_COLS = 4

export const BankTable = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { banks, pagination, fetchLoading, mutationLoading, error, fetchPage, deleteBank, clearError } = useBanksStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const debouncedSearch = useDebounce(search, 500)

  const buildQuery = useCallback((): Omit<BankListQuery, 'page' | 'limit'> => {
    const q: Omit<BankListQuery, 'page' | 'limit'> = {}
    if (debouncedSearch) q.search = debouncedSearch
    if (statusFilter !== 'all') q.is_active = statusFilter === 'active'
    return q
  }, [debouncedSearch, statusFilter])

  const doFetch = useCallback((page: number, limit?: number) => {
    fetchPage(page, limit, buildQuery())
  }, [fetchPage, buildQuery])

  useEffect(() => {
    doFetch(1)
  }, [debouncedSearch, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteBank(deleteId)
      toast.success('Bank berhasil dihapus')
      setDeleteId(null)
      doFetch(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus bank')
    }
  }

  return (
    <div className="space-y-4">
      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>Terjadi kesalahan saat memuat data</span>
          <button
            onClick={() => { clearError(); doFetch(pagination.page) }}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 dark:bg-red-800 rounded-lg hover:bg-red-200 dark:hover:bg-red-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak Aktif</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kode Bank</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Bank</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {fetchLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: TABLE_COLS }).map((_, j) => (
                      <td key={j} className="px-4 lg:px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : banks.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-6 py-16 text-center">
                    <Landmark className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada bank ditemukan</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Coba ubah filter atau tambah bank baru</p>
                  </td>
                </tr>
              ) : banks.map((bank) => (
                <tr key={bank.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{bank.bank_code}</td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{bank.bank_name}</td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm"><BankStatusBadge isActive={bank.is_active} /></td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => navigate(`/settings/banks/${bank.id}/edit`)} title="Edit" className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(bank.id)} title="Hapus" className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.total > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={(p) => doFetch(p)}
            onLimitChange={(l) => doFetch(1, l)}
            currentLength={banks.length}
            loading={fetchLoading}
          />
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden space-y-3">
        {fetchLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
        ) : banks.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Landmark className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada bank ditemukan</p>
          </div>
        ) : banks.map((bank) => (
          <div key={bank.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{bank.bank_code}</span>
                <BankStatusBadge isActive={bank.is_active} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{bank.bank_name}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => navigate(`/settings/banks/${bank.id}/edit`)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => setDeleteId(bank.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}

        {pagination.total > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={(p) => doFetch(p)}
            onLimitChange={(l) => doFetch(1, l)}
            currentLength={banks.length}
            loading={fetchLoading}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Bank"
        message="Apakah Anda yakin ingin menghapus bank ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={mutationLoading}
      />
    </div>
  )
}
