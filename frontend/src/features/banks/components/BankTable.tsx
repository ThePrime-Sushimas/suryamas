import { TableSkeleton } from '@/components/ui/Skeleton'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Search } from 'lucide-react'
import { useBanksStore } from '../store/useBanks'
import { BankStatusBadge } from './BankStatusBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'

const inputCls = "w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
const selectCls = "px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"

export const BankTable = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    banks, pagination, fetchLoading, mutationLoading,
    searchQuery, activeFilter,
    fetchBanks, searchBanks, filterByStatus, deleteBank
  } = useBanksStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const debouncedSearch = useDebounce(localSearch, 500)

  useEffect(() => { fetchBanks() }, [fetchBanks])
  useEffect(() => { searchBanks(debouncedSearch) }, [debouncedSearch, searchBanks])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteBank(deleteId)
      toast.success('Bank deleted successfully')
      setDeleteId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete bank')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search by code or name..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className={inputCls} />
        </div>
        <select
          value={activeFilter === undefined ? 'all' : activeFilter ? 'active' : 'inactive'}
          onChange={(e) => filterByStatus(e.target.value === 'all' ? undefined : e.target.value === 'active')}
          className={selectCls}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank Code</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank Name</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {fetchLoading ? (
                <tr><td colSpan={4}><TableSkeleton rows={5} columns={4} /></td></tr>
              ) : banks.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No banks found</td></tr>
              ) : banks.map((bank) => (
                <tr key={bank.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{bank.bank_code}</td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{bank.bank_name}</td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm"><BankStatusBadge isActive={bank.is_active} /></td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => navigate(`/settings/banks/${bank.id}/edit`)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(bank.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-400">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</div>
            <div className="flex gap-2">
              <button onClick={() => fetchBanks(pagination.page - 1, pagination.limit)} disabled={!pagination.hasPrev || fetchLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Previous</button>
              <button onClick={() => fetchBanks(pagination.page + 1, pagination.limit)} disabled={!pagination.hasNext || fetchLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden space-y-3">
        {fetchLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
        ) : banks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">No banks found</div>
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

        {pagination.totalPages > 1 && (
          <div className="flex gap-2 justify-center pt-2">
            <button onClick={() => fetchBanks(pagination.page - 1, pagination.limit)} disabled={!pagination.hasPrev || fetchLoading}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50">Prev</button>
            <span className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">{pagination.page}/{pagination.totalPages}</span>
            <button onClick={() => fetchBanks(pagination.page + 1, pagination.limit)} disabled={!pagination.hasNext || fetchLoading}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      <ConfirmModal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Bank" message="Are you sure you want to delete this bank? This action cannot be undone."
        confirmText="Delete" variant="danger" isLoading={mutationLoading} />
    </div>
  )
}
