import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck, Save } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateGoodsReceipt, useGoodsReceipt } from '../api/goodsReceipts.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { GRLineCard, type GRLineData } from '../components/GRLineCard'

interface POOption {
  id: string
  po_number: string
  supplier_name: string
  branch_id: string
  branch_name: string
  warehouse_id?: string
  lines?: { id: string; product_id: string; product_code: string; product_name: string; qty: number; qty_received: number; uom: string; unit_price: number }[]
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
  const [lines, setLines] = useState<GRLineData[]>([])

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

  // Fetch POs that can receive goods
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

  // Fetch pending qty from existing DRAFT GRs
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

  // Edit mode: populate form
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
        uom_po: l.uom_po ?? l.uom ?? '',
        qty_ordered: Number(l.qty_po_uom ?? l.qty_received),
        qty_remaining: Number(l.qty_po_uom ?? l.qty_received),
        qty_po_uom: Number(l.qty_po_uom ?? l.qty_received),
        qty_received: Number(l.qty_received),
        uom_received: l.uom_received ?? l.uom ?? '',
        conversion_factor: Number(l.conversion_factor ?? 1),
        qty_rejected: Number(l.qty_rejected ?? 0),
        reject_reason: l.reject_reason ?? '',
        unit_price_invoice: Number(l.unit_price_invoice),
        unit_price_po: Number(l.unit_price_po ?? l.unit_price_invoice),
      })))
    }
    setInitialized(true)
  }, [existingGR, isEdit, initialized])

  // Edit mode: enrich lines with PO data
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

  // Create mode: auto-populate lines
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
          uom_po: l.uom,
          qty_ordered: Number(l.qty),
          qty_remaining: remaining,
          qty_po_uom: remaining,
          qty_received: remaining, // default: same as qty_po_uom (conversion=1)
          uom_received: l.uom, // default: same as PO UOM, card will auto-detect if needs conversion
          conversion_factor: 1,
          qty_rejected: 0,
          reject_reason: '',
          unit_price_invoice: Number(l.unit_price),
          unit_price_po: Number(l.unit_price),
        } satisfies GRLineData
      })
      .filter(l => l.qty_remaining > 0)
  }, [isEdit, selectedPO, pendingQty])

  useEffect(() => {
    if (!computedLines) return
    if (lastPopulatedPoRef.current === selectedPoId) return
    lastPopulatedPoRef.current = selectedPoId
    setLines(computedLines)
  }, [computedLines, selectedPoId])

  // Auto-set warehouse
  useEffect(() => {
    if (isEdit || !selectedPO || warehouseId) return
    const poWarehouse = warehouses.find(w => w.branch_id === selectedPO.branch_id)
    if (poWarehouse) setWarehouseId(poWarehouse.id)
  }, [isEdit, selectedPO, warehouses, warehouseId])

  const createGR = useCreateGoodsReceipt()

  const handleLineChange = (key: string, updates: Partial<GRLineData>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...updates } : l))
  }

  const handleLineRemove = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const handleSubmit = async () => {
    if (!isEdit && !selectedPoId) { toast.error('Pilih Purchase Order'); return }
    if (!warehouseId) { toast.error('Pilih Gudang'); return }
    if (lines.length === 0) { toast.error('Minimal 1 item'); return }

    const invalidLines = lines.filter(l => l.qty_po_uom > l.qty_remaining)
    if (invalidLines.length > 0) { toast.error('Qty diterima tidak boleh melebihi sisa qty PO'); return }

    const invalidReject = lines.filter(l => l.qty_rejected > l.qty_po_uom)
    if (invalidReject.length > 0) { toast.error('Qty ditolak tidak boleh melebihi qty diterima'); return }

    const missingReason = lines.filter(l => l.qty_rejected > 0 && !l.reject_reason)
    if (missingReason.length > 0) { toast.error('Pilih alasan penolakan untuk item yang ditolak'); return }

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
        qty_po_uom: l.qty_po_uom,
        qty_received: l.qty_received,
        uom_received: l.uom_received,
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

  const totalInvoice = lines.reduce((sum, l) => sum + l.qty_received * l.unit_price_invoice, 0)
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

      {/* Form Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Order *</label>
            <select value={selectedPoId} onChange={e => setSelectedPoId(e.target.value)} disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-60">
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

      {/* Line Items */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Section header */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Daftar Barang ({lines.length} item)</h2>
            {lines.length > 0 && (
              <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">Total: Rp {fmt(Math.round(totalInvoice))}</span>
            )}
          </div>

          {/* Cards */}
          {lines.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <PackageCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {selectedPoId && selectedPO?.lines && selectedPO.lines.length > 0
                  ? 'Semua item PO ini sudah tercakup oleh penerimaan sebelumnya.'
                  : 'Pilih Purchase Order di atas untuk mengisi daftar barang'}
              </p>
            </div>
          ) : (
            lines.map(l => (
              <GRLineCard key={l.key} line={l} onChange={handleLineChange} onRemove={handleLineRemove} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
