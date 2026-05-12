import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck, Save, Trash2, Upload, Image } from 'lucide-react'
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

export default function GoodsReceiptFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const toast = useToast()
  const queryClient = useQueryClient()

  const [selectedPoId, setSelectedPoId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    setInvoicePhotoUrl(existingGR.invoice_photo_url ?? '')
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
        qty_rejected: 0,
        reject_reason: '',
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
      const qtyRemaining = Number(poLine.qty) - Number(poLine.qty_received) + l.qty_received
      return { ...l, qty_ordered: Number(poLine.qty), qty_remaining: qtyRemaining }
    }))
    setEnriched(true)
  }, [isEdit, initialized, enriched, selectedPO])

  // Create mode: auto-populate lines and warehouse when PO selected
  useEffect(() => {
    if (isEdit) return
    if (!selectedPO?.lines) return
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
          qty_rejected: 0,
          reject_reason: '',
          unit_price_invoice: Number(l.unit_price),
          unit_price_po: Number(l.unit_price),
        }
      }))
    const poWarehouse = warehouses.find(w => w.branch_id === selectedPO.branch_id)
    if (poWarehouse) setWarehouseId(poWarehouse.id)
  }, [isEdit, selectedPO, warehouses])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/goods-receipts/upload/invoice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setInvoicePhotoUrl(data.data.path) // Store path, not public URL
      toast.success('Foto invoice berhasil diupload')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal upload foto invoice'))
    } finally {
      setUploading(false)
    }
  }

  const createGR = useCreateGoodsReceipt()

  const updateLine = (key: string, field: 'qty_received' | 'unit_price_invoice' | 'qty_rejected' | 'reject_reason', value: number | string) => {
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
      invoice_photo_url: invoicePhotoUrl || null,
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
  const totalInvoice = lines.reduce((s, l) => s + l.qty_received * l.unit_price_invoice, 0)

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/goods-receipts')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <PackageCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{isEdit ? 'Edit Penerimaan' : 'Terima Barang'}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{isEdit ? 'Perbarui data penerimaan barang' : 'Input penerimaan dari Purchase Order'}</p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={(createGR.isPending || updateGR.isPending) || lines.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm">
            <Save className="w-4 h-4" /> {(createGR.isPending || updateGR.isPending) ? 'Menyimpan...' : 'Simpan'}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Foto Invoice</label>
            <div className="flex gap-2 items-center">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf" className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Foto'}
              </button>
              {invoicePhotoUrl && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Image className="w-3 h-3" /> Terupload — {invoicePhotoUrl.split('/').pop()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Catatan penerimaan (opsional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        </div>
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sisa</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Diterima</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Ditolak</th>
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
                        <input type="number" min="0" step="0.01" value={l.qty_rejected || ''} onChange={e => updateLine(l.key, 'qty_rejected', parseFloat(e.target.value) || 0)}
                          className={`w-20 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm ${l.qty_rejected > 0 ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                        {l.qty_rejected > 0 && (
                          <select value={l.reject_reason} onChange={e => updateLine(l.key, 'reject_reason', e.target.value)}
                            className="mt-1 w-20 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">Alasan</option>
                            <option value="DAMAGED">Rusak</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="WRONG_ITEM">Salah</option>
                            <option value="OTHER">Lain</option>
                          </select>
                        )}
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
                    <td colSpan={7} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">Total Invoice:</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(totalInvoice)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden">
            {lines.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400">Pilih PO untuk mengisi item</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map(l => {
                  const variance = l.unit_price_invoice !== l.unit_price_po
                  return (
                    <div key={l.key} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{l.product_name}</p>
                          <p className="text-xs text-gray-500">{l.product_code} · {l.uom}</p>
                        </div>
                        <button onClick={() => removeLine(l.key)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-2">
                        <span>Order: {fmt(l.qty_ordered)}</span>
                        <span>Sisa: {fmt(l.qty_remaining)}</span>
                        <span>PO: Rp {fmt(l.unit_price_po)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Diterima</label>
                          <input type="number" min="0.01" max={l.qty_remaining} step="0.01" value={l.qty_received || ''}
                            onChange={e => updateLine(l.key, 'qty_received', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1.5 border rounded text-sm text-right ${l.qty_received > l.qty_remaining ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Ditolak</label>
                          <input type="number" min="0" step="0.01" value={l.qty_rejected || ''}
                            onChange={e => updateLine(l.key, 'qty_rejected', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1.5 border rounded text-sm text-right ${l.qty_rejected > 0 ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Harga Invoice</label>
                          <input type="number" min="0" step="1" value={l.unit_price_invoice || ''}
                            onChange={e => updateLine(l.key, 'unit_price_invoice', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1.5 border rounded text-sm text-right ${variance ? 'border-yellow-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} />
                        </div>
                      </div>
                      {l.qty_rejected > 0 && (
                        <div className="mt-2">
                          <select value={l.reject_reason} onChange={e => updateLine(l.key, 'reject_reason', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">Alasan tolak...</option>
                            <option value="DAMAGED">Rusak</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="WRONG_ITEM">Tidak Sesuai</option>
                            <option value="OTHER">Lainnya</option>
                          </select>
                        </div>
                      )}
                      <p className="text-right text-sm font-mono font-medium text-gray-900 dark:text-white mt-2">Rp {fmt(l.qty_received * l.unit_price_invoice)}</p>
                    </div>
                  )
                })}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex justify-between font-medium text-gray-900 dark:text-white">
                    <span>Total Invoice:</span>
                    <span className="font-mono font-bold">Rp {fmt(totalInvoice)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
