import { useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useEmployeePositions, usePositions, useAssignPosition, useRemovePosition, useSetPrimaryPosition } from '../../settings/api/settings.api'

export function EmployeePositionsTab({ employeeId }: { employeeId: string }) {
  const toast = useToast()
  const positions = useEmployeePositions(employeeId)
  const allPositions = usePositions()
  const assignPos = useAssignPosition()
  const removePos = useRemovePosition()
  const setPrimary = useSetPrimaryPosition()

  const [showAdd, setShowAdd] = useState(false)
  const [selectedPositionId, setSelectedPositionId] = useState('')
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  const assignedIds = new Set((positions.data || []).map(p => p.position_id))
  const availablePositions = (allPositions.data || []).filter(p => !assignedIds.has(p.id))

  const handleAssign = async () => {
    if (!selectedPositionId) return
    try {
      const isFirst = positions.isSuccess && (positions.data || []).length === 0
      await assignPos.mutateAsync({ employeeId, position_id: selectedPositionId, is_primary: isFirst })
      toast.success('Position ditambahkan')
      setShowAdd(false); setSelectedPositionId('')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menambah position')) }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    try {
      await removePos.mutateAsync({ employeeId, positionId: removeTarget.id })
      toast.success('Position dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus position')) }
    finally { setRemoveTarget(null) }
  }

  const handleSetPrimary = async (positionId: string) => {
    try {
      await setPrimary.mutateAsync({ employeeId, positionId })
      toast.success('Primary position diubah')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal set primary')) }
  }

  const data = positions.data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Posisi Karyawan</h3>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          <Plus className="w-3 h-3" /> Tambah Posisi
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <select value={selectedPositionId} onChange={e => setSelectedPositionId(e.target.value)}
            className="flex-1 h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Pilih posisi...</option>
            {availablePositions.map(p => (
              <option key={p.id} value={p.id}>{p.position_name} ({p.department_name})</option>
            ))}
          </select>
          <button onClick={handleAssign} disabled={!selectedPositionId || assignPos.isPending}
            className="px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            Tambah
          </button>
          <button onClick={() => { setShowAdd(false); setSelectedPositionId('') }}
            className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg">
            Batal
          </button>
        </div>
      )}

      {/* Position List */}
      {positions.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Belum ada posisi yang di-assign</p>
      ) : (
        <div className="space-y-2">
          {data.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                {p.is_primary && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{p.position_name}</p>
                  <p className="text-xs text-gray-400">{p.department_name}</p>
                </div>
                {p.is_primary && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">PRIMARY</span>}
              </div>
              <div className="flex items-center gap-1">
                {!p.is_primary && (
                  <button onClick={() => handleSetPrimary(p.position_id)}
                    className="px-2 py-1 text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded">
                    Set Primary
                  </button>
                )}
                <button onClick={() => setRemoveTarget({ id: p.position_id, name: p.position_name })}
                  className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={handleRemove}
        title="Hapus Position" message={`Hapus posisi "${removeTarget?.name}" dari karyawan ini?`}
        confirmText="Hapus" variant="danger" />
    </div>
  )
}
