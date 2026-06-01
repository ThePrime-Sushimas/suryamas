import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2, Scissors } from 'lucide-react'
import { useCreateStockAdjustment, type AdjustmentReason } from '../api/stockAdjustments.api'
import { ProductSearchInput } from '@/features/daily-prep-orders2/components/ProductSearchInput'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'

interface WasteLine {
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  stock: number | null
  notes: string
}

interface OutputLine {
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  notes: string
}

export default function CreateStockAdjustmentPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createAdjustment = useCreateStockAdjustment()
  const { branches } = useBranchContextStore()

  const todayStr = new Date().toISOString().slice(0, 10)

  // Header
  const [adjustmentType, setAdjustmentType] = useState<'WASTE' | 'BREAKDOWN'>('WASTE')
  const [branchId, setBranchId] = useState(branches[0]?.branch_id ?? '')
  const [warehouseId, setWarehouseId] = useState('')
  const [adjustmentDate, setAdjustmentDate] = useState(todayStr)
  const [reason, setReason] = useState<AdjustmentReason | ''>('')

  // WASTE: multi-product lines
  const [wasteLines, setWasteLines] = useState<WasteLine[]>([])

  // BREAKDOWN: single input + outputs
  const [inputProduct, setInputProduct] = useState<{ id: string; product_code: string; product_name: string; base_unit_name: string | null } | null>(null)
  const [inputQty, setInputQty] = useState<number>(0)
  const [inputStock, setInputStock] = useState<number | null>(null)
  const [outputs, setOutputs] = useState<OutputLine[]>([])

  // Warehouse query: READY for both WASTE and BREAKDOWN
  const { data: warehousesData } = useWarehouses({ limit: 50, branch_id: branchId || undefined, warehouse_type: 'READY' })
  const warehouses = warehousesData?.data ?? []

  const handleBranchChange = (val: string) => { setBranchId(val); setWarehouseId('') }

  // Fetch stock for BREAKDOWN input
  useEffect(() => {
    if (!inputProduct || !warehouseId) { setInputStock(null); return }
    api.get('/stock/balances', { params: { warehouse_id: warehouseId, product_id: inputProduct.id, limit: 1 } })
      .then(res => setInputStock(res?.data?.data?.[0] ? Number(res.data.data[0].qty) : 0))
      .catch(() => setInputStock(null))
  }, [inputProduct, warehouseId])

  // Fetch stock for WASTE line after adding
  const fetchStockForWasteLine = async (productId: string) => {
    if (!warehouseId) return
    try {
      // Fetch READY warehouse stock
      const readyRes = await api.get('/stock/balances', { params: { warehouse_id: warehouseId, product_id: productId, limit: 1 } })
      const readyQty = readyRes?.data?.data?.[0] ? Number(readyRes.data.data[0].qty) : 0
      setWasteLines(prev => prev.map(l => l.product_id === productId ? { ...l, stock: readyQty } : l))
    } catch { /* informational */ }
  }

  // ─── WASTE handlers ─────────────────────────────────────────────────────────

  const handleAddWasteLine = (product: { id: string; product_code: string; product_name: string; station: string | null; base_unit_name: string | null }) => {
    if (wasteLines.some(l => l.product_id === product.id)) return
    setWasteLines(prev => [...prev, {
      product_id: product.id, product_code: product.product_code, product_name: product.product_name,
      base_unit_name: product.base_unit_name, qty: 0, stock: null, notes: '',
    }])
    fetchStockForWasteLine(product.id)
  }

  const handleRemoveWasteLine = (idx: number) => setWasteLines(prev => prev.filter((_, i) => i !== idx))
  const handleWasteQtyChange = (idx: number, val: string) => {
    const qty = parseFloat(val) || 0
    setWasteLines(prev => prev.map((l, i) => i === idx ? { ...l, qty } : l))
  }

  // ─── BREAKDOWN handlers ─────────────────────────────────────────────────────

  const handleSelectInputProduct = (product: { id: string; product_code: string; product_name: string; station: string | null; base_unit_name: string | null }) => {
    setInputProduct({ id: product.id, product_code: product.product_code, product_name: product.product_name, base_unit_name: product.base_unit_name })
  }

  const handleAddOutput = (product: { id: string; product_code: string; product_name: string; station: string | null; base_unit_name: string | null }) => {
    if (outputs.some(o => o.product_id === product.id)) return
    setOutputs(prev => [...prev, {
      product_id: product.id, product_code: product.product_code, product_name: product.product_name,
      base_unit_name: product.base_unit_name, qty: 0, notes: '',
    }])
  }

  const handleRemoveOutput = (idx: number) => setOutputs(prev => prev.filter((_, i) => i !== idx))
  const handleOutputQtyChange = (idx: number, val: string) => {
    const qty = parseFloat(val) || 0
    setOutputs(prev => prev.map((o, i) => i === idx ? { ...o, qty } : o))
  }

  const totalOutputQty = outputs.reduce((sum, o) => sum + o.qty, 0)
  const breakdownWasteQty = adjustmentType === 'BREAKDOWN' ? Math.max(0, inputQty - totalOutputQty) : 0

  // ─── SUBMIT ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!warehouseId) { toast.error('Pilih gudang'); return }
    if (!adjustmentDate) { toast.error('Pilih tanggal'); return }

    if (adjustmentType === 'WASTE') {
      if (wasteLines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
      if (wasteLines.some(l => l.qty <= 0)) { toast.error('Semua qty harus lebih dari 0'); return }
    } else {
      if (!inputProduct) { toast.error('Pilih produk input'); return }
      if (inputQty <= 0) { toast.error('Qty input harus lebih dari 0'); return }
      if (outputs.length === 0) { toast.error('Tambahkan minimal 1 produk output'); return }
      if (outputs.some(o => o.qty <= 0)) { toast.error('Semua qty output harus lebih dari 0'); return }
      if (totalOutputQty > inputQty) { toast.error('Total output tidak boleh melebihi input'); return }
    }

    try {
      const result = await createAdjustment.mutateAsync({
        adjustment_type: adjustmentType,
        warehouse_id: warehouseId,
        adjustment_date: adjustmentDate,
        reason: reason ? reason : undefined,
        ...(adjustmentType === 'WASTE' ? {
          lines: wasteLines.map(l => ({ product_id: l.product_id, qty: l.qty, notes: l.notes || undefined })),
        } : {
          input_product_id: inputProduct!.id,
          input_qty: inputQty,
          outputs: outputs.map(o => ({ product_id: o.product_id, qty: o.qty, notes: o.notes || undefined })),
        }),
      })
      toast.success(`${adjustmentType === 'WASTE' ? 'Waste' : 'Breakdown'} ${result.adjustment_number} berhasil dibuat`)
      navigate(`/inventory/stock-adjustments/${result.id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat adjustment'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-18 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate('/inventory/stock-adjustments')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Scissors className="w-6 h-6 text-indigo-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                {adjustmentType === 'WASTE' ? 'Catat Waste' : 'Catat Breakdown'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {adjustmentType === 'WASTE' ? 'Buang barang rusak/expired (multi-produk)' : 'Pecah 1 produk jadi beberapa bagian'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6">
          <div className="max-w-4xl mx-auto space-y-6">

          {/* Type + Info */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Informasi</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipe</label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer transition-all ${adjustmentType === 'WASTE' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" name="adj_type" value="WASTE" checked={adjustmentType === 'WASTE'} onChange={() => { setAdjustmentType('WASTE'); setWarehouseId(''); setOutputs([]); setInputProduct(null); setInputQty(0) }} className="sr-only" />
                  <Trash2 className="w-4 h-4" />
                  <div><span className="text-sm font-medium">Waste</span><p className="text-xs text-gray-500 dark:text-gray-400">Buang barang (multi-produk)</p></div>
                </label>
                <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer transition-all ${adjustmentType === 'BREAKDOWN' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" name="adj_type" value="BREAKDOWN" checked={adjustmentType === 'BREAKDOWN'} onChange={() => { setAdjustmentType('BREAKDOWN'); setWarehouseId(''); setWasteLines([]) }} className="sr-only" />
                  <Scissors className="w-4 h-4" />
                  <div><span className="text-sm font-medium">Breakdown</span><p className="text-xs text-gray-500 dark:text-gray-400">Pecah 1 produk → beberapa</p></div>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cabang <span className="text-red-500">*</span></label>
                <select value={branchId} onChange={e => handleBranchChange(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Pilih cabang...</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Gudang <span className="text-red-500">*</span></label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} disabled={!branchId} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50">
                  <option value="">Pilih gudang...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tanggal <span className="text-red-500">*</span></label>
                <input type="date" value={adjustmentDate} onChange={e => setAdjustmentDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Alasan</label>
                <select value={reason} onChange={e => setReason(e.target.value as AdjustmentReason | '')} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Pilih alasan...</option>
                  <option value="EXPIRED">Expired / Kadaluarsa</option>
                  <option value="DAMAGED">Rusak</option>
                  <option value="CONTAMINATED">Terkontaminasi</option>
                  <option value="OVERSTOCK">Overstock</option>
                  <option value="PROCESSING_LOSS">Susut Proses</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── WASTE: Multi-product lines ─────────────────────────────────────── */}
          {adjustmentType === 'WASTE' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk yang Dibuang ({wasteLines.length} item)</h2>
              <div className="mb-4">
                <ProductSearchInput onSelect={handleAddWasteLine} excludeProductIds={wasteLines.map(l => l.product_id)} placeholder="Cari produk untuk ditambahkan..." />
              </div>
              {wasteLines.length === 0 ? (
                <div className="text-center py-10 text-gray-400"><Trash2 className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Tambahkan produk yang akan dibuang</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stok Ready</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty Buang</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {wasteLines.map((l, idx) => (
                        <tr key={l.product_id}>
                          <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3"><span className="font-medium text-gray-900 dark:text-white">{l.product_name}</span><span className="ml-2 text-xs text-gray-400 font-mono">{l.product_code}</span></td>
                          <td className="px-4 py-3 text-right text-xs font-mono text-gray-500">{l.stock !== null ? l.stock.toLocaleString('id-ID') : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <input type="number" min="0.01" step="any" value={l.qty || ''} onChange={e => handleWasteQtyChange(idx, e.target.value)}
                              className="w-20 px-2 py-1.5 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{l.base_unit_name ?? '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => handleRemoveWasteLine(idx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── BREAKDOWN: Input + Outputs ─────────────────────────────────────── */}
          {adjustmentType === 'BREAKDOWN' && (
            <>
              {/* Input */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk Input (yang dipecah)</h2>
                {!inputProduct ? (
                  <ProductSearchInput onSelect={handleSelectInputProduct} placeholder="Cari produk input..." />
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{inputProduct.product_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{inputProduct.product_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Stok Ready</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">{inputStock !== null ? inputStock.toLocaleString('id-ID') : '—'} {inputProduct.base_unit_name ?? ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0.01" step="any" value={inputQty || ''} onChange={e => setInputQty(parseFloat(e.target.value) || 0)} placeholder="Qty"
                        className="w-24 px-3 py-2 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                      <span className="text-xs text-gray-500">{inputProduct.base_unit_name ?? ''}</span>
                    </div>
                    <button type="button" onClick={() => { setInputProduct(null); setInputQty(0); setInputStock(null) }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              {/* Outputs */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk Output ({outputs.length} item)</h2>
                <div className="mb-4">
                  <ProductSearchInput onSelect={handleAddOutput} excludeProductIds={outputs.map(o => o.product_id)} placeholder="Cari produk output..." />
                </div>
                {outputs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400"><Scissors className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Tambahkan produk hasil breakdown</p></div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                            <th className="px-4 py-3 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {outputs.map((o, idx) => (
                            <tr key={o.product_id}>
                              <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                              <td className="px-4 py-3"><span className="font-medium text-gray-900 dark:text-white">{o.product_name}</span><span className="ml-2 text-xs text-gray-400 font-mono">{o.product_code}</span></td>
                              <td className="px-4 py-3 text-right">
                                <input type="number" min="0.01" step="any" value={o.qty || ''} onChange={e => handleOutputQtyChange(idx, e.target.value)}
                                  className="w-20 px-2 py-1.5 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">{o.base_unit_name ?? '—'}</td>
                              <td className="px-4 py-3 text-center">
                                <button type="button" onClick={() => handleRemoveOutput(idx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl flex items-center justify-between text-sm">
                      <div className="flex gap-6">
                        <div><span className="text-gray-500">Input:</span> <span className="font-mono font-medium">{inputQty.toLocaleString('id-ID')}</span></div>
                        <div><span className="text-gray-500">Total Output:</span> <span className="font-mono font-medium">{totalOutputQty.toLocaleString('id-ID')}</span></div>
                      </div>
                      <div className={`font-medium ${breakdownWasteQty > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Susut: {breakdownWasteQty.toLocaleString('id-ID')} {inputProduct?.base_unit_name ?? ''}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Footer - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => navigate('/inventory/stock-adjustments')}
            className="hidden sm:inline-flex px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createAdjustment.isPending}
            className="flex items-center justify-center gap-2 min-w-38 sm:min-w-44 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/25"
          >
            {createAdjustment.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Simpan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
