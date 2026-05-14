import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useWipItems, useCreateProductionOrder } from '../api/food-production.api'
import { useUserBranches } from '@/hooks/_shared/useUserBranches'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)
const today = () => new Date().toISOString().slice(0, 10)

interface LineInput {
  wip_id: string
  planned_batch_qty: number
}

export default function ProductionOrderForm() {
  const navigate = useNavigate()
  const toast = useToast()

  const availableBranches = useUserBranches()
  const wipItems = useWipItems({ limit: 500, filter_by_position: true })
  const createOrder = useCreateProductionOrder()

  const [branchId, setBranchId] = useState('')
  const [productionDate, setProductionDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineInput[]>([{ wip_id: '', planned_batch_qty: 1 }])

  const wipList = wipItems.data?.data || []
  const wipMap = new Map(wipList.map(w => [w.id, w]))

  const addLine = () => setLines([...lines, { wip_id: '', planned_batch_qty: 1 }])
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx))

  const totalEstCost = lines.reduce((sum, l) => {
    const wip = wipMap.get(l.wip_id)
    return sum + (wip ? wip.estimated_cost * l.planned_batch_qty : 0)
  }, 0)

  const handleSubmit = async () => {
    if (!branchId) { toast.warning('Pilih cabang'); return }
    const validLines = lines.filter(l => l.wip_id && l.planned_batch_qty > 0)
    if (validLines.length === 0) { toast.warning('Tambah minimal 1 WIP'); return }

    try {
      const order = await createOrder.mutateAsync({
        branch_id: branchId,
        production_date: productionDate,
        notes: notes || undefined,
        lines: validLines,
      })
      toast.success('Production order dibuat')
      navigate(`/food-production/production/${order.id}`)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat order'))
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/food-production/production')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Buat Production Order</h1>
          <p className="text-xs text-gray-400">Catat produksi WIP harian</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cabang *</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Pilih cabang...</option>
              {availableBranches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Produksi *</label>
            <input type="date" value={productionDate} onChange={e => setProductionDate(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Catatan (opsional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="cth: Produksi pagi shift 1"
            className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* WIP Lines */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">WIP yang Diproduksi</h2>
          <button onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200">
            <Plus className="w-3 h-3" /> Tambah WIP
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[45%]">WIP</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Batch</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Yield/Batch</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {lines.map((line, idx) => {
                const wip = wipMap.get(line.wip_id)
                const hasIngredients = wip ? (wip.estimated_cost > 0) : true
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <select value={line.wip_id} onChange={e => { const updated = [...lines]; updated[idx] = { ...updated[idx], wip_id: e.target.value }; setLines(updated) }}
                        className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="">Pilih WIP...</option>
                        {wipList.map(w => <option key={w.id} value={w.id}>{w.wip_code} — {w.wip_name}</option>)}
                      </select>
                      {wip && !hasIngredients && (
                        <p className="flex items-center gap-1 mt-1 text-[10px] text-amber-600"><AlertTriangle className="w-3 h-3" /> Belum ada bahan baku</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={line.planned_batch_qty || ''} min={1} step={1}
                        onChange={e => { const updated = [...lines]; updated[idx] = { ...updated[idx], planned_batch_qty: Number(e.target.value) }; setLines(updated) }}
                        className="w-full h-8 px-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs font-mono">
                      {wip ? `${fmt(wip.yield_qty)} ${wip.uom}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {wip ? `Rp ${fmt(wip.estimated_cost * line.planned_batch_qty)}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(idx)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {totalEstCost > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Total Estimasi:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(totalEstCost)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button onClick={() => navigate('/food-production/production')}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg">
          Batal
        </button>
        <button onClick={handleSubmit} disabled={createOrder.isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {createOrder.isPending ? 'Membuat...' : 'Buat Order'}
        </button>
      </div>
    </div>
  )
}
