import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateGoodsReceipt, useGoodsReceipt } from '../api/goodsReceipts.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  qty_rejected: number
  reject_reason: string
  unit_price_invoice: number
  unit_price_po: number
}

const emptyPendingQty: Record<string, number> = {}

export default function GoodsReceiptFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const toast = useToast()
  const queryClient = useQueryClient()

  const [searchParams] = useSearchParams()
  const [selectedPoId, setSelectedPoId] = useState(searchParams.get('po_id') || '')
  const [warehouseId, setWarehouseId] = useState('')
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])

  // Fetch existing GR for edit mode
  const { data: existingGR } = useGoodsReceipt(isEdit ? id : '')
  const [initialized, setInitialized] = useState(false)
  const [enriched, setEnriched] = useState(false)

  // Update mutation
  const updateGR = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put(`/goods-receipts/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] })
      toast.success('Penerimaan barang berhasil diperbarui')
      navigate(`/inventory/goods-receipts/${id}`)
    },
    onError: (err: unknown) => toast.error(parseApiError(err, 'Gagal memperbarui')),
  })

  // Fetch POs that can receive goods (ORDERED or PARTIAL_RECEIVED)
  const { data: posData } = useQuery({
    queryKey: ['purchase-orders', 'receivable'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders', { params: { status: 'ORDERED', limit: 50 } })
      const ordered = data.data as POOption[]
      const { data: data2 } = await api.get('/purchase-orders', { params: { status: 'PARTIAL_RECEIVED', limit: 50 } })
      const partial = data2.data as POOption[]
      return [...ordered, ...partial]
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

  // Fetch pending qty from existing DRAFT GRs for this PO (exclude current GR if editing)
  const { data: pendingData } = useQuery({
    queryKey: ['goods-receipts', 'pending-qty', selectedPoId, id],
    queryFn: async () => {
      const params: Record<string, string> = { po_id: selectedPoId }
      if (isEdit && id) params.exclude_gr_id = id
      const { data } = await api.get('/goods-receipts/pending-qty', { params })
      return data.data as Record<string, number>
    },
    enabled: !!selectedPoId,
  })
  const pendingQty = pendingData ?? emptyPendingQty

  // Fetch warehouses
  const { data: warehousesData } = useWarehouses({ limit: 50, warehouse_type: 'MAIN' })
  const warehouses = warehousesData?.data ?? []

  // Edit mode: populate form from existing GR
  useEffect(() => {
    if (!isEdit || initialized || !existingGR) return
    setSelectedPoId(existingGR.po_id)
    setWarehouseId(existingGR.warehouse_id)
    setReceivedDate(existingGR.received_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
    setInvoiceNumber(existingGR.invoice_number ?? '')
    setInvoiceDate(existingGR.invoice_date?.slice(0, 10) ?? '')
    setNotes(existingGR.notes ?? '')
    if (existingGR.lines) {
      setLines(existingGR.lines.map(l => ({
        key: crypto.randomUUID(),
        po_line_id: l.po_line_id ?? '',
        product_id: l.product_id,
        product_name: l.product_name ?? '',
        product_code: l.product_code ?? '',
        uom: l.uom ?? '',
        qty_ordered: Number(l.qty_received),
        qty_already_received: 0,
        qty_remaining: Number(l.qty_received),
        qty_received: Number(l.qty_received),
        qty_rejected: Number(l.qty_rejected ?? 0),
        reject_reason: l.reject_reason ?? '',
        unit_price_invoice: Number(l.unit_price_invoice),
        unit_price_po: Number(l.unit_price_po ?? l.unit_price_invoice),
      })))
    }
    setInitialized(true)
  }, [existingGR, isEdit, initialized])

  // Edit mode: enrich lines with correct qty_ordered/qty_remaining from PO once PO loads
  useEffect(() => {
    if (!isEdit || !initialized || enriched || !selectedPO?.lines) return
    setLines(prev => prev.map(l => {
      const poLine = selectedPO.lines?.find(pl => pl.id === l.po_line_id)
      if (!poLine) return l
      const qtyRemaining = Number(poLine.qty) - Number(poLine.qty_received)
      return { ...l, qty_ordered: Number(poLine.qty), qty_remaining: qtyRemaining }
    }))
    setEnriched(true)
  }, [isEdit, initialized, enriched, selectedPO])

  // Create mode: auto-populate lines and warehouse when PO selected
  // Track which PO was last used to populate lines to avoid overwriting user edits
  const lastPopulatedPoRef = useRef<string>('')

  const computedLines = useMemo(() => {
    if (isEdit || !selectedPO?.lines) return null
    return selectedPO.lines
      .map(l => {
        const pendingAmt = pendingQty[l.id] ?? 0
        const remaining = Math.max(0, Number(l.qty) - Number(l.qty_received) - pendingAmt)
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
          qty_rejected: 0,
          reject_reason: '',
          unit_price_invoice: Number(l.unit_price),
          unit_price_po: Number(l.unit_price),
        }
      })
      .filter(l => l.qty_remaining > 0)
  }, [isEdit, selectedPO, pendingQty])

  useEffect(() => {
    if (!computedLines) return
    // Only auto-populate when PO changes, not when pendingQty refetches
    if (lastPopulatedPoRef.current === selectedPoId) return
    lastPopulatedPoRef.current = selectedPoId
    setLines(computedLines)
  }, [computedLines, selectedPoId])

  // Set warehouse when PO branch matches a warehouse
  useEffect(() => {
    if (isEdit || !selectedPO || warehouseId) return
    const poWarehouse = warehouses.find(w => w.branch_id === selectedPO.branch_id)
    if (poWarehouse) setWarehouseId(poWarehouse.id)
  }, [isEdit, selectedPO, warehouses, warehouseId])

  const createGR = useCreateGoodsReceipt()

  const updateLine = (key: string, field: 'qty_received' | 'qty_rejected' | 'reject_reason', value: number | string) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'qty_rejected' && (value as number) === 0) updated.reject_reason = ''
      return updated
    }))
  }

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const handleSubmit = async () => {
    if (!isEdit && !selectedPoId) { toast.error('Pilih Purchase Order'); return }
    if (!warehouseId) { toast.error('Pilih Gudang'); return }
    if (lines.length === 0) { toast.error('Minimal 1 item'); return }

    if (!isEdit) {
      const invalidLines = lines.filter(l => l.qty_received > l.qty_remaining)
      if (invalidLines.length > 0) { toast.error('Qty diterima tidak boleh melebihi sisa qty PO'); return }

      const invalidReject = lines.filter(l => l.qty_rejected > l.qty_received)
      if (invalidReject.length > 0) { toast.error('Qty ditolak tidak boleh melebihi qty diterima'); return }

      const missingReason = lines.filter(l => l.qty_rejected > 0 && !l.reject_reason)
      if (missingReason.length > 0) { toast.error('Pilih alasan penolakan untuk item yang ditolak'); return }
    }

    const payload = {
      po_id: selectedPoId,
      warehouse_id: warehouseId,
      received_date: receivedDate || undefined,
      invoice_number: invoiceNumber || null,
      invoice_date: invoiceDate || null,
      notes: notes || null,
      lines: lines.map(l => ({
        po_line_id: l.po_line_id,
        product_id: l.product_id,
        qty_received: l.qty_received,
        qty_rejected: l.qty_rejected || 0,
        reject_reason: l.reject_reason || null,
        unit_price_invoice: l.unit_price_invoice,
      })),
    }

    if (isEdit) {
      updateGR.mutate(payload)
    } else {
      createGR.mutateAsync(payload)
        .then(() => { toast.success('Penerimaan barang berhasil dibuat'); navigate('/inventory/goods-receipts') })
        .catch((err: unknown) => toast.error(parseApiError(err, 'Gagal membuat penerimaan barang')))
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/inventory/goods-receipts')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <PackageCheck className="w-6 h-6 text-teal-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">{isEdit ? 'Edit Penerimaan' : 'Terima Barang'}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{isEdit ? 'Perbarui data penerimaan barang' : 'Input penerimaan dari Purchase Order'}</p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={(createGR.isPending || updateGR.isPending) || lines.length === 0}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm shrink-0">
            <Save className="w-4 h-4" /> <span className="hidden sm:inline">{(createGR.isPending || updateGR.isPending) ? 'Menyimpan...' : 'Simpan'}</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. Invoice Supplier</label>
            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Contoh: INV-2026-001"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Invoice</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-20">UOM</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-20">Qty PO</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Belum Terima</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Qty Diterima</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Qty Ditolak</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {lines.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    {selectedPoId && selectedPO?.lines && selectedPO.lines.length > 0
                      ? 'Semua item PO ini sudah tercakup oleh penerimaan (DRAFT) sebelumnya. Konfirmasi atau hapus GR DRAFT yang ada terlebih dahulu.'
                      : 'Pilih PO di atas untuk mengisi daftar barang'}
                  </td></tr>
                ) : lines.map(l => (
                    <tr key={l.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                        <div className="text-xs text-gray-500">{l.product_code}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{l.uom}</td>
                      <td className="px-3 py-3 text-right font-mono text-gray-500 dark:text-gray-400">{fmt(l.qty_ordered)}</td>
                      <td className="px-3 py-3 text-right font-mono text-gray-600 dark:text-gray-300 font-medium">{fmt(l.qty_remaining)}</td>
                      <td className="px-3 py-3 text-center">
                        <input type="number" min="0.01" max={l.qty_remaining} step="0.01" value={l.qty_received || ''}
                          onChange={e => updateLine(l.key, 'qty_received', parseFloat(e.target.value) || 0)}
                          className={`w-24 px-2 py-1.5 border rounded text-sm text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${l.qty_received > l.qty_remaining ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}`} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <input type="number" min="0" step="0.01" value={l.qty_rejected || ''}
                            onChange={e => updateLine(l.key, 'qty_rejected', parseFloat(e.target.value) || 0)}
                            className={`w-20 px-2 py-1.5 border rounded text-sm text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${l.qty_rejected > 0 ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`} />
                          {l.qty_rejected > 0 && (
                            <select value={l.reject_reason} onChange={e => updateLine(l.key, 'reject_reason', e.target.value)}
                              className="w-28 px-1.5 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                              <option value="">Pilih alasan...</option>
                              <option value="DAMAGED">Rusak</option>
                              <option value="EXPIRED">Kadaluarsa</option>
                              <option value="WRONG_ITEM">Salah Barang</option>
                              <option value="OTHER">Lainnya</option>
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => removeLine(l.key)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
              </tbody>
              {lines.length > 0 && (
                <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{lines.length} item</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile & Tablet Cards */}
          <div className="lg:hidden">
            {lines.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">
                {selectedPoId && selectedPO?.lines && selectedPO.lines.length > 0
                  ? 'Semua item PO ini sudah tercakup oleh penerimaan (DRAFT) sebelumnya.'
                  : 'Pilih PO di atas untuk mengisi daftar barang'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map(l => (
                    <div key={l.key} className="p-4 space-y-3">
                      {/* Product header */}
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{l.product_name}</p>
                          <p className="text-xs text-gray-500">{l.product_code} · {l.uom}</p>
                        </div>
                        <button onClick={() => removeLine(l.key)} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      {/* Info row */}
                      <div className="flex gap-4 text-xs">
                        <div className="flex flex-col">
                          <span className="text-gray-500">Qty PO</span>
                          <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{fmt(l.qty_ordered)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500">Belum Terima</span>
                          <span className="font-mono font-medium text-gray-900 dark:text-white">{fmt(l.qty_remaining)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500">UOM</span>
                          <span className="text-gray-700 dark:text-gray-300">{l.uom}</span>
                        </div>
                      </div>

                      {/* Input row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qty Diterima</label>
                          <input type="number" min="0.01" max={l.qty_remaining} step="0.01" value={l.qty_received || ''}
                            onChange={e => updateLine(l.key, 'qty_received', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2.5 py-2 border rounded-lg text-sm text-right ${l.qty_received > l.qty_remaining ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qty Ditolak</label>
                          <input type="number" min="0" step="0.01" value={l.qty_rejected || ''}
                            onChange={e => updateLine(l.key, 'qty_rejected', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2.5 py-2 border rounded-lg text-sm text-right ${l.qty_rejected > 0 ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} />
                        </div>
                      </div>

                      {/* Reject reason */}
                      {l.qty_rejected > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-red-600 dark:text-red-400 mb-1">Alasan Penolakan</label>
                          <select value={l.reject_reason} onChange={e => updateLine(l.key, 'reject_reason', e.target.value)}
                            className="w-full px-2.5 py-2 border border-red-300 dark:border-red-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">Pilih alasan...</option>
                            <option value="DAMAGED">Rusak</option>
                            <option value="EXPIRED">Kadaluarsa</option>
                            <option value="WRONG_ITEM">Salah Barang</option>
                            <option value="OTHER">Lainnya</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lines.length} item</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
