import { TableSkeleton } from '@/components/ui/Skeleton'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Search } from 'lucide-react'
import { useBanksStore } from '../store/useBanks'
import { BankStatusBadge } from './BankStatusBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'

export const BankTable = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { 
    banks, 
    pagination, 
    fetchLoading, 
    mutationLoading,
    searchQuery,
    activeFilter,
    fetchBanks, 
    searchBanks,
    filterByStatus,
    deleteBank 
  } = useBanksStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const debouncedSearch = useDebounce(localSearch, 500)

  useEffect(() => {
    fetchBanks()
  }, [fetchBanks])

  useEffect(() => {
    searchBanks(debouncedSearch)
  }, [debouncedSearch, searchBanks])

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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={activeFilter === undefined ? 'all' : activeFilter ? 'active' : 'inactive'}
          onChange={(e) => filterByStatus(e.target.value === 'all' ? undefined : e.target.value === 'active')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fetchLoading ? (
                <tr>
                  <td colSpan={4}>
                    <TableSkeleton rows={5} columns={4} />
                  </td>
                </tr>
              ) : banks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No banks found
                  </td>
                </tr>
              ) : (
                banks.map((bank) => (
                  <tr key={bank.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {bank.bank_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bank.bank_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <BankStatusBadge isActive={bank.is_active} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/settings/banks/${bank.id}/edit`)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(bank.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchBanks(pagination.page - 1, pagination.limit)}
                disabled={!pagination.hasPrev || fetchLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchBanks(pagination.page + 1, pagination.limit)}
                disabled={!pagination.hasNext || fetchLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Bank"
        message="Are you sure you want to delete this bank? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={mutationLoading}
      />
    </div>
  )
}
