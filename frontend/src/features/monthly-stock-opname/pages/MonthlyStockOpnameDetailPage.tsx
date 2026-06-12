import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, CheckCircle, Printer, RotateCcw, AlertTriangle } from 'lucide-react'
import { useListNavigation } from '@/lib/urlFilters'
import {
  useMonthlyOpnameDetail,
  useUpdateMonthlyOpnameLine,
  useRecalculateMonthlyOpname,
  useConfirmMonthlyOpname,
  useCancelMonthlyOpname,
  useCreateMonthlyOpnameReopenRequest,
} from '../api/monthlyStockOpname'
import { PrintMonthlyOpnameModal } from '../components/PrintMonthlyOpnameModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'
import type { MonthlyStockOpnameLine, MonthlyOpnameStatus } from '../types'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const fmtQty = (v: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

function StatusBadge({ status }: { status: MonthlyOpnameStatus }) {
  const styles: Record<MonthlyOpnameStatus, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    REOPENED: 'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function getRowColor(selisihQty: number | null): string {
  if (selisihQty === null || Math.abs(selisihQty) <= 0.0001) return ''
  if (selisihQty < 0) return 'bg-red-50'
  return 'bg-green-50'
}

export default function MonthlyStockOpnameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { backToList } = useListNavigation('/inventory/monthly-stock-opname')
  const toast = useToast()
  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canUpdate = hasPermission('monthly_stock_opname', 'update')

  const { data: detail, isLoading } = useMonthlyOpnameDetail(id ?? '')
  const updateLine = useUpdateMonthlyOpnameLine()
  const recalculate = useRecalculateMonthlyOpname()
  const confirm = useConfirmMonthlyOpname()
  const cancel = useCancelMonthlyOpname()
  const createReopenRequest = useCreateMonthlyOpnameReopenRequest()

  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ actual_qty: string; investigasi_note: string }>({ actual_qty: '', investigasi_note: '' })
  const [reopenReason, setReopenReason] = useState('')
  const [showReopenDialog, setShowReopenDialog] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const isEditable = detail?.status === 'DRAFT' || detail?.status === 'REOPENED'

  // Determine which lines are missing investigasi_note
  const linesNeedingInvestigasi = useMemo(() => {
    if (!detail) return []
    return detail.lines.filter(l => l.selisih_qty !== null && Math.abs(Number(l.selisih_qty)) > 0.0001 && !l.investigasi_note)
  }, [detail])

  const canConfirm = useMemo(() => {
    if (!detail || !isEditable) return false
    const allFilled = detail.lines.every(l => l.actual_qty !== null)
    return allFilled && linesNeedingInvestigasi.length === 0
  }, [detail, isEditable, linesNeedingInvestigasi])

  const confirmTooltip = useMemo(() => {
    if (!detail) return ''
    const incomplete = detail.lines.filter(l => l.actual_qty === null)
    if (incomplete.length > 0) return `${incomplete.length} produk belum diisi actual qty`
    if (linesNeedingInvestigasi.length > 0) {
      return `${linesNeedingInvestigasi.length} produk dengan selisih belum ada investigasi note: ${linesNeedingInvestigasi.slice(0, 3).map(l => l.product_name).join(', ')}${linesNeedingInvestigasi.length > 3 ? '...' : ''}`
    }
    return ''
  }, [detail, linesNeedingInvestigasi])

  const handleStartEdit = (line: MonthlyStockOpnameLine) => {
    setEditingLine(line.id)
    setEditValues({
      actual_qty: line.actual_qty !== null ? String(line.actual_qty) : '',
      investigasi_note: line.investigasi_note ?? '',
    })
  }

  const handleSaveLine = async (lineId: string) => {
    if (!id) return
    const actualQty = parseFloat(editValues.actual_qty)
    if (isNaN(actualQty) || actualQty < 0) {
      toast.error('Actual qty harus >= 0')
      return
    }
    try {
      await updateLine.mutateAsync({
        sessionId: id,
        lineId,
        body: {
          actual_qty: actualQty,
          ...(editValues.investigasi_note ? { investigasi_note: editValues.investigasi_note } : {}),
        },
      })
      setEditingLine(null)
    } catch {
      // Error handled by toast
    }
  }

  const handleRecalculate = async () => {
    if (!id) return
    try {
      await recalculate.mutateAsync(id)
      toast.success('Expected qty berhasil di-recalculate')
    } catch {
      // Error handled by toast
    }
  }

  const handleConfirm = async () => {
    if (!id || !canConfirm) return
    if (!window.confirm('Konfirmasi SO bulanan? Stok akan langsung di-adjust.')) return
    try {
      await confirm.mutateAsync(id)
      toast.success('SO Bulanan berhasil dikonfirmasi')
    } catch {
      // Error handled by toast
    }
  }

  const handleCancel = async () => {
    if (!id) return
    if (!window.confirm('Batalkan SO bulanan ini?')) return
    try {
      await cancel.mutateAsync(id)
      toast.success('SO Bulanan dibatalkan')
      backToList()
    } catch {
      // Error handled by toast
    }
  }

  const handleRequestReopen = async () => {
    if (!id || !reopenReason.trim()) return
    try {
      await createReopenRequest.mutateAsync({ sessionId: id, body: { reason: reopenReason } })
      toast.success('Permintaan reopen berhasil dikirim')
      setShowReopenDialog(false)
      setReopenReason('')
    } catch {
      // Error handled by toast
    }
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Memuat data...</div>
  }

  if (!detail) {
    return <div className="p-6 text-center text-gray-500">Data tidak ditemukan</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={backToList} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{detail.opname_number}</h1>
              <StatusBadge status={detail.status} />
            </div>
            <p className="text-sm text-gray-500">
              {fmtDate(detail.opname_date)} • {detail.warehouse_name} • {detail.branch_name} • PIC: {detail.pic_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditable && canUpdate && (
            <>
              <button
                onClick={handleRecalculate}
                disabled={recalculate.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${recalculate.isPending ? 'animate-spin' : ''}`} />
                Recalculate
              </button>
              <div className="relative group">
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || confirm.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" />
                  {confirm.isPending ? 'Confirming...' : 'Confirm'}
                </button>
                {!canConfirm && confirmTooltip && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-xs z-10">
                    {confirmTooltip}
                  </div>
                )}
              </div>
            </>
          )}
          {detail.status === 'CONFIRMED' && (
            <>
              <button
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                Print Thermal
              </button>
              {canUpdate && (
                <button
                  onClick={() => setShowReopenDialog(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded-lg hover:bg-orange-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  Request Reopen
                </button>
              )}
            </>
          )}
          {detail.status === 'DRAFT' && canUpdate && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50"
            >
              Batalkan
            </button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Total Produk</p>
          <p className="text-2xl font-bold text-gray-900">{detail.summary.total_products}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Completed</p>
          <p className="text-2xl font-bold text-gray-900">{detail.summary.completed_products}/{detail.summary.total_products}</p>
          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${detail.summary.completion_pct}%` }} />
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Produk Selisih</p>
          <p className="text-2xl font-bold text-orange-600">{detail.summary.products_with_selisih}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Total Selisih Nilai</p>
          <p className="text-2xl font-bold text-red-600">{fmtCurrency(detail.summary.total_selisih_value)}</p>
        </div>
      </div>

      {/* Warning for missing investigasi */}
      {linesNeedingInvestigasi.length > 0 && isEditable && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Investigasi note belum lengkap</p>
            <p>{linesNeedingInvestigasi.length} produk dengan selisih perlu investigasi note sebelum bisa di-confirm.</p>
          </div>
        </div>
      )}

      {/* Lines Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Snapshot</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Movement</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Selisih Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Selisih Nilai</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Investigasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {detail.lines.map((line) => (
                <tr
                  key={line.id}
                  className={`${getRowColor(line.selisih_qty)} ${isEditable && canUpdate ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => isEditable && canUpdate && editingLine !== line.id && handleStartEdit(line)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{line.product_name}</div>
                    <div className="text-xs text-gray-500">{line.product_code} • {line.uom}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmtQty(Number(line.snapshot_qty))}</td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {Number(line.movement_during_so) !== 0 && (
                      <span className={Number(line.movement_during_so) > 0 ? 'text-green-600' : 'text-red-600'}>
                        {Number(line.movement_during_so) > 0 ? '+' : ''}{fmtQty(Number(line.movement_during_so))}
                      </span>
                    )}
                    {Number(line.movement_during_so) === 0 && '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtQty(Number(line.expected_qty))}</td>
                  <td className="px-3 py-2 text-right">
                    {editingLine === line.id ? (
                      <input
                        type="number"
                        value={editValues.actual_qty}
                        onChange={(e) => setEditValues(prev => ({ ...prev, actual_qty: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveLine(line.id)
                          if (e.key === 'Escape') setEditingLine(null)
                        }}
                        autoFocus
                        className="w-20 text-right text-sm border-gray-300 rounded px-1 py-0.5"
                        min="0"
                        step="any"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={line.actual_qty !== null ? 'font-medium text-gray-900' : 'text-gray-400 italic'}>
                        {line.actual_qty !== null ? fmtQty(Number(line.actual_qty)) : 'belum diisi'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {line.selisih_qty !== null && line.selisih_qty !== 0 && (
                      <span className={Number(line.selisih_qty) < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                        {Number(line.selisih_qty) > 0 ? '+' : ''}{fmtQty(Number(line.selisih_qty))}
                      </span>
                    )}
                    {(line.selisih_qty === null || line.selisih_qty === 0) && <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {line.selisih_value !== null && Number(line.selisih_value) !== 0 && (
                      <span className={Number(line.selisih_value) < 0 ? 'text-red-600' : 'text-green-600'}>
                        {fmtCurrency(Number(line.selisih_value))}
                      </span>
                    )}
                    {(line.selisih_value === null || Number(line.selisih_value) === 0) && <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-3 py-2 text-left max-w-[200px]">
                    {editingLine === line.id && line.selisih_qty !== null && line.selisih_qty !== 0 ? (
                      <input
                        type="text"
                        value={editValues.investigasi_note}
                        onChange={(e) => setEditValues(prev => ({ ...prev, investigasi_note: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveLine(line.id)
                          if (e.key === 'Escape') setEditingLine(null)
                        }}
                        onBlur={() => handleSaveLine(line.id)}
                        placeholder="Tulis investigasi..."
                        className="w-full text-sm border-gray-300 rounded px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : line.selisih_qty !== null && line.selisih_qty !== 0 ? (
                      <span className={line.investigasi_note ? 'text-gray-700 text-xs' : 'text-red-400 text-xs italic'}>
                        {line.investigasi_note || 'wajib diisi'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reopen Dialog */}
      {showReopenDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Request Reopen</h3>
            <p className="text-sm text-gray-600">Jelaskan alasan reopen SO bulanan ini:</p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              className="w-full text-sm border-gray-300 rounded-lg"
              placeholder="Alasan reopen..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowReopenDialog(false); setReopenReason('') }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleRequestReopen}
                disabled={!reopenReason.trim() || createReopenRequest.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {createReopenRequest.isPending ? 'Mengirim...' : 'Kirim Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && id && (
        <PrintMonthlyOpnameModal opnameId={id} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  )
}
