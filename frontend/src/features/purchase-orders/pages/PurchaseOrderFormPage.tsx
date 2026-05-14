import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreatePurchaseOrder, useCheckDuplicatePO, getLatestPrice } from '../api/purchaseOrders.api'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

interface PROption {
  id: string
  request_number: string
  branch_id: string
  branch_name: string
  needed_by_date: string | null
  lines: { id: string; product_id: string; product_code: string; product_name: string; qty: number; uom: string; estimated_price: number | null; supplier_id: string | null; supplier_name: string | null }[]
}

interface LineItem {
  key: string
  pr_line_id: string | null
  product_id: string
  product_name: string
  product_code: string
  qty: number
  uom: string
  unit_price: number
}

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [selectedPrId, setSelectedPrId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT'>('CREDIT')
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | ''>('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])

  // Fetch approved PRs
  const { data: prsData } = useQuery({
    queryKey: ['purchase-requests', 'approved-for-po'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-requests', { params: { status: 'APPROVED', limit: 50 } })
      return data.data as PROption[]
    },
    staleTime: 30_000,
  })
  const approvedPRs = prsData ?? []

  // Fetch PR detail when selected
  const { data: selectedPR } = useQuery({
    queryKey: ['purchase-requests', selectedPrId, 'detail'],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-requests/${selectedPrId}`)
      return data.data as PROption
    },
    enabled: !!selectedPrId,
  })

  // Fetch suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/suppliers', { params: { is_active: true, limit: 100 } })
      return data.data as { id: string; supplier_name: string; supplier_code: string }[]
    },
    staleTime: 120_000,
  })
  const suppliers = suppliersData ?? []

  // Auto-populate lines when PR is selected
  // Auto-populate lines when PR selected, fetch latest prices
  useEffect(() => {
    if (selectedPR?.lines) {
      const populateLines = async () => {
        const newLines = await Promise.all(selectedPR.lines.map(async l => {
          let unitPrice = l.estimated_price ?? 0
          if (supplierId) {
            try {
              const priceData = await getLatestPrice(l.product_id, supplierId)
              if (priceData.price > 0) unitPrice = priceData.price
            } catch { /* fallback to estimated */ }
          }
          return {
            key: crypto.randomUUID(),
            pr_line_id: l.id,
            product_id: l.product_id,
            product_name: l.product_name,
            product_code: l.product_code,
            qty: l.qty,
            uom: l.uom,
            unit_price: unitPrice,
          }
        }))
        setLines(newLines)
      }
      populateLines()
    }
  }, [selectedPR, supplierId])

  const createPO = useCreatePurchaseOrder()

  const updateLine = (key: string, field: keyof LineItem, value: unknown) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const handleSubmit = async () => {
    if (!selectedPrId) { toast.error('Pilih Purchase Request'); return }
    if (!supplierId) { toast.error('Pilih Supplier'); return }
    if (lines.length === 0) { toast.error('Minimal 1 item'); return }

    const branchId = selectedPR?.branch_id ?? approvedPRs.find(p => p.id === selectedPrId)?.branch_id
    if (!branchId) { toast.error('Branch tidak ditemukan'); return }

    try {
      await createPO.mutateAsync({
        branch_id: branchId,
        supplier_id: supplierId,
        purchase_request_id: selectedPrId,
        payment_type: paymentType,
        payment_terms_days: paymentType === 'CREDIT' && paymentTermsDays ? Number(paymentTermsDays) : null,
        expected_delivery_date: expectedDate || null,
        notes: notes || null,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty: l.qty,
          uom: l.uom,
          unit_price: l.unit_price,
          pr_line_id: l.pr_line_id,
        })),
      })
      toast.success('Purchase order berhasil dibuat')
      navigate('/inventory/purchase-orders')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat purchase order'))
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
  const totalAmount = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)

  // Duplicate PO check
  const selectedPRBranchId = selectedPR?.branch_id ?? approvedPRs.find(p => p.id === selectedPrId)?.branch_id
  const { data: duplicateCheck } = useCheckDuplicatePO({
    supplier_id: supplierId || undefined,
    branch_id: selectedPRBranchId || undefined,
    total_amount: totalAmount > 0 ? totalAmount : undefined,
  })

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/inventory/purchase-orders')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Buat Purchase Order</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dari Purchase Request yang sudah disetujui</p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={createPO.isPending || lines.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {createPO.isPending ? 'Menyimpan...' : 'Simpan PO'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Request *</label>
            <select value={selectedPrId} onChange={e => setSelectedPrId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Pilih PR yang sudah disetujui</option>
              {approvedPRs.map(pr => <option key={pr.id} value={pr.id}>{pr.request_number} — {pr.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Pilih Supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimasi Kirim</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pembayaran *</label>
            <select value={paymentType} onChange={e => setPaymentType(e.target.value as 'CASH' | 'CREDIT')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="CREDIT">Tempo (Credit)</option>
              <option value="CASH">Cash / Petty Cash</option>
            </select>
          </div>
          {paymentType === 'CREDIT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jatuh Tempo (hari)</label>
              <input type="number" min="1" value={paymentTermsDays} onChange={e => setPaymentTermsDays(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="30" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Duplicate Warning */}
      {duplicateCheck && duplicateCheck.count > 0 && (
        <div className="mx-6 mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-orange-500 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Potensi Duplikasi PO ({duplicateCheck.count} PO serupa)</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">Ditemukan PO dengan supplier, cabang, dan nominal serupa dalam 30 hari terakhir:</p>
              <div className="mt-2 space-y-1">
                {duplicateCheck.similar_pos.slice(0, 3).map(po => (
                  <div key={po.id} className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
                    {po.po_number} — Rp {fmt(po.total_amount)} ({po.status})
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lines Table */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">UOM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-36">Harga/Unit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {lines.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Pilih Purchase Request untuk mengisi item</td></tr>
              ) : lines.map(l => (
                <tr key={l.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                    <div className="text-xs text-gray-500">{l.product_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0.01" value={l.qty || ''} onChange={e => updateLine(l.key, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={l.uom} onChange={e => updateLine(l.key, 'uom', e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" step="1" value={l.unit_price || ''} onChange={e => updateLine(l.key, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm" />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(l.qty * l.unit_price)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeLine(l.key)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{lines.length} item — Total:</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(totalAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
