import { useState } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { useGenerateDpo } from '../api/dailyPrepOrders.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { DailyPrepOrder } from '../api/dailyPrepOrders.api'

interface Props {
  onClose: () => void
  onGenerated: (dpo: DailyPrepOrder) => void
}

export function DpoGenerateModal({ onClose, onGenerated }: Props) {
  const toast = useToast()
  const generateDpo = useGenerateDpo()
  const { branches } = useBranchContextStore()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const [branchId, setBranchId] = useState(branches[0]?.branch_id ?? '')
  const [prepDate, setPrepDate] = useState(tomorrowStr)
  const [notes, setNotes] = useState('')

  const { data: mainWarehousesData } = useWarehouses({ limit: 50, warehouse_type: 'MAIN', branch_id: branchId || undefined })
  const { data: readyWarehousesData } = useWarehouses({ limit: 50, warehouse_type: 'READY', branch_id: branchId || undefined })

  const mainWarehouses = mainWarehousesData?.data ?? []
  const readyWarehouses = readyWarehousesData?.data ?? []

  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')

  // Auto-select first warehouse when branch changes
  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId)
    setSourceWarehouseId('')
    setTargetWarehouseId('')
  }

  const handleGenerate = async () => {
    if (!branchId) { toast.error('Pilih cabang'); return }
    if (!sourceWarehouseId) { toast.error('Pilih gudang sumber (MAIN)'); return }
    if (!targetWarehouseId) { toast.error('Pilih gudang tujuan (READY)'); return }
    if (sourceWarehouseId === targetWarehouseId) { toast.error('Gudang sumber dan tujuan tidak boleh sama'); return }

    try {
      const result = await generateDpo.mutateAsync({
        branch_id: branchId,
        prep_date: prepDate,
        source_warehouse_id: sourceWarehouseId,
        target_warehouse_id: targetWarehouseId,
        notes: notes || null,
      })
      toast.success(`DPO ${result!.dpo_number} berhasil di-generate`)
      onGenerated(result!)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal generate DPO'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Generate Daily Prep Order</h2>
            <p className="text-xs text-gray-500">Hitung kebutuhan otomatis dari data POS</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Cabang */}
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

          {/* Tanggal prep */}
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
            <p className="text-xs text-gray-400 mt-1">Biasanya besok — hari yang sedang disiapkan hari ini</p>
          </div>

          {/* Gudang sumber */}
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

          {/* Gudang tujuan */}
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Catatan (opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="misal: persiapan weekend"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateDpo.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {generateDpo.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Menghitung...</>
              : <><Zap className="w-4 h-4" /> Generate</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}