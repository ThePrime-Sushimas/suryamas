import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { useCreateManualDpo } from '../api/dailyPrepOrders.api'
import { ProductSearchInput } from '../components/ProductSearchInput'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { usePositions } from '@/features/settings/api/settings.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'

interface LineItem {
  product_id: string
  product_code: string
  product_name: string
  station: string | null
  base_unit_name: string | null
  qty: number
  main_stock: number | null
  ready_stock: number | null
}

export default function CreateManualDpoPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createManualDpo = useCreateManualDpo()
  const { branches } = useBranchContextStore()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  // Header state
  const [branchId, setBranchId] = useState(branches[0]?.branch_id ?? '')
  const [prepDate, setPrepDate] = useState(tomorrowStr)
  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [notes, setNotes] = useState('')
  const [stationCodes, setStationCodes] = useState<string[]>([])

  // Lines state
  const [lines, setLines] = useState<LineItem[]>([])

  // Warehouse queries
  const { data: mainWarehousesData } = useWarehouses({ limit: 50, warehouse_type: 'MAIN', branch_id: branchId || undefined })
  const { data: readyWarehousesData } = useWarehouses({ limit: 50, warehouse_type: 'READY', branch_id: branchId || undefined })
  const mainWarehouses = mainWarehousesData?.data ?? []
  const readyWarehouses = readyWarehousesData?.data ?? []

  // Positions for station filter
  const { data: positionsData } = usePositions()
  const activePositions = (positionsData ?? []).filter((p: { is_active: boolean }) => p.is_active)

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId)
    setSourceWarehouseId('')
    setTargetWarehouseId('')
  }

  const handleAddProduct = (product: { id: string; product_code: string; product_name: string; station: string | null; base_unit_name: string | null }) => {
    const newLine: LineItem = {
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      station: product.station,
      base_unit_name: product.base_unit_name,
      qty: 1,
      main_stock: null,
      ready_stock: null,
    }
    setLines(prev => [...prev, newLine])
    // Fetch stock for this product after adding
    fetchStockForProduct(product.id)
  }

  // Stable ref for lines to avoid stale closures
  const linesRef = useRef(lines)
  linesRef.current = lines

  // Fetch stock for a single product (parallel source + target)
  const fetchStockForProduct = async (productId: string) => {
    if (!sourceWarehouseId && !targetWarehouseId) return
    try {
      const [mainRes, readyRes] = await Promise.all([
        sourceWarehouseId
          ? api.get('/stock/balances', { params: { warehouse_id: sourceWarehouseId, product_id: productId, limit: 1 } })
          : Promise.resolve(null),
        targetWarehouseId
          ? api.get('/stock/balances', { params: { warehouse_id: targetWarehouseId, product_id: productId, limit: 1 } })
          : Promise.resolve(null),
      ])
      const mainQty = mainRes?.data?.data?.[0] ? Number(mainRes.data.data[0].qty) : 0
      const readyQty = readyRes?.data?.data?.[0] ? Number(readyRes.data.data[0].qty) : 0
      const unitName = mainRes?.data?.data?.[0]?.base_unit_name || readyRes?.data?.data?.[0]?.base_unit_name || null

      setLines(prev => prev.map(line =>
        line.product_id === productId
          ? { ...line, main_stock: mainQty, ready_stock: readyQty, ...(unitName ? { base_unit_name: unitName } : {}) }
          : line
      ))
    } catch {
      // silently fail — stock display is informational
    }
  }

  // Refresh stock for all lines in parallel when warehouses change
  useEffect(() => {
    const currentLines = linesRef.current
    if (currentLines.length === 0 || (!sourceWarehouseId && !targetWarehouseId)) return

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          currentLines.map(async (line) => {
            const [mainRes, readyRes] = await Promise.all([
              sourceWarehouseId
                ? api.get('/stock/balances', { params: { warehouse_id: sourceWarehouseId, product_id: line.product_id, limit: 1 } })
                : Promise.resolve(null),
              targetWarehouseId
                ? api.get('/stock/balances', { params: { warehouse_id: targetWarehouseId, product_id: line.product_id, limit: 1 } })
                : Promise.resolve(null),
            ])
            return {
              product_id: line.product_id,
              main_stock: mainRes?.data?.data?.[0] ? Number(mainRes.data.data[0].qty) : 0,
              ready_stock: readyRes?.data?.data?.[0] ? Number(readyRes.data.data[0].qty) : 0,
            }
          })
        )
        setLines(prev => prev.map(l => {
          const stock = results.find(r => r.product_id === l.product_id)
          return stock ? { ...l, main_stock: stock.main_stock, ready_stock: stock.ready_stock } : l
        }))
      } catch {
        // silently fail
      }
    }
    fetchAll()
  }, [sourceWarehouseId, targetWarehouseId])

  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  const handleQtyChange = (index: number, value: string) => {
    const qty = parseFloat(value) || 0
    setLines(prev => prev.map((line, i) => i === index ? { ...line, qty } : line))
  }

  const handleSubmit = async () => {
    // Validation
    if (!branchId) { toast.error('Pilih cabang'); return }
    if (!prepDate) { toast.error('Pilih tanggal operasional'); return }
    if (!sourceWarehouseId) { toast.error('Pilih gudang sumber (MAIN)'); return }
    if (!targetWarehouseId) { toast.error('Pilih gudang tujuan (READY)'); return }
    if (sourceWarehouseId === targetWarehouseId) { toast.error('Gudang sumber dan tujuan tidak boleh sama'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }

    const invalidLines = lines.filter(l => l.qty <= 0)
    if (invalidLines.length > 0) { toast.error('Semua qty harus lebih dari 0'); return }

    try {
      const result = await createManualDpo.mutateAsync({
        branch_id: branchId,
        prep_date: prepDate,
        source_warehouse_id: sourceWarehouseId,
        target_warehouse_id: targetWarehouseId,
        station_codes: stationCodes.length > 0 ? stationCodes : undefined,
        notes: notes || null,
        lines: lines.map(l => ({ product_id: l.product_id, qty: l.qty })),
      })
      toast.success(`Manual DPO ${result.dpo_number} berhasil dibuat`)
      navigate(`/inventory/daily-prep-orders/${result.id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat Manual DPO'))
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
              onClick={() => navigate('/inventory/daily-prep-orders')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Buat Manual DPO
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Transfer stok tanpa perhitungan forecast
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createManualDpo.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
          >
            {createManualDpo.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              : <><Plus className="w-4 h-4" /> Simpan DPO</>
            }
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Fields */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Informasi DPO</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Cabang <span className="text-red-500">*</span>
                </label>
                <select
                  value={branchId}
                  onChange={e => handleBranchChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Pilih cabang...</option>
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              {/* Prep Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal Operasional <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={prepDate}
                  onChange={e => setPrepDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Source Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Gudang Sumber (MAIN) <span className="text-red-500">*</span>
                </label>
                <select
                  value={sourceWarehouseId}
                  onChange={e => setSourceWarehouseId(e.target.value)}
                  disabled={!branchId}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Pilih gudang MAIN...</option>
                  {mainWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>

              {/* Target Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Gudang Tujuan (READY) <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={e => setTargetWarehouseId(e.target.value)}
                  disabled={!branchId}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Pilih gudang READY...</option>
                  {readyWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>

              {/* Notes - full width */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Catatan (opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="misal: persiapan event weekend"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Product Lines */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Produk ({lines.length} item)
            </h2>

            {/* Station filter + Product search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <ProductSearchInput
                  onSelect={handleAddProduct}
                  excludeProductIds={lines.map(l => l.product_id)}
                  stationFilter={stationCodes.length > 0 ? stationCodes : undefined}
                  placeholder="Cari produk untuk ditambahkan..."
                />
              </div>
              <div className="sm:w-48">
                <select
                  value={stationCodes.length === 1 ? stationCodes[0] : ''}
                  onChange={e => setStationCodes(e.target.value ? [e.target.value] : [])}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Semua Station</option>
                  {activePositions.map((pos: { id: string; position_code: string; position_name: string }) => (
                    <option key={pos.id} value={pos.position_code}>{pos.position_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lines table */}
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Station</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stok MAIN</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stok READY</th>
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
                        <td className="px-4 py-3 text-xs text-gray-500">{line.station || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {line.main_stock !== null ? line.main_stock.toLocaleString('id-ID') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {line.ready_stock !== null ? line.ready_stock.toLocaleString('id-ID') : '—'}
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
