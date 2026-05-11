import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PackageCheck, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateGoodsReceipt } from '../api/goodsReceipts.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

interface POOption {
  id: string
  po_number: string
  supplier_name: string
  branch_id: string
  branch_name: string
  warehouse_id?: string
  lines?: { id: string; product_id: string; product_code: string; product_name: string; qty: number; qty_received: number; uom: string; unit_price: number }[]
}

interface LineItem {
  key: string
  po_line_id: string
  product_id: string
  product_name: string
  product_code: string
  uom: string
  qty_ordered: number
  qty_already_received: number
  qty_remaining: number
  qty_received: number
  unit_price_invoice: number
  unit_price_po: number
}

export default function GoodsReceiptFormPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [selectedPoId, setSelectedPoId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])

  // Fetch POs that can receive goods (SENT or PARTIAL_RECEIVED)
  const { data: posData } = useQuery({
    queryKey: ['purchase-orders', 'receivable'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders', { params: { status: 'SENT', limit: 50 } })
      const sent = data.data as POOption[]
      const { data: data2 } = await api.get('/purchase-orders', { params: { status: 'PARTIAL_RECEIVED', limit: 50 } })
      const partial = data2.data as POOption[]
      return [...sent, ...partial]
    },
    staleTime: 30_000,
  })
  const receivablePOs = posData ?? []

  // Fetch PO detail when selected
  const { data: selectedPO } = useQuery({
    queryKey: ['purchase-orders', selectedPoId, 'detail-for-gr'],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-orders/${selectedPoId}`)
      return data.data as POOption
    },
    enabled: !!selectedPoId,
  })

  // Fetch warehouses
  const { data: warehousesData } = useWarehouses({ limit: 50, warehouse_type: 'MAIN' })
  const warehouses = warehousesData?.data ?? []

  // Auto-populate lines when PO selected
  useEffect(() => {
    if (selectedPO?.lines) {
      setLines(selectedPO.lines
        .filter(l => Number(l.qty) - Number(l.qty_received) > 0)
        .map(l => {
          const remaining = Number(l.qty) - Number(l.qty_received)
          return {
            key: crypto.randomUUID(),
            po_line_id: l.id,
            product_id: l.product_id,
            product_name: l.product_name ?? '',
            product_code: l.product_code ?? '',
            uom: l.uom,
            qty_ordered: Number(l.qty),
            qty_already_received: Number(l.qty_received),
            qty_remaining: remaining,
            qty_received: remaining,
            unit_price_invoice: Number(l.unit_price),
            unit_price_po: Number(l.unit_price),
          }
        }))
    }
  }, [selectedPO])

  const createGR = useCreateGoodsReceipt()

  const updateLine = (key: string, field: 'qty_received' | 'unit_price_invoice', value: number) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const handleSubmit = async () => {
    if (!selectedPoId) { toast.error('Pilih Purchase Order'); return }
    if (!warehouseId) { toast.error('Pilih Gudang'); return }
    if (lines.length === 0) { toast.error('Minimal 1 item'); return }

    const invalidLines = lines.filter(l => l.qty_received > l.qty_remaining)
    if (invalidLines.length > 0) { toast.error('Qty diterima tidak boleh melebihi sisa qty PO'); return }

    try {
      await createGR.mutateAsync({
        po_id: selectedPoId,
        warehouse_id: warehouseId,
        received_date: receivedDate || undefined,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate || null,
        invoice_photo_url: invoicePhotoUrl || null,
        notes: null,
        lines: lines.map(l => ({
          po_line_id: l.po_line_id,
          product_id: l.product_id,
          qty_received: l.qty_received,
          unit_price_invoice: l.unit_price_invoice,
        })),
      })
      toast.success('Penerimaan barang berhasil dibuat')
      navigate('/inventory/goods-receipts')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat penerimaan barang'))
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
  const totalInvoice = lines.reduce((s, l) => s + l.qty_received * l.unit_price_invoice, 0)

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/goods-receipts')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <PackageCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Terima Barang</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Input penerimaan dari Purchase Order</p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={createGR.isPending || lines.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {createGR.isPending ? 'Menyimpan...' : 'Simpan Draft'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Order *</label>
            <select value={selectedPoId} onChange={e => setSelectedPoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Pilih PO</option>
              {receivablePOs.map(po => <option key={po.id} value={po.id}>{po.po_number} — {po.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gudang Tujuan *</label>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Pilih Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name} ({w.branch_name})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Terima</label>
            <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. Invoice</label>
            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Nomor invoice supplier"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Invoice</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Foto Invoice URL</label>
            <input type="text" value={invoicePhotoUrl} onChange={e => setInvoicePhotoUrl(e.target.value)} placeholder="URL foto invoice (wajib saat confirm)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Lines Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sisa</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Diterima</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-36">Harga Invoice</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga PO</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {lines.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Pilih PO untuk mengisi item</td></tr>
              ) : lines.map(l => {
                const variance = l.unit_price_invoice !== l.unit_price_po
                return (
                  <tr key={l.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                      <div className="text-xs text-gray-500">{l.product_code} · {l.uom}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{fmt(l.qty_ordered)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{fmt(l.qty_remaining)}</td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="0.01" max={l.qty_remaining} step="0.01" value={l.qty_received || ''} onChange={e => updateLine(l.key, 'qty_received', parseFloat(e.target.value) || 0)}
                        className={`w-24 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm ${l.qty_received > l.qty_remaining ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="0" step="1" value={l.unit_price_invoice || ''} onChange={e => updateLine(l.key, 'unit_price_invoice', parseFloat(e.target.value) || 0)}
                        className={`w-32 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm ${variance ? 'border-yellow-500' : 'border-gray-300 dark:border-gray-600'}`} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{fmt(l.unit_price_po)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(l.qty_received * l.unit_price_invoice)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => removeLine(l.key)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {lines.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">Total Invoice:</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(totalInvoice)}</td>
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
