import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

interface Props {
  onClose: () => void
  onSubmit: (data: {
    branch_id: string
    warehouse_id: string
    opname_date: string
    scope: 'ALL_PRODUCTS' | 'BY_POSITION'
    position_id?: string
    notes?: string
  }) => void
  isLoading: boolean
}

export function CreateMonthlyOpnameDialog({ onClose, onSubmit, isLoading }: Props) {
  const { currentBranch } = useBranchContextStore()
  const [branchId, setBranchId] = useState(currentBranch?.id ?? '')
  const [warehouseId, setWarehouseId] = useState('')
  const [opnameDate, setOpnameDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
  )
  const [scope, setScope] = useState<'ALL_PRODUCTS' | 'BY_POSITION'>('ALL_PRODUCTS')
  const [positionId, setPositionId] = useState('')
  const [notes, setNotes] = useState('')

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  // Fetch warehouses for selected branch
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', branchId],
    queryFn: async () => {
      const { data } = await api.get('/warehouses', { params: { branch_id: branchId, limit: 50 } })
      return data.data as { id: string; warehouse_name: string; warehouse_type: string }[]
    },
    enabled: !!branchId,
  })
  const warehouses = warehousesData ?? []

  // Fetch positions for scope BY_POSITION
  const { data: positionsData } = useQuery({
    queryKey: ['daily-stock-opname', 'positions', branchId],
    queryFn: async () => {
      const { data } = await api.get('/daily-stock-opname/positions', { params: { branch_id: branchId } })
      return (data.data || []) as { id: string; position_code: string; position_name: string; department_name: string }[]
    },
    enabled: !!branchId && scope === 'BY_POSITION',
  })
  const positions = positionsData ?? []

  // Reset warehouse when branch changes
  useEffect(() => { setWarehouseId('') }, [branchId])

  const canSubmit = branchId && warehouseId && opnameDate && (scope === 'ALL_PRODUCTS' || positionId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      branch_id: branchId,
      warehouse_id: warehouseId,
      opname_date: opnameDate,
      scope,
      ...(scope === 'BY_POSITION' && positionId ? { position_id: positionId } : {}),
      ...(notes ? { notes } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Buat SO Bulanan</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-lg"
              required
            >
              <option value="">Pilih Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          {/* Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-lg"
              required
              disabled={!branchId}
            >
              <option value="">Pilih Warehouse</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_type})</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal SO</label>
            <input
              type="date"
              value={opnameDate}
              onChange={(e) => setOpnameDate(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-lg"
              required
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'ALL_PRODUCTS' | 'BY_POSITION')}
              className="w-full text-sm border-gray-300 rounded-lg"
            >
              <option value="ALL_PRODUCTS">Semua Produk</option>
              <option value="BY_POSITION">Per Position</option>
            </select>
          </div>

          {/* Position (conditional) */}
          {scope === 'BY_POSITION' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-lg"
                required
              >
                <option value="">Pilih Position</option>
                {positions.map(p => (
                  <option key={p.id} value={p.id}>{p.position_name} ({p.department_name})</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border-gray-300 rounded-lg"
              placeholder="Catatan tambahan..."
              maxLength={500}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Membuat...' : 'Buat SO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
