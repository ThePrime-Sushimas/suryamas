import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, FileText, XCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  useProductionOrder, useCompleteProductionOrder,
  useGenerateProductionJournal, useVoidProductionOrder,
  type ProductionOrderLine, type ProductionOrderMaterial
} from '../api/food-production.api'
import { PRODUCTION_STATUS_COLORS, getProductionOrderDisplayCost, getProductionOrderCostLabel } from '../components/production-order.constants'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)

interface EditLine {
  id: string
  actual_batch_qty: number
  materials: EditMaterial[]
}

interface EditMaterial {
  id: string
  actual_qty: number
  waste_qty: number
  waste_reason: string
}

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const order = useProductionOrder(id || '')
  const completeOrder = useCompleteProductionOrder()
  const generateJournal = useGenerateProductionJournal()
  const voidOrder = useVoidProductionOrder()

  const [editLines, setEditLines] = useState<EditLine[] | null>(null)
  const [voidModal, setVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  const o = order.data
  if (!id) return null

  // Initialize edit state from order data (for complete mode)
  const initEditLines = () => {
    if (!o) return
    setEditLines(o.lines.map(line => ({
      id: line.id,
      actual_batch_qty: line.planned_batch_qty,
      materials: line.materials.map(mat => ({
        id: mat.id,
        actual_qty: mat.planned_qty,
        waste_qty: 0,
        waste_reason: '',
      })),
    })))
  }

  const handleComplete = async () => {
    if (!editLines) return
    try {
      await completeOrder.mutateAsync({ id, lines: editLines })
      toast.success('Produksi selesai')
      setEditLines(null)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyelesaikan produksi'))
    }
  }

  const handleGenerateJournal = async () => {
    try {
      await generateJournal.mutateAsync(id)
      toast.success('Jurnal berhasil dibuat')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal generate jurnal'))
    }
  }

  const handleVoid = async () => {
    if (!voidReason.trim()) { toast.warning('Alasan void wajib diisi'); return }
    try {
      await voidOrder.mutateAsync({ id, reason: voidReason })
      toast.success('Order di-void')
      setVoidModal(false)
      setVoidReason('')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal void order'))
    }
  }

  const updateLineBatch = (lineIdx: number, val: number) => {
    if (!editLines) return
    const updated = [...editLines]
    updated[lineIdx] = { ...updated[lineIdx], actual_batch_qty: val }
    setEditLines(updated)
  }

  const updateMaterial = (lineIdx: number, matIdx: number, field: keyof EditMaterial, val: string | number) => {
    if (!editLines) return
    const updated = [...editLines]
    const mats = [...updated[lineIdx].materials]
    mats[matIdx] = { ...mats[matIdx], [field]: val }
    updated[lineIdx] = { ...updated[lineIdx], materials: mats }
    setEditLines(updated)
  }

  if (order.isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!o) return <div className="p-6 text-center text-gray-400">Order tidak ditemukan</div>

  const isEditing = editLines !== null
  const displayCost = getProductionOrderDisplayCost(o)
  const costLabel = getProductionOrderCostLabel(o.status)

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/food-production/production')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">{o.order_number}</h1>
          <p className="text-xs text-gray-400">{o.branch_name} · {new Date(o.production_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-bold rounded-lg ${PRODUCTION_STATUS_COLORS[o.status]}`}>{o.status}</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{costLabel}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">Rp {fmt(displayCost)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Waste Cost</p>
          <p className="text-lg font-bold text-red-500 font-mono">Rp {fmt(o.total_waste_cost)}</p>
        </div>
        {o.journal_id && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Jurnal</p>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">✓ Sudah dibuat</p>
          </div>
        )}
      </div>

      {/* Lines */}
      {o.lines.map((line: ProductionOrderLine, lineIdx: number) => (
        <div key={line.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{line.wip_name}</span>
              <span className="ml-2 text-xs text-gray-400 font-mono">{line.wip_code}</span>
              {/* Output Warehouse Badge */}
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  line.output_warehouse === 'FINISHED_GOODS'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                }`}>
                  {line.output_warehouse === 'FINISHED_GOODS' ? '→ Finished Goods' : '→ Ready'}
                </span>
                <span className="text-[10px] text-gray-400">
                  Bahan dari: <span className="font-semibold">{line.output_warehouse === 'FINISHED_GOODS' ? 'Gudang Utama' : 'Gudang Ready'}</span>
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span>Actual batch:</span>
                  <input type="number" value={editLines![lineIdx].actual_batch_qty || ''} min={0}
                    onChange={e => updateLineBatch(lineIdx, Number(e.target.value))}
                    className="w-16 h-7 px-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              ) : (
                <span>
                  {line.actual_batch_qty !== null ? `Actual: ${line.actual_batch_qty}` : `Planned: ${line.planned_batch_qty}`} batch
                  · {fmt(line.yield_per_batch)} {line.uom}/batch
                </span>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bahan</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {line.output_warehouse === 'FINISHED_GOODS' ? 'Stok Main' : 'Stok Ready'}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                {(isEditing || o.status !== 'DRAFT') && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>}
                {(isEditing || o.status !== 'DRAFT') && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Waste</th>}
                {isEditing && <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Alasan</th>}
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {line.materials.map((mat: ProductionOrderMaterial, matIdx: number) => {
                const sourceStock = line.output_warehouse === 'FINISHED_GOODS' ? mat.main_stock : mat.ready_stock
                return (
                <tr key={mat.id}>
                  <td className="px-3 py-2">
                    <span className="text-gray-900 dark:text-white">{mat.product_name}</span>
                    <span className="ml-1 text-xs text-gray-400">{mat.uom}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    <span className={sourceStock < mat.planned_qty ? 'text-red-500 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>
                      {fmt(sourceStock)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmt(mat.planned_qty)}</td>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-2">
                        <input type="number" value={editLines![lineIdx].materials[matIdx].actual_qty || ''} min={0}
                          onChange={e => updateMaterial(lineIdx, matIdx, 'actual_qty', Number(e.target.value))}
                          className="w-20 h-7 px-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={editLines![lineIdx].materials[matIdx].waste_qty || ''} min={0}
                          onChange={e => updateMaterial(lineIdx, matIdx, 'waste_qty', Number(e.target.value))}
                          className="w-16 h-7 px-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={editLines![lineIdx].materials[matIdx].waste_reason}
                          onChange={e => updateMaterial(lineIdx, matIdx, 'waste_reason', e.target.value)}
                          placeholder="Alasan..."
                          className="w-full h-7 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                    </>
                  ) : o.status !== 'DRAFT' ? (
                    <>
                      <td className="px-3 py-2 text-right font-mono text-xs">{mat.actual_qty !== null ? fmt(mat.actual_qty) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-red-500">{mat.waste_qty > 0 ? fmt(mat.waste_qty) : '—'}</td>
                    </>
                  ) : null}
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">{fmt(mat.cost_per_unit)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {o.status === 'DRAFT' && !isEditing && (
          <>
            <button onClick={() => setVoidModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-700 dark:text-red-400">
              <XCircle className="w-3.5 h-3.5" /> Void
            </button>
            <button onClick={initEditLines}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <CheckCircle className="w-3.5 h-3.5" /> Selesaikan Produksi
            </button>
          </>
        )}
        {isEditing && (
          <>
            <button onClick={() => setEditLines(null)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg">
              Batal
            </button>
            <button onClick={handleComplete} disabled={completeOrder.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle className="w-3.5 h-3.5" /> {completeOrder.isPending ? 'Menyimpan...' : 'Konfirmasi Selesai'}
            </button>
          </>
        )}
        {o.status === 'COMPLETED' && (
          <>
            <button onClick={() => setVoidModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-700 dark:text-red-400">
              <XCircle className="w-3.5 h-3.5" /> Void
            </button>
            <button onClick={handleGenerateJournal} disabled={generateJournal.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <FileText className="w-3.5 h-3.5" /> {generateJournal.isPending ? 'Generating...' : 'Generate Jurnal'}
            </button>
          </>
        )}
        {o.status === 'JOURNALED' && (
          <button onClick={() => setVoidModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-700 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5" /> Void (Reverse Journal)
          </button>
        )}
      </div>

      {/* Void Modal */}
      <ConfirmModal
        isOpen={voidModal}
        onClose={() => { setVoidModal(false); setVoidReason('') }}
        onConfirm={handleVoid}
        title="Void Production Order"
        message={
          <div className="space-y-3">
            <p>Yakin ingin void order ini?{o.status === 'JOURNALED' && ' Jurnal yang sudah dibuat akan di-reverse.'}</p>
            <input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Alasan void (wajib)..."
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        }
        confirmText="Void"
        variant="danger"
        isLoading={voidOrder.isPending}
      />
    </div>
  )
}
