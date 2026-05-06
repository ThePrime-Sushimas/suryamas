import { useState } from 'react'
import { History, Calendar, Filter, Eye, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAlertHistory, usePaymentMethods } from '../api/alerts'
import { Pagination } from '@/components/ui/Pagination'
import type { AlertHistoryFilters } from '../types'

const getTodayDate = () => new Date().toISOString().split('T')[0]

export default function AlertHistoryPage() {
  const [filters, setFilters] = useState<AlertHistoryFilters>({
    page: 1,
    limit: 25,
    start_date: getTodayDate(), // Default ke hari ini
    end_date: getTodayDate(),   // Default ke hari ini
  })
  
  const { data: historyData, isLoading } = useAlertHistory(filters)
  const { data: paymentMethods = [] } = usePaymentMethods()
  
  const history = historyData?.data || []
  const total = historyData?.total || 0
  const totalPages = Math.ceil(total / (filters.limit || 25))

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  const formatDateTime = (date: string) => new Date(date).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const handleFilterChange = (newFilters: Partial<AlertHistoryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link to="/settings/alerts" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <History className="w-5 h-5 text-blue-500" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Alert History</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Riwayat notifikasi yang telah dikirim</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {total} total records
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Filter:</span>
          </div>
          
          <select
            value={filters.payment_method_id || ''}
            onChange={e => handleFilterChange({ payment_method_id: e.target.value ? Number(e.target.value) : undefined })}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Semua Payment Method</option>
            {paymentMethods.map(pm => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Dari:</label>
            <input
              type="date"
              value={filters.start_date || ''}
              onChange={e => handleFilterChange({ start_date: e.target.value || undefined })}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Sampai:</label>
            <input
              type="date"
              value={filters.end_date || ''}
              onChange={e => handleFilterChange({ end_date: e.target.value || undefined })}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <button
            onClick={() => setFilters({ page: 1, limit: 25, start_date: getTodayDate(), end_date: getTodayDate() })}
            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded font-medium"
          >
            Hari Ini
          </button>

          {(filters.payment_method_id || (filters.start_date !== getTodayDate()) || (filters.end_date !== getTodayDate())) && (
            <button
              onClick={() => setFilters({ page: 1, limit: 25, start_date: getTodayDate(), end_date: getTodayDate() })}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filters.start_date === getTodayDate() && filters.end_date === getTodayDate() && !filters.payment_method_id
                ? 'Belum ada alert yang dikirim hari ini'
                : 'Tidak ada history dengan filter ini'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(item => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.payment_method_name}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                        item.alert_is_active === true
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                          : item.alert_is_active === false
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {item.alert_is_active === true ? 'Aktif' : item.alert_is_active === false ? 'Nonaktif' : 'Dihapus'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-300">
                      <div>
                        <p><span className="font-medium">Total:</span> Rp {fmt(item.triggered_amount)}</p>
                        <p><span className="font-medium">Threshold:</span> Rp {fmt(item.threshold_amount)}</p>
                      </div>
                      <div>
                        <p><span className="font-medium">Tanggal:</span> {formatDate(item.triggered_date)}</p>
                        <p><span className="font-medium">Dikirim:</span> {formatDateTime(item.telegram_sent_at)}</p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                        Breakdown {item.branch_breakdown.length} cabang:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.branch_breakdown.slice(0, 3).map((branch, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                            {branch.branch_name}: Rp {fmt(branch.amount)}
                          </span>
                        ))}
                        {item.branch_breakdown.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                            +{item.branch_breakdown.length - 3} lainnya
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Link
                    to={`/settings/alerts/history/${item.id}`}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                    title="Lihat Detail"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
          <Pagination
            currentPage={filters.page || 1}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}