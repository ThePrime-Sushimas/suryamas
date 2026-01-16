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
  const [allLinesSummary, setAllLinesSummary] = useState({ totalAmount: 0, totalTax: 0, totalDiscount: 0, transactionCount: 0 })
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
          <p className="ml-3 text-sm text-gray-600">Loading import details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!posImport) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900">Import Not Found</h3>
              <p className="text-sm text-yellow-700 mt-1">
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
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
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

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">Import Details</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">File Name</p>
            <p className="font-medium">{posImport.file_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-medium">{posImport.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Date Range</p>
            <p className="font-medium">
              {new Date(posImport.date_range_start).toLocaleDateString()} - {new Date(posImport.date_range_end).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Rows</p>
            <p className="font-medium">{posImport.total_rows}</p>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Amount</p>
          {loadingSummary ? (
            <div className="h-8 bg-blue-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-blue-600">
              Rp {allLinesSummary.totalAmount.toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Tax</p>
          {loadingSummary ? (
            <div className="h-8 bg-green-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-green-600">
              Rp {allLinesSummary.totalTax.toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Discount</p>
          {loadingSummary ? (
            <div className="h-8 bg-orange-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-orange-600">
              Rp {allLinesSummary.totalDiscount.toLocaleString('id-ID')}
            </p>
          )}
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Transactions</p>
          {loadingSummary ? (
            <div className="h-8 bg-purple-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-purple-600">
              {allLinesSummary.transactionCount}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Transaction Lines ({total})</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bill, menu, payment..."
                className="w-full pl-9 pr-9 py-2 border rounded text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 mt-2">
              Showing {filteredLines.length} of {lines.length} transactions
            </p>
          )}
        </div>
        
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
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    {searchQuery ? 'No transactions match your search' : 'No transaction lines found'}
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{line.bill_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(line.sales_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{line.branch || '-'}</td>
                    <td className="px-4 py-3 text-sm">{line.menu || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{line.payment_method || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">{line.qty || 0}</td>
                    <td className="px-4 py-3 text-sm text-right">{line.price?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right">{line.subtotal?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{line.discount?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right">{line.tax?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{line.total?.toLocaleString() || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
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
