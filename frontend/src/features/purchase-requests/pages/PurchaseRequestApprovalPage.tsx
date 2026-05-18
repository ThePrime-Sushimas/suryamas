import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, Package, Phone, AlertTriangle, CheckCircle, XCircle, Send, X, RotateCcw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRejectPurchaseRequest } from '../api/purchaseRequests.api'
import api from '@/lib/axios'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

interface ApprovalItem {
  pr_line_id: string
  product_id: string
  product_code: string
  product_name: string
  qty: number
  qty_approved: number
  uom: string
  latest_price: number | null
  latest_price_uom: string | null
  stock_balance: number
  stock_unit: string | null
  stock_warehouse_name: string
  selected: boolean
}

interface SupplierGroup {
  supplier_id: string | null
  supplier_name: string
  supplier_phone: string | null
  supplier_payment_term_days: number | null
  supplier_payment_term_name: string | null
  items: ApprovalItem[]
  total_estimated: number
  selected: boolean
  payment_type: 'CASH' | 'CREDIT'
  payment_terms_days: number
  expected_delivery_date: string
  notes: string
}

export default function PurchaseRequestApprovalPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [groups, setGroups] = useState<SupplierGroup[]>([])
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const rejectPR = useRejectPurchaseRequest()

  const { data: approvalData, isLoading } = useQuery({
    queryKey: ['pr-approval-data', id],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-requests/${id}/approval-data`)
      return data.data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (!approvalData) return
    const pr = approvalData.pr as Record<string, unknown>
    const prLines = (pr.lines as Array<Record<string, unknown>>) ?? []
    // Build map of qty_approved from PR lines (null = not approved / excluded)
    const approvedMap = new Map(prLines.map((l) => [l.id as string, l.qty_approved as number | null]))
    const isConverted = pr.status === 'CONVERTED'

    setGroups(approvalData.supplier_groups.map((g: Record<string, unknown>) => {
      const termDays = g.supplier_payment_term_days as number | null
      return {
        ...(g as object),
        items: (g.items as Array<Record<string, unknown>>).map((i) => {
          const lineApproved = approvedMap.get(i.pr_line_id as string)
          // For CONVERTED PR: item is selected only if it was approved (qty_approved != null)
          // For PENDING: all items start selected
          const selected = isConverted ? lineApproved != null : true
          const qtyApproved = lineApproved ?? (i.qty as number)
          return { ...i, selected, qty_approved: qtyApproved }
        }),
        selected: g.supplier_id !== null,
        payment_type: (termDays === 0 ? 'CASH' : 'CREDIT') as 'CASH' | 'CREDIT',
        payment_terms_days: termDays ?? 30,
        expected_delivery_date: (approvalData.pr as Record<string, string | null>).needed_by_date ?? '',
        notes: '',
      }
    }))
  }, [approvalData])

  const approveAndGenerate = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post(`/purchase-requests/${id}/approve-and-generate`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['pr-approval-data', id] })
      const pos = (data.data?.purchase_orders ?? []) as Array<{ id: string; po_number?: string; lines?: Array<{ qty: number; uom: string; product_name?: string }> }>
      const qtySummary = pos.flatMap(po =>
        (po.lines ?? []).map(l => `${l.qty} ${l.uom}${l.product_name ? ` ${l.product_name}` : ''}`)
      ).join(' · ')
      toast.success(qtySummary ? `${data.message} — ${qtySummary}` : data.message)
      if (pos.length === 1) {
        navigate(`/inventory/purchase-orders/${pos[0].id}`)
      } else {
        navigate('/inventory/pr-approval')
      }
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal approve & generate PO')),
  })

  const handleApproveAndGenerate = () => {
    const selected = groups.filter(g => g.selected && g.supplier_id)
    if (selected.length === 0) { toast.error('Pilih minimal 1 supplier'); return }

    const supplier_selections = selected.map(g => ({
      supplier_id: g.supplier_id!,
      lines: g.items.filter(i => i.selected).map(i => ({ pr_line_id: i.pr_line_id, qty_approved: i.qty_approved })),
      payment_type: (g.supplier_payment_term_days === 0 ? 'CASH' : 'CREDIT') as 'CASH' | 'CREDIT',
      payment_terms_days: g.supplier_payment_term_days ?? 0,
      expected_delivery_date: g.expected_delivery_date || null,
      notes: g.notes || null,
    })).filter(s => s.lines.length > 0)

    if (supplier_selections.length === 0) { toast.error('Pilih minimal 1 item per supplier'); return }
    approveAndGenerate.mutate({ supplier_selections })
  }

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) { toast.error('Alasan penolakan wajib diisi'); return }
    try {
      await rejectPR.mutateAsync({ id, rejected_reason: rejectReason.trim() })
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      toast.success('Purchase request ditolak')
      navigate('/inventory/pr-approval')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menolak')) }
  }

  const toggleItem = (sIdx: number, iIdx: number) => setGroups(prev => prev.map((g, i) => {
    if (i !== sIdx) return g
    return { ...g, items: g.items.map((item, j) => j === iIdx ? { ...item, selected: !item.selected } : item) }
  }))
  const updateField = (idx: number, field: string, value: unknown) => setGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g))

  const updateItemQty = (sIdx: number, iIdx: number, qty: number) => setGroups(prev => prev.map((g, i) => {
    if (i !== sIdx) return g
    return { ...g, items: g.items.map((item, j) => j === iIdx ? { ...item, qty_approved: qty } : item) }
  }))

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!approvalData) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Data tidak ditemukan</p>
          <button onClick={() => navigate('/inventory/pr-approval')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Kembali</button>
        </div>
      </div>
    )
  }

  const pr = approvalData.pr as Record<string, unknown>
  const isPending = pr.status === 'PENDING_APPROVAL'

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/pr-approval')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Review & Approve</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {pr.request_number as string} | {pr.branch_name as string}
              </p>
            </div>
          </div>
          {pr.status === 'PENDING_APPROVAL' && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs sm:text-sm">
                <XCircle className="w-4 h-4" /> Tolak PR
              </button>
              <button onClick={handleApproveAndGenerate} disabled={approveAndGenerate.isPending}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs sm:text-sm">
                <Send className="w-4 h-4" />
                {approveAndGenerate.isPending ? 'Processing...' : 'Approve & Generate PO'}
              </button>
            </div>
          )}
          {!isPending && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              pr.status === 'CONVERTED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              pr.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>{pr.status as string}</span>
          )}
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-2">
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <span className="font-medium">Warehouse:</span> {approvalData.warehouse_name}
          {pr.needed_by_date && <span className="ml-3 sm:ml-4"><span className="font-medium">Dibutuhkan:</span> {new Date(pr.needed_by_date as string).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </p>
        {pr.rejected_reason ? (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
            <strong>Alasan Penolakan:</strong> {String(pr.rejected_reason)}
          </div>
        ) : null}
      </div>

      {/* Supplier Groups */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {groups.map((group, gIdx) => {
          const selectedItems = group.items.filter(i => i.selected)
          const total = selectedItems.reduce((sum, i) => sum + (i.latest_price ?? 0) * i.qty_approved, 0)

          return (
            <div key={gIdx} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Supplier Header */}
              <div className="bg-linear-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-white hidden sm:block" />
                    <div>
                      <h3 className="font-semibold text-white text-sm sm:text-base">{group.supplier_name}</h3>
                      {group.supplier_phone && (
                        <div className="flex items-center gap-1 text-xs text-white/70"><Phone className="w-3 h-3" />{group.supplier_phone}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/70">Total</p>
                    <p className="text-base sm:text-lg font-bold text-white">Rp {fmt(total)}</p>
                  </div>
                </div>
              </div>

              {/* Items - Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Request</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Approve</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stock Gudang</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
                      {isPending && <th className="px-4 py-2 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {group.items.map((item, iIdx) => {
                      const price = item.latest_price ?? 0
                      const sameUnit = !item.stock_unit || item.stock_unit === item.uom
                      const stockOk = sameUnit && item.stock_balance >= item.qty_approved
                      return (
                        <tr key={iIdx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${!item.selected ? 'opacity-40 line-through' : ''}`}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                            <p className="text-xs text-gray-500">{item.product_code}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-500 dark:text-gray-400 text-xs">{item.qty} {item.uom}</td>
                          <td className="px-4 py-2.5 text-right">
                            <input type="number" min="0.01"
                              value={item.qty_approved || ''}
                              onChange={e => updateItemQty(gIdx, iIdx, parseFloat(e.target.value) || 0)}
                              disabled={!item.selected || !group.selected || !isPending}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm disabled:opacity-50" />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono text-xs flex items-center justify-end gap-1 ${stockOk ? 'text-green-600 dark:text-green-400' : item.stock_balance > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                              {stockOk ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                              {item.stock_balance} {item.stock_unit ?? item.uom}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">
                            <span>Rp {fmt(price)}</span>
                            {item.latest_price_uom && <span className="text-xs text-gray-400 dark:text-gray-500"> /{item.latest_price_uom}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-gray-200">Rp {fmt(price * item.qty_approved)}</td>
                          {isPending && (
                            <td className="px-2 py-2.5 text-center">
                              {item.selected ? (
                                <button onClick={() => toggleItem(gIdx, iIdx)} title="Hapus dari order"
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              ) : (
                                <button onClick={() => toggleItem(gIdx, iIdx)} title="Kembalikan ke order"
                                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Items - Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {group.items.map((item, iIdx) => {
                  const price = item.latest_price ?? 0
                  const sameUnit = !item.stock_unit || item.stock_unit === item.uom
                  const stockOk = sameUnit && item.stock_balance >= item.qty_approved
                  return (
                    <div key={iIdx} className={`px-4 py-3 ${!item.selected ? 'opacity-40' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className={`font-medium text-gray-900 dark:text-white text-sm truncate ${!item.selected ? 'line-through' : ''}`}>{item.product_name}</p>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">Rp {fmt(price * item.qty_approved)}</p>
                              {isPending && (
                                item.selected ? (
                                  <button onClick={() => toggleItem(gIdx, iIdx)} title="Hapus dari order"
                                    className="p-1 text-gray-400 hover:text-red-500 rounded">
                                    <X className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button onClick={() => toggleItem(gIdx, iIdx)} title="Kembalikan ke order"
                                    className="p-1 text-gray-400 hover:text-green-600 rounded">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span>Request: {item.qty} {item.uom}</span>
                            <span className={`flex items-center gap-0.5 ${stockOk ? 'text-green-600' : item.stock_balance > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {stockOk ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              Stock: {item.stock_balance} {item.stock_unit ?? item.uom}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Approve:</span>
                            <input type="number" min="0.01"
                              value={item.qty_approved || ''}
                              onChange={e => updateItemQty(gIdx, iIdx, parseFloat(e.target.value) || 0)}
                              disabled={!item.selected || !group.selected || !isPending}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-xs disabled:opacity-50" />
                            <span className="text-xs text-gray-500">{item.uom}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Payment Settings */}
              {group.selected && group.supplier_id && (
                <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  {/* Supplier terms info */}
                  {group.supplier_payment_term_name ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Payment: <span className="font-medium text-gray-900 dark:text-white">{group.supplier_payment_term_name} ({group.supplier_payment_term_days} hari)</span></span>
                    </div>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-400">⚠ Supplier belum punya payment terms — atur di halaman Supplier terlebih dahulu</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery</label>
                      <input type="date" value={group.expected_delivery_date} onChange={e => updateField(gIdx, 'expected_delivery_date', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <input type="text" value={group.notes} onChange={e => updateField(gIdx, 'notes', e.target.value)} placeholder="Optional"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* No Supplier Warning */}
              {!group.supplier_id && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 border-t border-yellow-100 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-xs text-yellow-800 dark:text-yellow-300">
                    <AlertTriangle className="w-3.5 h-3.5" /> Item tanpa supplier — tidak akan dibuatkan PO
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tolak Purchase Request</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Alasan penolakan (wajib)..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Batal</button>
              <button onClick={handleReject} disabled={rejectPR.isPending || !rejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {rejectPR.isPending ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}