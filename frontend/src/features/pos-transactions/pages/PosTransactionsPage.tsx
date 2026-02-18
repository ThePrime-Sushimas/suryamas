import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { Filter, X, Download, ChevronDown } from 'lucide-react'
import { posTransactionsApi, type PosTransactionFilters } from '../api/pos-transactions.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useBranchesStore } from '@/features/branches/store/branches.store'
import { usePaymentMethodsStore } from '@/features/payment-methods/store/paymentMethods.store'
import { useJobsStore } from '@/features/jobs'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { handleError } from '@/lib/errorParser'
import { useToast } from '@/contexts/ToastContext'
import { TableSkeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import {
  PAGINATION_CONFIG,
  DATE_PRESETS,
  LOCALE_CONFIG,
  TABLE_CONFIG,
  MESSAGE_CONFIG,
} from '../constants/pos-transactions.constants'

// Loading component using existing Skeleton
const LoadingContent = () => (
  <div className="p-6 space-y-6">
    {/* Header skeleton */}
    <div className="flex items-center justify-between">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
      <div className="flex gap-2">
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
      </div>
    </div>
    {/* Cards skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    {/* Table skeleton */}
    <TableSkeleton rows={10} columns={13} />
  </div>
)

// Error fallback component
const ErrorFallback = () => (
  <div className="p-6">
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{MESSAGE_CONFIG.ERROR_TITLE}</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{MESSAGE_CONFIG.ERROR_MESSAGE}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-600 dark:bg-red-600 text-white rounded hover:bg-red-700 dark:hover:bg-red-700"
      >
        {MESSAGE_CONFIG.RELOAD_BUTTON}
      </button>
    </div>
  </div>
)

interface PosTransactionsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

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
  bill_discount?: number
  total_after_bill_discount?: number
  tax: number
  total: number
}

interface Summary {
  totalAmount: number
  totalTax: number
  totalDiscount: number
  totalBillDiscount: number
  totalAfterBillDiscount: number
  totalSubtotal: number
  transactionCount: number
}

export function PosTransactionsPage() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Suspense fallback={<LoadingContent />}>
        <PosTransactionsContent />
      </Suspense>
    </ErrorBoundary>
  )
}

function PosTransactionsContent() {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const { branches, fetchBranches } = useBranchesStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore()
  const { fetchRecentJobs } = useJobsStore()
  const toast = useToast()
  const [transactions, setTransactions] = useState<PosTransaction[]>([])
  const [summary, setSummary] = useState<Summary>({ totalAmount: 0, totalTax: 0, totalDiscount: 0, totalAfterBillDiscount:0, totalBillDiscount:0, totalSubtotal: 0, transactionCount: 0 })
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [pagination, setPagination] = useState<PosTransactionsPagination>({ 
    page: 1, 
    limit: PAGINATION_CONFIG.DEFAULT_PAGE_SIZE, 
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [filters, setFilters] = useState<PosTransactionFilters>({})
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false)
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false)
  
  // Refs for dropdown click outside detection
  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const paymentDropdownRef = useRef<HTMLDivElement>(null)

  // Effect to fetch data when limit changes (without requiring Apply Filters)
  useEffect(() => {
    if (hasAppliedFilters && currentBranch?.company_id) {
      fetchTransactions(1)
    }
  }, [pagination.limit])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false)
      }
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(event.target as Node)) {
        setShowPaymentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (currentBranch?.company_id) {
      fetchBranches(1, PAGINATION_CONFIG.BRANCHES_PAGE_SIZE)
      fetchPaymentMethods(1, PAGINATION_CONFIG.PAYMENT_METHODS_PAGE_SIZE)
      // Don't set default date - let user choose
    }
  }, [currentBranch?.company_id, fetchBranches, fetchPaymentMethods])

  const fetchTransactions = useCallback(async (pageOverride?: number) => {
    if (!currentBranch?.company_id) return
    
    const abortController = new AbortController()
    setLoading(true)
    
    try {
      const currentPage = pageOverride ?? pagination.page
      
      const result = await posTransactionsApi.list({ 
        page: currentPage, 
        limit: pagination.limit,
        ...filters,
        branches: selectedBranches.length > 0 ? selectedBranches.join(',') : undefined,
        paymentMethods: selectedPayments.length > 0 ? selectedPayments.join(',') : undefined
      }, {
        signal: abortController.signal
      })
      
      if (!abortController.signal.aborted) {
        setTransactions(result.data?.data || [])
        const total = result.data?.total || 0
        const totalPages = Math.ceil(total / pagination.limit)
        setPagination(prev => ({ 
          ...prev, 
          total,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        }))
        setSummary(result.data?.summary || { 
          totalAmount: 0, 
          totalTax: 0, 
          totalDiscount: 0, 
          totalBillDiscount: 0,
          totalAfterBillDiscount: 0,
          totalSubtotal: 0, 
          transactionCount: 0 
        })
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        // Use centralized error handler (toast is already shown by axios interceptor)
        handleError(error, { module: 'PosTransactions', action: 'fetchTransactions' }, { showToast: false })
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
      }
    }
    
    return () => abortController.abort()
  }, [currentBranch?.company_id, pagination.limit, filters, selectedBranches, selectedPayments])

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
    setHasAppliedFilters(true)
    fetchTransactions()
  }

  // Check if date filters are selected (both dateFrom and dateTo required)
  const isDateFilterValid = Boolean(filters.dateFrom && filters.dateTo)

  const handleClearFilters = () => {
    setFilters({})
    setSelectedBranches([])
    setSelectedPayments([])
    setHasAppliedFilters(false)
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
      
      // Show success message using toast
      toast.success(MESSAGE_CONFIG.EXPORT_SUCCESS)
      
      // Refresh jobs list
      fetchRecentJobs()
    } catch (error) {
      // Use centralized error handler
      handleError(error, { module: 'PosTransactions', action: 'handleExport' })
    } finally {
      setLoading(false)
    }
  }

  const setDatePreset = (preset: typeof DATE_PRESETS[keyof typeof DATE_PRESETS]) => {
    const today = new Date()
    let dateFrom = ''
    let dateTo = today.toISOString().split('T')[0]

    switch (preset) {
      case DATE_PRESETS.TODAY: {
        dateFrom = dateTo
        break
      }
      case DATE_PRESETS.WEEK: {
        const weekAgo = new Date(today)
        weekAgo.setDate(today.getDate() - 7)
        dateFrom = weekAgo.toISOString().split('T')[0]
        break
      }
      case DATE_PRESETS.MONTH: {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        dateFrom = monthStart.toISOString().split('T')[0]
        break
      }
      case DATE_PRESETS.LAST_MONTH: {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        dateFrom = lastMonthStart.toISOString().split('T')[0]
        dateTo = lastMonthEnd.toISOString().split('T')[0]
        break
      }
    }

    setFilters(prev => ({ ...prev, dateFrom, dateTo }))
  }

  // Pagination handlers for global Pagination component
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    fetchTransactions(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    const limit = newLimit as number
    setPagination(prev => ({ 
      ...prev, 
      limit, 
      page: 1,
      totalPages: Math.ceil(prev.total / limit)
    }))
    fetchTransactions(1)
  }

  if (!currentBranch?.company_id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-300">{MESSAGE_CONFIG.NO_BRANCH_SELECTED}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS Transactions</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Consolidated view of all imported transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            disabled={transactions.length === 0}
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Filter size={16} />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>
      </div>

      {summary.transactionCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Amount</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Rp {(summary.totalAmount || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Tax</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Rp {(summary.totalTax || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Bill Discount</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Rp {(summary.totalBillDiscount || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</p>
              </div>

            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">After Bill Disc</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">Rp {(summary.totalAfterBillDiscount || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Transactions</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{(summary.transactionCount || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setDatePreset(DATE_PRESETS.TODAY)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Today</button>
            <button onClick={() => setDatePreset(DATE_PRESETS.WEEK)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">This Week</button>
            <button onClick={() => setDatePreset(DATE_PRESETS.MONTH)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">This Month</button>
            <button onClick={() => setDatePreset(DATE_PRESETS.LAST_MONTH)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Last Month</button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            {/* Branch Dropdown */}
            <div className="relative" ref={branchDropdownRef}>
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <span className="text-gray-900 dark:text-white">{selectedBranches.length === 0 ? 'All Branches' : `${selectedBranches.length} selected`}</span>
                <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
              </button>
              {showBranchDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(b.branch_name)}
                        onChange={() => handleBranchToggle(b.branch_name)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{b.branch_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Dropdown */}
            <div className="relative" ref={paymentDropdownRef}>
              <button
                onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <span className="text-gray-900 dark:text-white">{selectedPayments.length === 0 ? 'All Payments' : `${selectedPayments.length} selected`}</span>
                <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
              </button>
              {showPaymentDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {paymentMethods.map(pm => (
                    <label key={pm.id} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPayments.includes(pm.name)}
                        onChange={() => handlePaymentToggle(pm.name)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{pm.name}</span>
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
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={filters.billNumber || ''}
              onChange={(e) => handleFilterChange('billNumber', e.target.value)}
              placeholder="Bill Number"
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={filters.menuName || ''}
              onChange={(e) => handleFilterChange('menuName', e.target.value)}
              placeholder="Menu Name"
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={filters.menuCategory || ''}
              onChange={(e) => handleFilterChange('menuCategory', e.target.value)}
              placeholder="Menu Category"
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={handleApplyFilters}
              disabled={!isDateFilterValid}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title={!isDateFilterValid ? 'Please select both Date From and Date To' : 'Apply Filters'}
            >
              Apply Filters
            </button>
            {!isDateFilterValid && (
              <span className="text-xs text-amber-600 dark:text-amber-500">* Select date range to apply filters</span>
            )}
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <X size={16} className="inline mr-1" />
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{TABLE_CONFIG.LOADING_MESSAGE}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Menu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payment</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tax</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total After Bill Disc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        {TABLE_CONFIG.EMPTY_MESSAGE}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{tx.bill_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(tx.sales_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{tx.branch}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{tx.menu}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{tx.payment_method}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{tx.qty}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">Rp {Number(tx.price || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">Rp {Number(tx.subtotal || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">Rp {Number(tx.discount || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">Rp {Number(tx.tax || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">Rp {Number(tx.total || 0).toLocaleString(LOCALE_CONFIG.CURRENCY_LOCALE)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400 font-medium">{(tx.bill_discount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">{(tx.total_after_bill_discount || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Global Pagination Component */}
            {pagination.total > 0 && (
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                currentLength={transactions.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
