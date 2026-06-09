import { useState } from 'react'
import { PackagePlus, Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useWarehouses, useBulkOpeningBalance } from '../api/inventory.api'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'

interface LineItem {
  id: string
  product_id: string
  product_name: string
  qty: number
  cost_per_unit: number
}

export default function OpeningBalancePage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [warehouseId, setWarehouseId] = useState('')
  const [notes, setNotes] = useState('')
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<LineItem[]>([])
  const [showProductPicker, setShowProductPicker] = useState(false)

  const { data: warehousesData } = useWarehouses({ limit: 50 })
  const warehouses = warehousesData?.data ?? []

  // Get branch_id from selected warehouse for stock display
  const selectedWarehouse = warehouses.find(w => w.id === warehouseId)
  const branchId = selectedWarehouse?.branch_id ?? ''

  const bulkOpening = useBulkOpeningBalance()

  const addLine = (product: { id: string; name: string; average_cost: number }) => {
    if (lines.some(l => l.product_id === product.id)) {
      toast.error('Produk sudah ada di daftar')
      return
    }
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      qty: 0,
      cost_per_unit: product.average_cost,
    }])
  }

  const updateLine = (id: string, field: 'qty' | 'cost_per_unit', value: number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const handleSubmit = async () => {
    if (!warehouseId) { toast.error('Pilih gudang terlebih dahulu'); return }
    if (!movementDate) { toast.error('Pilih tanggal terlebih dahulu'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    const invalidLines = lines.filter(l => l.qty <= 0)
    if (invalidLines.length > 0) { toast.error('Semua qty harus lebih dari 0'); return }

    try {
      const result = await bulkOpening.mutateAsync({
        warehouse_id: warehouseId,
        items: lines.map(l => ({ product_id: l.product_id, qty: l.qty, cost_per_unit: l.cost_per_unit })),
        notes: notes || undefined,
        movement_date: movementDate,
      })
      toast.success(`Saldo awal berhasil: ${result.success} item, ${result.skipped} dilewati`)
      navigate('/inventory/stock')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan saldo awal'))
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/stock')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <PackagePlus className="w-6 h-6 text-emerald-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Saldo Awal Stok</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Input saldo awal per gudang untuk setup pertama kali</p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={bulkOpening.isPending || lines.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {bulkOpening.isPending ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>
      </div>

      {/* Warehouse + Notes */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gudang *</label>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Pilih Gudang</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name} ({w.branch_name})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal *</label>
            <input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Add Product Button */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <button onClick={() => setShowProductPicker(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      {/* Lines Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost/Unit (Rp)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Value</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {lines.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Belum ada produk. Klik "Tambah Produk" di atas.</td></tr>
              ) : lines.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{l.product_name}</td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" value={l.qty || ''} onChange={e => updateLine(l.id, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" value={l.cost_per_unit || ''} onChange={e => updateLine(l.id, 'cost_per_unit', parseFloat(e.target.value) || 0)}
                      className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm" />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(l.qty * l.cost_per_unit)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeLine(l.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lines.length} item</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(lines.reduce((s, l) => s + l.qty, 0))}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(lines.reduce((s, l) => s + l.qty * l.cost_per_unit, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Product Picker Modal */}
      <ProductPickerModal
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={(product) => { addLine(product) }}
        branchId={branchId}
        showStock={!!branchId}
        excludeProductIds={lines.map(l => l.product_id)}
      />
    </div>
  )
}
