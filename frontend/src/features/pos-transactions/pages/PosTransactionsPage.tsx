import { useState, useEffect, useCallback } from 'react'
import { Filter, X } from 'lucide-react'
import { posTransactionsApi, type PosTransactionFilters } from '../api/pos-transactions.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useBranchesStore } from '@/features/branches/store/branches.store'
import { usePaymentMethodsStore } from '@/features/payment-methods/store/paymentMethods.store'

interface PosTransaction {
  id: string
  sales_date: string
  bill_number: string
  branch: string
  menu: string
  payment_method: string
  qty: number
  price: number
  subtotal: number
  discount: number
  tax: number
  total: number
}

export function PosTransactionsPage() {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const { branches, fetchBranches } = useBranchesStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore()
  const [transactions, setTransactions] = useState<PosTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 })
  const [filters, setFilters] = useState<PosTransactionFilters>({})

  useEffect(() => {
    if (currentBranch?.company_id) {
      fetchBranches()
      fetchPaymentMethods()
    }
  }, [currentBranch?.company_id, fetchBranches, fetchPaymentMethods])

  const fetchTransactions = useCallback(async () => {
    if (!currentBranch?.company_id) return
    
    setLoading(true)
    try {
      const result = await posTransactionsApi.list({ 
        page: pagination.page, 
        limit: pagination.limit,
        ...filters 
      })
      setTransactions(result.data?.data || [])
      setPagination(prev => ({ ...prev, total: result.data?.total || 0 }))
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [currentBranch?.company_id, pagination.page, pagination.limit, filters])

  useEffect(() => {
    // Don't auto-load on mount, only when page changes
    if (currentBranch?.company_id && pagination.page > 1) {
      fetchTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page])

  const handleFilterChange = (key: keyof PosTransactionFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchTransactions()
  }

  const handleClearFilters = () => {
    setFilters({})
    setTransactions([])
    setPagination({ page: 1, limit: 50, total: 0 })
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  if (!currentBranch?.company_id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a branch to view transactions</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">POS Transactions</h1>
          <p className="text-sm text-gray-600 mt-1">Consolidated view of all imported transactions</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
        >
          <Filter size={16} />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-4 gap-4">
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              placeholder="Date From"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              placeholder="Date To"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={filters.salesNumber || ''}
              onChange={(e) => handleFilterChange('salesNumber', e.target.value)}
              placeholder="Sales Number"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={filters.billNumber || ''}
              onChange={(e) => handleFilterChange('billNumber', e.target.value)}
              placeholder="Bill Number"
              className="border rounded px-3 py-2 text-sm"
            />
            <select
              value={filters.branch || ''}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
              ))}
            </select>
            <input
              type="text"
              value={filters.menuName || ''}
              onChange={(e) => handleFilterChange('menuName', e.target.value)}
              placeholder="Menu Name"
              className="border rounded px-3 py-2 text-sm"
            />
            <select
              value={filters.paymentMethod || ''}
              onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.name}>{pm.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={filters.menuCategory || ''}
              onChange={(e) => handleFilterChange('menuCategory', e.target.value)}
              placeholder="Menu Category"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={filters.salesType || ''}
              onChange={(e) => handleFilterChange('salesType', e.target.value)}
              placeholder="Sales Type"
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              <X size={16} className="inline mr-1" />
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-2 text-sm text-gray-600">Loading transactions...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                        {loading ? 'Loading...' : 'Click "Apply Filters" to search transactions'}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{tx.bill_number}</td>
                        <td className="px-4 py-3 text-sm">{new Date(tx.sales_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm">{tx.branch}</td>
                        <td className="px-4 py-3 text-sm">{tx.menu}</td>
                        <td className="px-4 py-3 text-sm">{tx.payment_method}</td>
                        <td className="px-4 py-3 text-sm text-right">{tx.qty}</td>
                        <td className="px-4 py-3 text-sm text-right">Rp {Number(tx.price || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm text-right">Rp {Number(tx.subtotal || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm text-right">Rp {Number(tx.discount || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm text-right">Rp {Number(tx.tax || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">Rp {Number(tx.total || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">
                    Page {pagination.page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))}
                    disabled={pagination.page === totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50"
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
