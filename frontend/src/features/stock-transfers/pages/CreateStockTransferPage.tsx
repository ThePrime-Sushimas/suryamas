import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { useCreateStockTransfer } from '../api/stockTransfers.api'
import { ProductSearchInput } from '@/features/daily-prep-orders2/components/ProductSearchInput'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'

interface LineItem {
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  source_stock: number | null
  notes: string
}

export default function CreateStockTransferPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createTransfer = useCreateStockTransfer()
  const { branches } = useBranchContextStore()

  const todayStr = new Date().toISOString().slice(0, 10)

  // Header state
  const [transferType, setTransferType] = useState<'TRANSFER' | 'LOAN'>('TRANSFER')
  const [sourceBranchId, setSourceBranchId] = useState(branches[0]?.branch_id ?? '')
  const [targetBranchId, setTargetBranchId] = useState('')
  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [transferDate, setTransferDate] = useState(todayStr)
  const [notes, setNotes] = useState('')

  // Lines state
  const [lines, setLines] = useState<LineItem[]>([])

  // Warehouse queries — only MAIN, CENTRAL_STOCK, CENTRAL_KITCHEN (exclude READY)
  const { data: sourceWarehousesData } = useWarehouses({ limit: 50, branch_id: sourceBranchId || undefined, warehouse_type: 'MAIN' })
  const { data: targetWarehousesData } = useWarehouses({ limit: 50, branch_id: targetBranchId || undefined, warehouse_type: 'MAIN' })
  const sourceWarehouses = sourceWarehousesData?.data ?? []
  const targetWarehouses = targetWarehousesData?.data ?? []

  const handleSourceBranchChange = (val: string) => {
    setSourceBranchId(val)
    setSourceWarehouseId('')
  }

  const handleTargetBranchChange = (val: string) => {
    setTargetBranchId(val)
    setTargetWarehouseId('')
  }

  const handleAddProduct = (product: { id: string; product_code: string; product_name: string; station: string | null; base_unit_name: string | null }) => {
    const newLine: LineItem = {
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      base_unit_name: product.base_unit_name,
      qty: 1,
      source_stock: null,
      notes: '',
    }
    setLines(prev => [...prev, newLine])
    fetchStockForProduct(product.id)
  }

  const linesRef = useRef(lines)
  linesRef.current = lines

  const fetchStockForProduct = async (productId: string) => {
    if (!sourceWarehouseId) return
    try {
      const res = await api.get('/stock/balances', { params: { warehouse_id: sourceWarehouseId, product_id: productId, limit: 1 } })
      const qty = res?.data?.data?.[0] ? Number(res.data.data[0].qty) : 0
      setLines(prev => prev.map(line =>
        line.product_id === productId ? { ...line, source_stock: qty } : line
      ))
    } catch { /* informational */ }
  }

  // Refresh stock when source warehouse changes
  useEffect(() => {
    const currentLines = linesRef.current
    if (currentLines.length === 0 || !sourceWarehouseId) return
    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          currentLines.map(async (line) => {
            const res = await api.get('/stock/balances', { params: { warehouse_id: sourceWarehouseId, product_id: line.product_id, limit: 1 } })
            return { product_id: line.product_id, source_stock: res?.data?.data?.[0] ? Number(res.data.data[0].qty) : 0 }
          })
        )
        setLines(prev => prev.map(l => {
          const stock = results.find(r => r.product_id === l.product_id)
          return stock ? { ...l, source_stock: stock.source_stock } : l
        }))
      } catch { /* informational */ }
    }
    fetchAll()
  }, [sourceWarehouseId])

  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  const handleQtyChange = (index: number, value: string) => {
    const qty = parseFloat(value) || 0
    setLines(prev => prev.map((line, i) => i === index ? { ...line, qty } : line))
  }

  const handleSubmit = async () => {
    if (!sourceWarehouseId) { toast.error('Pilih gudang sumber'); return }
    if (!targetWarehouseId) { toast.error('Pilih gudang tujuan'); return }
    if (sourceWarehouseId === targetWarehouseId) { toast.error('Gudang sumber dan tujuan tidak boleh sama'); return }
    if (!transferDate) { toast.error('Pilih tanggal transfer'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    const invalidLines = lines.filter(l => l.qty <= 0)
    if (invalidLines.length > 0) { toast.error('Semua qty harus lebih dari 0'); return }

    try {
      const result = await createTransfer.mutateAsync({
        transfer_type: transferType,
        source_warehouse_id: sourceWarehouseId,
        target_warehouse_id: targetWarehouseId,
        transfer_date: transferDate,
        notes: notes || undefined,
        lines: lines.map(l => ({ product_id: l.product_id, qty: l.qty, notes: l.notes || undefined })),
      })
      const label = transferType === 'LOAN' ? 'Loan' : 'Transfer'
      toast.success(`${label} ${result.transfer_number} berhasil dibuat`)
      navigate(`/inventory/stock-transfers/${result.id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat stock transfer'))
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-transfers')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {transferType === 'LOAN' ? 'Buat Pinjaman Barang' : 'Buat Stock Transfer'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {transferType === 'LOAN' ? 'Pinjam barang antar cabang' : 'Transfer barang antar gudang / cabang'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createTransfer.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
          >
            {createTransfer.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              : <><Plus className="w-4 h-4" /> Simpan Transfer</>
            }
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Fields */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Informasi Transfer</h2>

            {/* Transfer Type Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipe</label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer transition-all ${transferType === 'TRANSFER' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" name="transfer_type" value="TRANSFER" checked={transferType === 'TRANSFER'} onChange={() => setTransferType('TRANSFER')} className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${transferType === 'TRANSFER' ? 'border-blue-500' : 'border-gray-400'}`}>
                    {transferType === 'TRANSFER' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium">Transfer</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Kirim barang 1 arah</p>
                  </div>
                </label>
                <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer transition-all ${transferType === 'LOAN' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" name="transfer_type" value="LOAN" checked={transferType === 'LOAN'} onChange={() => setTransferType('LOAN')} className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${transferType === 'LOAN' ? 'border-purple-500' : 'border-gray-400'}`}>
                    {transferType === 'LOAN' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium">Pinjam (Loan)</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pinjam & harus dikembalikan</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {transferType === 'LOAN' ? 'Cabang Pemberi' : 'Cabang Sumber'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={sourceBranchId}
                  onChange={e => handleSourceBranchChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Pilih cabang sumber...</option>
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              {/* Target Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {transferType === 'LOAN' ? 'Cabang Peminjam' : 'Cabang Tujuan'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetBranchId}
                  onChange={e => handleTargetBranchChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Pilih cabang tujuan...</option>
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              {/* Source Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Gudang Sumber <span className="text-red-500">*</span>
                </label>
                <select
                  value={sourceWarehouseId}
                  onChange={e => setSourceWarehouseId(e.target.value)}
                  disabled={!sourceBranchId}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Pilih gudang sumber...</option>
                  {sourceWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>

              {/* Target Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Gudang Tujuan <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={e => setTargetWarehouseId(e.target.value)}
                  disabled={!targetBranchId}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Pilih gudang tujuan...</option>
                  {targetWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>

              {/* Transfer Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal Transfer <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="misal: distribusi saos mingguan"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Product Lines */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Produk ({lines.length} item)
            </h2>

            <div className="mb-4">
              <ProductSearchInput
                onSelect={handleAddProduct}
                excludeProductIds={lines.map(l => l.product_id)}
                placeholder="Cari produk untuk ditambahkan..."
              />
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada produk. Gunakan pencarian di atas untuk menambahkan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kode</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stok Sumber</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {lines.map((line, idx) => (
                      <tr key={line.product_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{line.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{line.product_code}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {line.source_stock !== null ? line.source_stock.toLocaleString('id-ID') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={line.qty || ''}
                            onChange={e => handleQtyChange(idx, e.target.value)}
                            className="w-20 px-2 py-1.5 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{line.base_unit_name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
