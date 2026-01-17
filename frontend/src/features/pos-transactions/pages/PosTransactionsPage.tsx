import { useState, useEffect, useCallback } from 'react'
import { Filter, X, Download, TrendingUp, Receipt, DollarSign, Percent, ChevronDown } from 'lucide-react'
import { posTransactionsApi, type PosTransactionFilters } from '../api/pos-transactions.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useBranchesStore } from '@/features/branches/store/branches.store'
import { usePaymentMethodsStore } from '@/features/payment-methods/store/paymentMethods.store'
import { useJobsStore } from '@/features/jobs'

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

interface Summary {
  totalAmount: number
  totalTax: number
  totalDiscount: number
  totalSubtotal: number
  transactionCount: number
}

export function PosTransactionsPage() {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const { branches, fetchBranches } = useBranchesStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore()
  const { fetchRecentJobs } = useJobsStore()
  const [transactions, setTransactions] = useState<PosTransaction[]>([])
  const [summary, setSummary] = useState<Summary>({ totalAmount: 0, totalTax: 0, totalDiscount: 0, totalSubtotal: 0, transactionCount: 0 })
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 })
  const [filters, setFilters] = useState<PosTransactionFilters>({})
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false)

  useEffect(() => {
    if (currentBranch?.company_id) {
      fetchBranches(1, 100)
      fetchPaymentMethods(1, 100)
      // Don't set default date - let user choose
    }
  }, [currentBranch?.company_id, fetchBranches, fetchPaymentMethods])

  const fetchTransactions = useCallback(async () => {
    if (!currentBranch?.company_id) return
    
    setLoading(true)
    try {
      const result = await posTransactionsApi.list({ 
        page: pagination.page, 
        limit: pagination.limit,
        ...filters,
        // If nothing selected = select all (don't send filter)
        branches: selectedBranches.length > 0 ? selectedBranches.join(',') : undefined,
        paymentMethods: selectedPayments.length > 0 ? selectedPayments.join(',') : undefined
      })
      setTransactions(result.data?.data || [])
      setPagination(prev => ({ ...prev, total: result.data?.total || 0 }))
      setSummary(result.data?.summary || { totalAmount: 0, totalTax: 0, totalDiscount: 0, totalSubtotal: 0, transactionCount: 0 })
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [currentBranch?.company_id, pagination.page, pagination.limit, filters, selectedBranches, selectedPayments])

  const handleFilterChange = (key: keyof PosTransactionFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  const handleBranchToggle = (branchName: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchName) 
        ? prev.filter(b => b !== branchName)
        : [...prev, branchName]
    )
  }

  const handlePaymentToggle = (paymentName: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentName) 
        ? prev.filter(p => p !== paymentName)
        : [...prev, paymentName]
    )
  }

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchTransactions()
  }

  const handleClearFilters = () => {
    setFilters({})
    setSelectedBranches([])
    setSelectedPayments([])
  }

  const handleExport = async () => {
    if (transactions.length === 0) return
    
    setLoading(true)
    try {
      await posTransactionsApi.export({
        ...filters,
        branches: selectedBranches.length > 0 ? selectedBranches.join(',') : undefined,
        paymentMethods: selectedPayments.length > 0 ? selectedPayments.join(',') : undefined
      })
      
      // Show success message
      alert('Export job created! Check the notification bell for progress.')
      
      // Refresh jobs list
      fetchRecentJobs()
    } catch (error) {
      console.error('Failed to export:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create export job'
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'lastMonth') => {
    const today = new Date()
    let dateFrom = ''
    let dateTo = today.toISOString().split('T')[0]

    switch (preset) {
      case 'today': {
        dateFrom = dateTo
        break
      }
      case 'week': {
        const weekAgo = new Date(today)
        weekAgo.setDate(today.getDate() - 7)
        dateFrom = weekAgo.toISOString().split('T')[0]
        break
      }
      case 'month': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        dateFrom = monthStart.toISOString().split('T')[0]
        break
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        dateFrom = lastMonthStart.toISOString().split('T')[0]
        dateTo = lastMonthEnd.toISOString().split('T')[0]
        break
      }
    }

    setFilters(prev => ({ ...prev, dateFrom, dateTo }))
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
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
            disabled={transactions.length === 0}
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            <Filter size={16} />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>
      </div>

      {summary.transactionCount > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">Rp {summary.totalAmount.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tax</p>
                <p className="text-2xl font-bold text-gray-900">Rp {summary.totalTax.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Discount</p>
                <p className="text-2xl font-bold text-gray-900">Rp {summary.totalDiscount.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Percent className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{summary.transactionCount.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Receipt className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setDatePreset('today')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Today</button>
            <button onClick={() => setDatePreset('week')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">This Week</button>
            <button onClick={() => setDatePreset('month')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">This Month</button>
            <button onClick={() => setDatePreset('lastMonth')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Last Month</button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            
            {/* Branch Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className="w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50"
              >
                <span>{selectedBranches.length === 0 ? 'All Branches' : `${selectedBranches.length} selected`}</span>
                <ChevronDown size={16} />
              </button>
              {showBranchDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(b.branch_name)}
                        onChange={() => handleBranchToggle(b.branch_name)}
                        className="mr-2"
                      />
                      <span className="text-sm">{b.branch_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                className="w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50"
              >
                <span>{selectedPayments.length === 0 ? 'All Payments' : `${selectedPayments.length} selected`}</span>
                <ChevronDown size={16} />
              </button>
              {showPaymentDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                  {paymentMethods.map(pm => (
                    <label key={pm.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPayments.includes(pm.name)}
                        onChange={() => handlePaymentToggle(pm.name)}
                        className="mr-2"
                      />
                      <span className="text-sm">{pm.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
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
            <input
              type="text"
              value={filters.menuName || ''}
              onChange={(e) => handleFilterChange('menuName', e.target.value)}
              placeholder="Menu Name"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={filters.menuCategory || ''}
              onChange={(e) => handleFilterChange('menuCategory', e.target.value)}
              placeholder="Menu Category"
              className="border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
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
                        Click "Apply Filters" to search transactions
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
