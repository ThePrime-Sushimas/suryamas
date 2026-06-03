import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2, Search, PackageOpen } from 'lucide-react'
import { useCreateStockTransfer } from '../api/stockTransfers.api'
import { useWarehouses, useStockBalances } from '@/features/inventory/api/inventory.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'

interface LineItem {
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  source_stock: number
  notes: string
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

export default function CreateStockTransferPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createTransfer = useCreateStockTransfer()
  const { branches } = useBranchContextStore()

  const todayStr = new Date().toISOString().slice(0, 10)

  const [transferType, setTransferType] = useState<'TRANSFER' | 'LOAN'>('TRANSFER')
  const [sourceBranchId, setSourceBranchId] = useState(branches[0]?.branch_id ?? '')
  const [targetBranchId, setTargetBranchId] = useState('')
  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [transferDate, setTransferDate] = useState(todayStr)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [stockSearch, setStockSearch] = useState('')

  const { data: sourceMainData } = useWarehouses({ limit: 50, branch_id: sourceBranchId || undefined, warehouse_type: 'MAIN' })
  const { data: sourceFgData } = useWarehouses({ limit: 50, branch_id: sourceBranchId || undefined, warehouse_type: 'FINISHED_GOODS' })
  const { data: targetMainData } = useWarehouses({ limit: 50, branch_id: targetBranchId || undefined, warehouse_type: 'MAIN' })
  const { data: targetReadyData } = useWarehouses({ limit: 50, branch_id: targetBranchId || undefined, warehouse_type: 'READY' })
  const sourceWarehouses = [...(sourceMainData?.data ?? []), ...(sourceFgData?.data ?? [])]
  const targetWarehouses = [...(targetMainData?.data ?? []), ...(targetReadyData?.data ?? [])]

  const { data: stockBalancesData, isLoading: stockLoading } = useStockBalances({
    warehouse_id: sourceWarehouseId || undefined,
    has_stock: 'true',
    limit: 500,
  })
  const stockBalances = stockBalancesData?.data ?? []

  const filteredStock = useMemo(() => {
    if (!stockSearch.trim()) return stockBalances
    const q = stockSearch.toLowerCase()
    return stockBalances.filter(s => s.product_name.toLowerCase().includes(q) || s.product_code.toLowerCase().includes(q))
  }, [stockBalances, stockSearch])

  const selectedIds = new Set(lines.map(l => l.product_id))

  const handleSourceBranchChange = (val: string) => { setSourceBranchId(val); setSourceWarehouseId(''); setLines([]) }
  const handleTargetBranchChange = (val: string) => { setTargetBranchId(val); setTargetWarehouseId('') }
  const handleSourceWarehouseChange = (val: string) => { setSourceWarehouseId(val); setLines([]); setStockSearch('') }

  const handleToggleProduct = (stock: typeof stockBalances[0]) => {
    if (selectedIds.has(stock.product_id)) {
      setLines(prev => prev.filter(l => l.product_id !== stock.product_id))
    } else {
      setLines(prev => [...prev, {
        product_id: stock.product_id,
        product_code: stock.product_code,
        product_name: stock.product_name,
        base_unit_name: stock.base_unit_name,
        qty: 1,
        source_stock: Number(stock.qty),
        notes: '',
      }])
    }
  }

  const handleQtyChange = (index: number, value: string) => {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, qty: parseFloat(value) || 0 } : line))
  }

  const handleSubmit = async () => {
    if (!sourceWarehouseId) { toast.error('Pilih gudang sumber'); return }
    if (!targetWarehouseId) { toast.error('Pilih gudang tujuan'); return }
    if (sourceWarehouseId === targetWarehouseId) { toast.error('Gudang sumber dan tujuan tidak boleh sama'); return }
    if (!transferDate) { toast.error('Pilih tanggal transfer'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    if (lines.some(l => l.qty <= 0)) { toast.error('Semua qty harus lebih dari 0'); return }
    try {
      const result = await createTransfer.mutateAsync({
        transfer_type: transferType,
        source_warehouse_id: sourceWarehouseId,
        target_warehouse_id: targetWarehouseId,
        transfer_date: transferDate,
        notes: notes || undefined,
        lines: lines.map(l => ({ product_id: l.product_id, qty: l.qty, notes: l.notes || undefined })),
      })
      toast.success(`${transferType === 'LOAN' ? 'Loan' : 'Transfer'} ${result.transfer_number} berhasil dibuat`)
      navigate(`/inventory/stock-transfers/${result.id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat stock transfer'))
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Topbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/inventory/stock-transfers')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {transferType === 'LOAN' ? 'Buat Pinjaman Barang' : 'Buat Stock Transfer'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Transfer barang antar gudang / cabang</p>
            </div>
          </div>
          <button type="button" onClick={handleSubmit} disabled={createTransfer.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {createTransfer.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Plus className="w-4 h-4" /> Simpan Transfer</>}
          </button>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex-1 overflow-hidden flex">

        {/* Left: Form + Selected */}
        <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">

          {/* Info Transfer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Informasi Transfer</h2>

            {/* Transfer Type */}
            <div className="flex gap-3 mb-4">
              {(['TRANSFER', 'LOAN'] as const).map(type => (
                <label key={type} className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer transition-all ${transferType === type
                  ? type === 'TRANSFER' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" name="transfer_type" value={type} checked={transferType === type} onChange={() => setTransferType(type)} className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${transferType === type ? type === 'TRANSFER' ? 'border-blue-500' : 'border-purple-500' : 'border-gray-400'}`}>
                    {transferType === type && <div className={`w-2 h-2 rounded-full ${type === 'TRANSFER' ? 'bg-blue-500' : 'bg-purple-500'}`} />}
                  </div>
                  <span className="text-sm font-medium">{type === 'TRANSFER' ? 'Transfer' : 'Pinjam (Loan)'}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cabang Sumber *</label>
                <select value={sourceBranchId} onChange={e => handleSourceBranchChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500">
                  <option value="">Pilih cabang sumber...</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cabang Tujuan *</label>
                <select value={targetBranchId} onChange={e => handleTargetBranchChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500">
                  <option value="">Pilih cabang tujuan...</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Gudang Sumber *</label>
                <select value={sourceWarehouseId} onChange={e => handleSourceWarehouseChange(e.target.value)} disabled={!sourceBranchId}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50">
                  <option value="">Pilih gudang sumber...</option>
                  {sourceWarehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Gudang Tujuan *</label>
                <select value={targetWarehouseId} onChange={e => setTargetWarehouseId(e.target.value)} disabled={!targetBranchId}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50">
                  <option value="">Pilih gudang tujuan...</option>
                  {targetWarehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Transfer *</label>
                <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Catatan (opsional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="misal: distribusi saos mingguan"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {/* Selected Products */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Produk Dipilih <span className="text-gray-400 font-normal">({lines.length} item)</span>
            </h2>
            {lines.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <PackageOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{sourceWarehouseId ? 'Centang produk dari panel kanan' : 'Pilih gudang sumber dulu'}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Stok</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Qty Kirim</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Sat.</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {lines.map((line, idx) => (
                    <tr key={line.product_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{line.product_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{line.product_code}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-500">{fmt(line.source_stock)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0.01" step="any" value={line.qty || ''}
                          onChange={e => handleQtyChange(idx, e.target.value)}
                          className="w-20 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{line.base_unit_name || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" onClick={() => setLines(prev => prev.filter(l => l.product_id !== line.product_id))}
                          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Stock Picker Panel */}
        <div className="w-80 xl:w-96 border-l border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700/60">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Stok Gudang Sumber</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={stockSearch} onChange={e => setStockSearch(e.target.value)}
                placeholder="Cari produk..." disabled={!sourceWarehouseId}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm outline-none focus:border-blue-500 disabled:opacity-40" />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {!sourceWarehouseId ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                <PackageOpen className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">Pilih gudang sumber untuk melihat stok</p>
              </div>
            ) : stockLoading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat stok...
              </div>
            ) : filteredStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 p-4 text-center">
                <p className="text-xs">{stockSearch ? 'Produk tidak ditemukan' : 'Tidak ada stok di gudang ini'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredStock.map(stock => {
                  const isSelected = selectedIds.has(stock.product_id)
                  return (
                    <button key={stock.product_id} type="button" onClick={() => handleToggleProduct(stock)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{stock.product_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{stock.product_code}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-xs font-mono font-semibold ${Number(stock.qty) <= 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {fmt(Number(stock.qty))}
                        </p>
                        <p className="text-[10px] text-gray-400">{stock.base_unit_name || '—'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {stockBalances.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700/60 text-[10px] text-gray-400 text-center">
              {filteredStock.length} dari {stockBalances.length} produk · {lines.length} dipilih
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
