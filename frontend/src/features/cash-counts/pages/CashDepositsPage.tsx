import { useState, useCallback, useEffect } from 'react'
import { Banknote, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { cashCountsApi } from '../api/cashCounts.api'
import type { CashDeposit } from '../types'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export function CashDepositsPage() {
  const toast = useToast()
  const [deposits, setDeposits] = useState<CashDeposit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<CashDeposit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CashDeposit | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchList = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await cashCountsApi.listDeposits(page, limit)
      setDeposits(res.data)
      setTotal(res.pagination?.total || 0)
    } catch (e) {
      toast.error('Gagal memuat data setoran')
    } finally {
      setIsLoading(false)
    }
  }, [page, toast])

  useEffect(() => { fetchList() }, [fetchList])

  const handleExpand = useCallback(async (dep: CashDeposit) => {
    if (expandedId === dep.id) {
      setExpandedId(null)
      setExpandedDetail(null)
      return
    }
    try {
      const detail = await cashCountsApi.getDeposit(dep.id)
      setExpandedDetail(detail)
      setExpandedId(dep.id)
    } catch {
      toast.error('Gagal memuat detail')
    }
  }, [expandedId, toast])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await cashCountsApi.deleteDeposit(deleteTarget.id)
      toast.success('Setoran berhasil dihapus')
      setDeleteTarget(null)
      fetchList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal hapus setoran')
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, toast, fetchList])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-600 rounded-xl"><Banknote className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Cash Deposits</h1>
            <p className="text-[10px] text-gray-400">Riwayat setoran kas ke bank</p>
          </div>
        </div>
        <button onClick={fetchList} disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-lg text-[10px] font-medium hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="px-3 py-2.5 text-left font-semibold">Tanggal Setor</th>
                <th className="px-3 py-2.5 text-left font-semibold">Cabang</th>
                <th className="px-3 py-2.5 text-left font-semibold">Periode</th>
                <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
                <th className="px-3 py-2.5 text-left font-semibold">Bank</th>
                <th className="px-3 py-2.5 text-left font-semibold">Referensi</th>
                <th className="px-3 py-2.5 text-center font-semibold">Items</th>
                <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                <th className="px-3 py-2.5 text-center font-semibold w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                  ))}</tr>
                ))
              ) : deposits.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400 text-sm">Belum ada setoran</td></tr>
              ) : (
                deposits.map((dep) => {
                  const isExpanded = expandedId === dep.id
                  return (
                    <tr key={dep.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td colSpan={9} className="p-0">
                        {/* Main row */}
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto_1fr_1fr_auto_auto_auto] items-center cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                          onClick={() => handleExpand(dep)}>
                          <div className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmtDate(dep.deposit_date)}</div>
                          <div className="px-3 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{dep.branch_name || '-'}</div>
                          <div className="px-3 py-2.5 text-gray-500 text-[10px]">
                            {dep.period_start && dep.period_end ? `${fmtDate(dep.period_start)} — ${fmtDate(dep.period_end)}` : '-'}
                          </div>
                          <div className="px-3 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-white">{fmt(dep.deposit_amount)}</div>
                          <div className="px-3 py-2.5 text-gray-500 truncate">{dep.bank_account_name || `Bank #${dep.bank_account_id}`}</div>
                          <div className="px-3 py-2.5 text-gray-500 truncate">{dep.reference || '-'}</div>
                          <div className="px-3 py-2.5 text-center text-gray-500">{dep.item_count}</div>
                          <div className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              dep.status === 'RECONCILED'
                                ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
                                : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dep.status === 'RECONCILED' ? 'bg-green-500' : 'bg-amber-500'}`} />
                              {dep.status}
                            </span>
                          </div>
                          <div className="px-3 py-2.5 text-center flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleExpand(dep)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            {dep.status === 'PENDING' && (
                              <button onClick={() => setDeleteTarget(dep)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && expandedDetail && (
                          <div className="px-4 pb-4 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-3 text-xs">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">Tanggal Setor</span>
                                <p className="font-medium text-gray-900 dark:text-white">{fmtDate(expandedDetail.deposit_date)}</p>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">Jumlah Setor</span>
                                <p className="font-mono font-semibold text-purple-700 dark:text-purple-300">{fmt(expandedDetail.deposit_amount)}</p>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">Bank</span>
                                <p className="text-gray-900 dark:text-white">{expandedDetail.bank_account_name || '-'}</p>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">Bank Statement</span>
                                <p className="text-gray-900 dark:text-white">
                                  {expandedDetail.bank_statement_id ? `#${String(expandedDetail.bank_statement_id).slice(0, 8)}…` : <span className="text-gray-400">Belum match</span>}
                                </p>
                              </div>
                            </div>

                            {expandedDetail.notes && (
                              <p className="text-[10px] text-gray-500 mb-3">Catatan: {expandedDetail.notes}</p>
                            )}

                            {/* Items */}
                            {expandedDetail.items && expandedDetail.items.length > 0 && (
                              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-[10px]">
                                  <thead><tr className="bg-gray-100 dark:bg-gray-800 text-gray-400">
                                    <th className="px-2 py-1.5 text-left">Cabang</th>
                                    <th className="px-2 py-1.5 text-left">Tanggal</th>
                                    <th className="px-2 py-1.5 text-right">System</th>
                                    <th className="px-2 py-1.5 text-right">Besar</th>
                                    <th className="px-2 py-1.5 text-right">Kecil</th>
                                    <th className="px-2 py-1.5 text-right">Total</th>
                                    <th className="px-2 py-1.5 text-right">Selisih</th>
                                  </tr></thead>
                                  <tbody>
                                    {expandedDetail.items.map((item) => (
                                      <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{item.branch_name || '-'}</td>
                                        <td className="px-2 py-1.5 text-gray-500">{fmtDate(item.start_date)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-gray-600">{fmt(item.system_balance)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-gray-600">{fmt(item.large_denomination || 0)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-gray-500">{fmt(item.small_denomination || 0)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono font-medium text-gray-900 dark:text-white">{fmt(item.physical_count || 0)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">
                                          <span className={(item.difference || 0) > 0 ? 'text-blue-600' : (item.difference || 0) < 0 ? 'text-red-600' : 'text-green-600'}>
                                            {(item.difference || 0) > 0 ? '+' : ''}{fmt(item.difference || 0)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                                      <td className="px-2 py-1.5 text-gray-500" colSpan={3}>Total</td>
                                      <td className="px-2 py-1.5 text-right font-mono text-purple-700 dark:text-purple-300">
                                        {fmt(expandedDetail.items.reduce((s, i) => s + (i.large_denomination || 0), 0))}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono text-gray-500">
                                        {fmt(expandedDetail.items.reduce((s, i) => s + (i.small_denomination || 0), 0))}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono text-gray-900 dark:text-white">
                                        {fmt(expandedDetail.items.reduce((s, i) => s + (i.physical_count || 0), 0))}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono">
                                        {(() => {
                                          const totalDiff = expandedDetail.items.reduce((s, i) => s + (i.difference || 0), 0)
                                          return <span className={totalDiff > 0 ? 'text-blue-600' : totalDiff < 0 ? 'text-red-600' : 'text-green-600'}>
                                            {totalDiff > 0 ? '+' : ''}{fmt(totalDiff)}
                                          </span>
                                        })()}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              pagination={{ page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }}
              onPageChange={setPage}
              currentLength={deposits.length}
            />
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Setoran"
        message="Setoran akan dihapus dan cash count yang terkait akan kembali ke status COUNTED. Lanjutkan?"
        confirmText="Hapus"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
