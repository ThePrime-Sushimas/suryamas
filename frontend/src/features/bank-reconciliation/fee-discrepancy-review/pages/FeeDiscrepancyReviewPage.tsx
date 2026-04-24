import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { feeDiscrepancyApi } from '../api/fee-discrepancy.api'
import type { FeeDiscrepancyItem, FeeDiscrepancyStatus } from '../types/fee-discrepancy.types'
import { AlertTriangle, CheckCircle, FileEdit, ArrowUpDown, Filter } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const sourceLabel: Record<string, string> = {
  SINGLE_MATCH: '1:1',
  MULTI_MATCH: 'Multi',
  SETTLEMENT_GROUP: 'Settlement',
}

const sourceBadge: Record<string, string> = {
  SINGLE_MATCH: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MULTI_MATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SETTLEMENT_GROUP: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export const FeeDiscrepancyReviewPage = () => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState<FeeDiscrepancyStatus | ''>('')
  const [page, setPage] = useState(1)
  const limit = 50

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['fee-discrepancy-summary', dateFrom, dateTo],
    queryFn: () => feeDiscrepancyApi.summary({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  })

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['fee-discrepancy-list', dateFrom, dateTo, status, page],
    queryFn: () =>
      feeDiscrepancyApi.list({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: status || undefined,
        page,
        limit,
      }),
  })

  const items = listData?.data || []
  const total = listData?.pagination?.total || 0
  const summary = summaryData

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Discrepancy Review</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review selisih fee antara POS dan bank. Konfirmasi atau buat jurnal koreksi.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Pending Review"
            value={summary?.totalPending || 0}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            color="amber"
          />
          <SummaryCard
            label="Bank Bayar Kurang"
            value={fmt(summary?.sumPendingPositive || 0)}
            icon={<ArrowUpDown className="w-5 h-5 text-red-500" />}
            color="red"
          />
          <SummaryCard
            label="Bank Bayar Lebih"
            value={fmt(Math.abs(summary?.sumPendingNegative || 0))}
            icon={<ArrowUpDown className="w-5 h-5 text-green-500" />}
            color="green"
          />
          <SummaryCard
            label="Sudah Dikonfirmasi"
            value={summary?.totalConfirmed || 0}
            icon={<CheckCircle className="w-5 h-5 text-blue-500" />}
            color="blue"
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as FeeDiscrepancyStatus | ''); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Semua</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CORRECTED">Corrected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment / Branch</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Nett POS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bank Cair</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Selisih</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {listLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <div className="animate-pulse">Memuat data...</div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      Tidak ada selisih fee ditemukan
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {formatDate(item.transactionDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${sourceBadge[item.source]}`}>
                          {sourceLabel[item.source]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900 dark:text-white">{item.paymentMethodName || '-'}</div>
                        {item.branchName && (
                          <div className="text-[11px] text-gray-400">{item.branchName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {fmt(item.posNettAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {fmt(item.bankAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold whitespace-nowrap">
                        <span className={item.discrepancyAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                          {item.discrepancyAmount > 0 ? '+' : ''}{fmt(item.discrepancyAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-48 truncate">
                        {item.notes || item.bankDescription || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} dari {total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={page * limit >= total}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: FeeDiscrepancyStatus }) {
  const styles: Record<FeeDiscrepancyStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    CORRECTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${styles[status]}`}>
      {status}
    </span>
  )
}

export default FeeDiscrepancyReviewPage
