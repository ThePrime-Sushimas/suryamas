import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Package, Phone, AlertTriangle, CheckCircle, XCircle, Send } from 'lucide-react'
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
  uom: string
  estimated_price: number | null
  latest_price: number | null
  stock_balance: number
  stock_warehouse_name: string
  selected: boolean
}

interface SupplierGroup {
  supplier_id: string | null
  supplier_name: string
  supplier_phone: string | null
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
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
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
    setGroups(approvalData.supplier_groups.map((g: Record<string, unknown>) => ({
      ...(g as object),
      items: (g.items as Array<Record<string, unknown>>).map((i) => ({ ...i, selected: true })),
      selected: g.supplier_id !== null,
      payment_type: 'CREDIT' as const,
      payment_terms_days: 30,
      expected_delivery_date: (approvalData.pr as Record<string, string | null>).needed_by_date ?? '',
      notes: '',
    })))
  }, [approvalData])

  const approveAndGenerate = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post(`/purchase-requests/${id}/approve-and-generate`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success(data.message)
      navigate('/inventory/pr-approval')
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal approve & generate PO')),
  })

  const handleApproveAndGenerate = () => {
    const selected = groups.filter(g => g.selected && g.supplier_id)
    if (selected.length === 0) { toast.error('Pilih minimal 1 supplier'); return }

    const supplier_selections = selected.map(g => ({
      supplier_id: g.supplier_id!,
      line_ids: g.items.filter(i => i.selected).map(i => i.pr_line_id),
      payment_type: g.payment_type,
      payment_terms_days: g.payment_type === 'CREDIT' ? g.payment_terms_days : null,
      expected_delivery_date: g.expected_delivery_date || null,
      notes: g.notes || null,
    })).filter(s => s.line_ids.length > 0)

    if (supplier_selections.length === 0) { toast.error('Pilih minimal 1 item per supplier'); return }
    approveAndGenerate.mutate({ supplier_selections, send_whatsapp: sendWhatsApp })
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

  const toggleSupplier = (idx: number) => setGroups(prev => prev.map((g, i) => i === idx ? { ...g, selected: !g.selected } : g))
  const toggleItem = (sIdx: number, iIdx: number) => setGroups(prev => prev.map((g, i) => {
    if (i !== sIdx) return g
    return { ...g, items: g.items.map((item, j) => j === iIdx ? { ...item, selected: !item.selected } : item) }
  }))
  const updateField = (idx: number, field: string, value: unknown) => setGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g))

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    )
  }

  if (!approvalData) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Data tidak ditemukan atau PR bukan status Pending Approval</p>
          <button onClick={() => navigate('/inventory/pr-approval')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Kembali</button>
        </div>
      </div>
    )
  }

  const pr = approvalData.pr as Record<string, unknown>

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/pr-approval')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ShieldCheck className="w-6 h-6 text-green-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Review & Approve</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pr.request_number as string} | {pr.branch_name as string}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
              Send WhatsApp
            </label>
            <button onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button onClick={handleApproveAndGenerate} disabled={approveAndGenerate.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
              <Send className="w-4 h-4" />
              {approveAndGenerate.isPending ? 'Processing...' : 'Approve & Generate PO'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-6 py-2">
        <p className="text-sm text-blue-900 dark:text-blue-300">
          <span className="font-medium">Warehouse:</span> {approvalData.warehouse_name}
          {pr.needed_by_date && <span className="ml-4"><span className="font-medium">Dibutuhkan:</span> {new Date(pr.needed_by_date as string).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </p>
      </div>

      {/* Supplier Groups */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {groups.map((group, gIdx) => {
          const selectedItems = group.items.filter(i => i.selected)
          const total = selectedItems.reduce((sum, i) => sum + (i.latest_price ?? i.estimated_price ?? 0) * i.qty, 0)

          return (
            <div key={gIdx} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Supplier Header */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={group.selected} onChange={() => toggleSupplier(gIdx)}
                      disabled={!group.supplier_id} className="rounded border-white/30 text-white focus:ring-white/50" />
                    <Package className="w-5 h-5 text-white" />
                    <div>
                      <h3 className="font-semibold text-white">{group.supplier_name}</h3>
                      {group.supplier_phone && (
                        <div className="flex items-center gap-1 text-xs text-white/80"><Phone className="w-3 h-3" />{group.supplier_phone}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/80">Total</p>
                    <p className="text-lg font-bold text-white">Rp {fmt(total)}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {group.items.map((item, iIdx) => {
                  const price = item.latest_price ?? item.estimated_price ?? 0
                  const stockOk = item.stock_balance >= item.qty
                  return (
                    <div key={iIdx} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={item.selected} onChange={() => toggleItem(gIdx, iIdx)}
                          disabled={!group.selected} className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                              <p className="text-xs text-gray-500">{item.product_code}</p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Rp {fmt(price * item.qty)}</p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-4 text-xs">
                            <span className="text-gray-600 dark:text-gray-400">Qty: <span className="font-medium">{item.qty} {item.uom}</span></span>
                            <span className="flex items-center gap-1">
                              {stockOk ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <AlertTriangle className={`w-3.5 h-3.5 ${item.stock_balance > 0 ? 'text-yellow-500' : 'text-red-500'}`} />}
                              <span className={stockOk ? 'text-green-600 dark:text-green-400' : item.stock_balance > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                                Stock: {item.stock_balance} {item.uom}
                              </span>
                            </span>
                            <span className="text-gray-500">@ Rp {fmt(price)}</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment</label>
                      <select value={group.payment_type} onChange={e => updateField(gIdx, 'payment_type', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="CASH">Cash</option>
                        <option value="CREDIT">Credit</option>
                      </select>
                    </div>
                    {group.payment_type === 'CREDIT' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Terms (hari)</label>
                        <input type="number" value={group.payment_terms_days} onChange={e => updateField(gIdx, 'payment_terms_days', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Date</label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
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
