import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useGoodsProcessingList, useBulkConfirm } from '../api/goodsProcessing.api'
import type { GoodsProcessing } from '../api/goodsProcessing.api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Menunggu', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  PROCESSING: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  QC_REVIEW: { label: 'Menunggu QC', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  CONFIRMED: { label: 'Selesai', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

type TabKey = '' | 'PENDING' | 'QC_REVIEW' | 'CONFIRMED'

export default function GoodsProcessingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canApprove = hasPermission('goods_processing', 'approve')

  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<TabKey>('PENDING')
  const [bulkSelected, setBulkSelected] = useState<string[]>([])
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // Map tab to status filter
  const statusFilter = useMemo(() => {
    if (tab === 'PENDING') return 'DRAFT,PROCESSING,REJECTED'
    if (tab === 'QC_REVIEW') return 'QC_REVIEW'
    if (tab === 'CONFIRMED') return 'CONFIRMED'
    return undefined
  }, [tab])

  const queryParams = useMemo(() => ({
    page, limit: 25,
    status: statusFilter,
  }), [page, statusFilter])

  const { data, isLoading } = useGoodsProcessingList(queryParams)
  const bulkConfirmMutation = useBulkConfirm()

  const items = data?.data ?? []
  const pagination = data?.pagination

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleBulkConfirm = async () => {
    try {
      const result = await bulkConfirmMutation.mutateAsync(bulkSelected)
      toast.success(`${result.success.length} item dikonfirmasi`)
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} item gagal`)
      }
      setBulkSelected([])
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal konfirmasi'))
    } finally {
      setShowBulkConfirm(false)
    }
  }

  const tabs: { key: TabKey; label: string; icon: typeof Clock }[] = [
    { key: 'PENDING', label: 'Perlu Diproses', icon: Clock },
    { key: 'QC_REVIEW', label: 'Menunggu QC', icon: AlertTriangle },
    { key: 'CONFIRMED', label: 'Selesai', icon: CheckCircle2 },
  ]

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Barang Masuk</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Proses barang sebelum masuk gudang</p>
            </div>
          </div>
          {tab === 'QC_REVIEW' && canApprove && bulkSelected.length > 0 && (
            <button onClick={() => setShowBulkConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Konfirmasi {bulkSelected.length} Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setBulkSelected([]) }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Tidak ada data untuk tab ini</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(gp => (
              <GoodsProcessingCard
                key={gp.id}
                item={gp}
                showCheckbox={tab === 'QC_REVIEW' && canApprove && gp.processing_type === 'PASS_THROUGH'}
                checked={bulkSelected.includes(gp.id)}
                onToggle={() => toggleBulkSelect(gp.id)}
                onClick={() => navigate(`/inventory/goods-processing/${gp.id}`)}
              />
            ))}
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <div className="mt-4">
            <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={items.length} loading={isLoading} />
          </div>
        )}
      </div>

      {/* Bulk Confirm Modal */}
      <ConfirmModal isOpen={showBulkConfirm} onClose={() => setShowBulkConfirm(false)} onConfirm={handleBulkConfirm}
        title="Konfirmasi Barang Masuk" message={`Konfirmasi ${bulkSelected.length} item pass-through? Stock akan masuk ke gudang.`}
        confirmText="Konfirmasi" variant="success" isLoading={bulkConfirmMutation.isPending} />
    </div>
  )
}

function GoodsProcessingCard({ item, showCheckbox, checked, onToggle, onClick }: {
  item: GoodsProcessing
  showCheckbox: boolean
  checked: boolean
  onToggle: () => void
  onClick: () => void
}) {
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.DRAFT

  return (
    <div onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-orange-300 dark:hover:border-orange-700 cursor-pointer transition-colors">
      <div className="flex items-start gap-3">
        {showCheckbox && (
          <input type="checkbox" checked={checked} onChange={e => { e.stopPropagation(); onToggle() }}
            onClick={e => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-gray-900 dark:text-white truncate">{item.processing_number}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            GR: {item.gr_number} · {item.supplier_name}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{fmtDate(item.processing_date)}</span>
            <span>{item.input_count} item</span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${item.processing_type === 'DISASSEMBLY' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
              {item.processing_type === 'DISASSEMBLY' ? 'Disassembly' : 'Pass-through'}
            </span>
            {item.yield_percentage != null && (
              <span className="text-green-600 dark:text-green-400">Yield: {item.yield_percentage}%</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
