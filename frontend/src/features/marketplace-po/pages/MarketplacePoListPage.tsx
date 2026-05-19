import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Plus, Search } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useMarketplaceSessions,
  useCancelMarketplaceSession,
  usePostReceiveJournal,
} from '../api/marketplacePo.api'
import { SessionStatusBadge, PlatformBadge } from '../components/SessionStatusBadge'
import { fmtCurrency, fmtDate } from '../utils/format'
import type {
  MarketplaceCheckoutSession,
  MarketplacePlatform,
  MarketplaceSessionStatus,
} from '../types/marketplacePo.types'

const STATUSES: MarketplaceSessionStatus[] = ['DRAFT', 'ORDERED', 'SHIPPED', 'RECEIVED']

export default function MarketplacePoListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('marketplace_po', 'insert')
  const canDelete = hasPermission('marketplace_po', 'delete')
  const canUpdate = hasPermission('marketplace_po', 'update')

  const [page, setPage] = useState(1)
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [cancelTarget, setCancelTarget] = useState<MarketplaceCheckoutSession | null>(null)

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      platform: (platform || undefined) as MarketplacePlatform | undefined,
      status: (status || undefined) as MarketplaceSessionStatus | undefined,
      search: search || undefined,
    }),
    [page, platform, status, search],
  )

  const { data, isLoading } = useMarketplaceSessions(params)
  const cancelSession = useCancelMarketplaceSession()
  const postJournal = usePostReceiveJournal()
  const [postingId, setPostingId] = useState<string | null>(null)

  const handleQuickPostJournal = async (s: MarketplaceCheckoutSession) => {
    setPostingId(s.id)
    try {
      await postJournal.mutateAsync({ id: s.id })
      toast.success(`Journal receive untuk ${s.session_number} berhasil di-post`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal post journal'))
    } finally {
      setPostingId(null)
    }
  }

  const sessions = data?.data ?? []
  const pagination = data?.pagination

  const stats = useMemo(() => {
    const counts: Record<string, number> = { DRAFT: 0, ORDERED: 0, SHIPPED: 0, RECEIVED: 0 }
    for (const s of sessions) {
      if (counts[s.status] !== undefined) counts[s.status]++
    }
    return counts
  }, [sessions])

  const handleCancel = async () => {
    if (!cancelTarget) return
    try {
      await cancelSession.mutateAsync(cancelTarget.id)
      toast.success('Session dibatalkan')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membatalkan session'))
    } finally {
      setCancelTarget(null)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Marketplace PO Tracker
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Kelola pembelian Shopee & Tokopedia
              </p>
            </div>
          </div>
          {canInsert && (
            <button
              type="button"
              onClick={() => navigate('/inventory/marketplace-po/new')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium shadow-sm shadow-teal-600/20"
            >
              <Plus className="w-4 h-4" /> Buat Session
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUSES.map((st) => (
          <div
            key={st}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/60 p-4"
          >
            <SessionStatusBadge status={st} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{stats[st]}</p>
            <p className="text-xs text-gray-400">di halaman ini</p>
          </div>
        ))}
      </div>

      <div className="px-6 pb-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari session number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm bg-white dark:bg-gray-800"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2 border rounded-xl text-sm bg-white dark:bg-gray-800"
        >
          <option value="">Semua Platform</option>
          <option value="SHOPEE">Shopee</option>
          <option value="TOKOPEDIA">Tokopedia</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2 border rounded-xl text-sm bg-white dark:bg-gray-800"
        >
          <option value="">Semua Status</option>
          {['DRAFT', 'ORDERED', 'SHIPPED', 'RECEIVED', 'SETTLED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto px-4 lg:px-6 pb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          <div className="hidden lg:block overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Session</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">CC</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-4">
                        <div className="h-5 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                      Belum ada checkout session
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 cursor-pointer"
                      onClick={() => navigate(`/inventory/marketplace-po/${s.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-teal-700 dark:text-teal-400">
                        {s.session_number}
                      </td>
                      <td className="px-6 py-4">
                        <PlatformBadge platform={s.platform} />
                      </td>
                      <td className="px-6 py-4 text-gray-600">{fmtDate(s.checkout_date)}</td>
                      <td className="px-6 py-4 text-gray-600">{s.cc_label ?? '-'}</td>
                      <td className="px-6 py-4 text-right font-medium">{fmtCurrency(s.total_amount)}</td>
                      <td className="px-6 py-4 text-center">
                        <SessionStatusBadge status={s.status} />
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {s.status === 'DRAFT' && canDelete && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(s)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Batalkan
                          </button>
                        )}
                        {s.status === 'RECEIVED' && !s.journal_received_id && canUpdate && (
                          <button
                            type="button"
                            disabled={postingId !== null}
                            onClick={() => handleQuickPostJournal(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                          >
                            {postingId === s.id ? 'Memproses...' : 'Post Jurnal'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden p-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/inventory/marketplace-po/${s.id}`)}
                  className="p-4 border rounded-xl bg-white dark:bg-gray-800 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-teal-700">{s.session_number}</p>
                    <SessionStatusBadge status={s.status} />
                  </div>
                  <div className="mt-2 flex gap-2 items-center">
                    <PlatformBadge platform={s.platform} />
                    <span className="text-xs text-gray-500">{fmtDate(s.checkout_date)}</span>
                  </div>
                  <div className="mt-3 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm font-medium">{fmtCurrency(s.total_amount)}</p>
                    {s.status === 'RECEIVED' && !s.journal_received_id && canUpdate && (
                      <button
                        type="button"
                        disabled={postingId !== null}
                        onClick={() => handleQuickPostJournal(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        {postingId === s.id ? 'Memproses...' : 'Post Jurnal'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="border-t px-4 py-3">
              <Pagination
                pagination={pagination}
                onPageChange={setPage}
                currentLength={sessions.length}
                loading={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        isLoading={cancelSession.isPending}
        title="Batalkan Session?"
        message={`Session ${cancelTarget?.session_number} akan dibatalkan.`}
        confirmText="Ya, Batalkan"
        variant="danger"
      />
    </div>
  )
}
