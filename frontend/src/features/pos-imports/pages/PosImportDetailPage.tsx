import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Download, Search, X } from 'lucide-react'
import { posImportsApi } from '../api/pos-imports.api'
import { PosImportsErrorBoundary } from '../components/PosImportsErrorBoundary'
import type { PosImport, PosImportLine } from '../types/pos-imports.types'
import { POS_IMPORT_DEFAULT_PAGE_SIZE } from '../constants/pos-imports.constants'

function PosImportDetailPageContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [posImport, setPosImport] = useState<PosImport | null>(null)
  const [lines, setLines] = useState<PosImportLine[]>([])
  const [allLinesSummary, setAllLinesSummary] = useState({ 
    totalAmount: 0, 
    totalTax: 0, 
    totalDiscount: 0, 
    totalBillDiscount: 0,
    totalAfterBillDiscount: 0,
    transactionCount: 0 
  })
  const [loading, setLoading] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting] = useState(false)
  const abortControllerRef = useRef<AbortController | undefined>(undefined)
  const limit = POS_IMPORT_DEFAULT_PAGE_SIZE

  // Fetch summary from backend
  useEffect(() => {
    if (!id) return
    
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true)
        const summary = await posImportsApi.getSummary(id)
        setAllLinesSummary(summary)
      } catch (error) {
        console.error('Failed to fetch summary:', error)
      } finally {
        setLoadingSummary(false)
      }
    }
    
    fetchSummary()
  }, [id])

  // Filter lines based on search
  const filteredLines = useMemo(() => {
    if (!searchQuery) return lines
    const query = searchQuery.toLowerCase()
    return lines.filter(line => 
      line.bill_number?.toLowerCase().includes(query) ||
      line.menu?.toLowerCase().includes(query) ||
      line.payment_method?.toLowerCase().includes(query) ||
      line.branch?.toLowerCase().includes(query)      
    )
  }, [lines, searchQuery])

  // Export handler
  const handleExport = async () => {
    if (!id || !posImport) return
    setExporting(true)
    try {
      const blob = await posImportsApi.export(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${posImport.file_name.replace(/\.[^/.]+$/, '')}_export_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!id) {
      navigate('/pos-imports')
      return
    }
    
    const fetchData = async () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()
      
      try {
        setLoading(true)
        setError(null)
        const [importRes, linesRes] = await Promise.all([
          posImportsApi.getById(id, abortControllerRef.current.signal),
          posImportsApi.getLines(id, page, limit, abortControllerRef.current.signal)
        ])
        setPosImport(importRes.data)
        setLines(linesRes.data)
        setTotal(linesRes.pagination?.total || 0)
      } catch (error) {
        if (error instanceof Error && error.name !== 'CanceledError') {
          setError(error.message || 'Failed to fetch data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [id, page, navigate, limit])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading import details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-400">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!posImport) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-300">Import Not Found</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                The import you're looking for doesn't exist or has been deleted.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/pos-imports')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Imports
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? 'Exporting...' : 'Export to Excel'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50 p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Import Details</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">File Name</p>
            <p className="font-medium text-gray-900 dark:text-white">{posImport.file_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
            <p className="font-medium text-gray-900 dark:text-white">{posImport.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Date Range</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(posImport.date_range_start).toLocaleDateString()} - {new Date(posImport.date_range_end).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Rows</p>
            <p className="font-medium text-gray-900 dark:text-white">{posImport.total_rows}</p>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
          {loadingSummary ? (
            <div className="h-8 bg-blue-100 dark:bg-blue-800 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              Rp {(allLinesSummary.totalAmount || 0).toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Tax</p>
          {loadingSummary ? (
            <div className="h-8 bg-green-100 dark:bg-green-800 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              Rp {(allLinesSummary.totalTax || 0).toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Bill Discount</p>
          {loadingSummary ? (
            <div className="h-8 bg-orange-100 dark:bg-orange-800 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              Rp {(allLinesSummary.totalBillDiscount || 0).toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">After Bill Disc</p>
          {loadingSummary ? (
            <div className="h-8 bg-purple-100 dark:bg-purple-800 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              Rp {(allLinesSummary.totalAfterBillDiscount || 0).toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
          {loadingSummary ? (
            <div className="h-8 bg-gray-100 dark:bg-gray-600 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {allLinesSummary.transactionCount || 0}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700/50">
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Lines ({total})</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bill, menu, payment..."
                className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Showing {filteredLines.length} of {lines.length} transactions
            </p>
          )}
        </div>
        
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
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill Discount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tax</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total After Bill Disc</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No transactions match your search' : 'No transaction lines found'}
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{line.bill_number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{line.sales_date ? new Date(line.sales_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{line.branch || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{line.menu || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{line.payment_method || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{line.qty || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{line.price?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{line.subtotal?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">{line.discount?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400 font-medium">{(line.bill_discount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{line.tax?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{line.total?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">{(line.total_after_bill_discount || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PosImportDetailPage() {
  return (
    <PosImportsErrorBoundary>
      <PosImportDetailPageContent />
    </PosImportsErrorBoundary>
  )
}
