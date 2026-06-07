import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Loader2, Package } from 'lucide-react'
import { useCreateProductionRequest } from '../api/productionRequests.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { WipSaucePickerModal } from '../components/WipSaucePickerModal'

interface LineItem {
  product_id: string
  product_code: string
  product_name: string
  qty: number
  uom: string
  notes: string
}

export default function CreateProductionRequestPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createRequest = useCreateProductionRequest()
  const { branches } = useBranchContextStore()

  const todayStr = new Date().toISOString().slice(0, 10)

  const [requestingBranchId, setRequestingBranchId] = useState(branches[0]?.branch_id ?? '')
  const [fulfillingBranchId, setFulfillingBranchId] = useState('')
  const [requestDate, setRequestDate] = useState(todayStr)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [showProductModal, setShowProductModal] = useState(false)

  const { data: fgWarehousesData } = useWarehouses({ limit: 200, warehouse_type: 'FINISHED_GOODS' })
  const fgWarehouses = fgWarehousesData?.data ?? []

  const fulfillingBranches = useMemo(() => {
    const branchIdsWithFG = new Set(fgWarehouses.map(w => w.branch_id))
    return branches.filter(b => branchIdsWithFG.has(b.branch_id) && b.branch_id !== requestingBranchId)
  }, [branches, fgWarehouses, requestingBranchId])

  const handleAddProduct = (product: { id: string; product_code: string; product_name: string; transfer_unit: string }) => {
    if (lines.some(l => l.product_id === product.id)) return
    setLines(prev => [...prev, {
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      qty: 1,
      uom: product.transfer_unit,
      notes: '',
    }])
  }

  const removeLine = (index: number) => setLines(prev => prev.filter((_, i) => i !== index))
  const updateLine = (index: number, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line))
  }

  const handleSubmit = async () => {
    if (!requestingBranchId) { toast.error('Pilih cabang peminta'); return }
    if (!fulfillingBranchId) { toast.error('Pilih central/pabrik'); return }
    if (requestingBranchId === fulfillingBranchId) { toast.error('Cabang peminta dan central tidak boleh sama'); return }
    if (!requestDate) { toast.error('Pilih tanggal request'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    if (lines.some(l => l.qty <= 0)) { toast.error('Semua qty harus lebih dari 0'); return }

    try {
      const result = await createRequest.mutateAsync({
        requesting_branch_id: requestingBranchId,
        fulfilling_branch_id: fulfillingBranchId,
        request_date: requestDate,
        notes: notes || null,
        lines: lines.map(l => ({ product_id: l.product_id, qty: l.qty, uom: l.uom, notes: l.notes || null })),
      })
      toast.success(`Request ${result.request_number} berhasil dibuat`)
      navigate(`/food-production/production-requests/${result.id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat request'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Topbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/food-production/production-requests')}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Buat Request Produksi</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Request pembuatan produk ke central</p>
          </div>
        </div>
      </div>

      {/* Form Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cabang Peminta *</label>
            <select value={requestingBranchId} onChange={e => setRequestingBranchId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500">
              <option value="">Pilih cabang...</option>
              {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Central / Pabrik *</label>
            <select value={fulfillingBranchId} onChange={e => setFulfillingBranchId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500">
              <option value="">Pilih central...</option>
              {fulfillingBranches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Request *</label>
            <input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Catatan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="opsional"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Add Product */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <button onClick={() => setShowProductModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      {/* Lines */}
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          {lines.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Belum ada item. Klik "Tambah Produk" untuk memilih.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">Satuan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catatan</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {lines.map((line, idx) => (
                  <tr key={line.product_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{line.product_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{line.product_code}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="0.01" step="any" value={line.qty || ''}
                        onChange={e => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:border-blue-500" />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{line.uom}</td>
                    <td className="px-4 py-3">
                      <input type="text" value={line.notes} onChange={e => updateLine(idx, 'notes', e.target.value)} placeholder="opsional"
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:border-blue-500" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => removeLine(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{lines.length > 0 ? `${lines.length} item` : 'Belum ada item'}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/food-production/production-requests')} className="px-4 py-2.5 text-sm text-gray-600">Batal</button>
            <button onClick={handleSubmit} disabled={createRequest.isPending || lines.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {createRequest.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : 'Simpan Request'}
            </button>
          </div>
        </div>
      </div>

      <WipSaucePickerModal open={showProductModal} onClose={() => setShowProductModal(false)} onSelect={handleAddProduct} excludeProductIds={lines.map(l => l.product_id)} />
    </div>
  )
}
