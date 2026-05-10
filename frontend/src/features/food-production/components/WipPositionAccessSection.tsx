import { useState, useEffect } from 'react'
import { Shield, Plus, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePositions } from '../../settings/api/settings.api'
import api from '@/lib/axios'

interface WipPositionAccess {
  position_id: string
  position_code: string
  position_name: string
  department_name: string
}

export function WipPositionAccessSection({ wipId }: { wipId: string }) {
  const toast = useToast()
  const qc = useQueryClient()
  const allPositions = usePositions()

  const access = useQuery({
    queryKey: ['wip-position-access', wipId],
    queryFn: async () => {
      const { data } = await api.get(`/wip-items/${wipId}/position-access`)
      return (data.data || []) as WipPositionAccess[]
    },
    enabled: !!wipId,
  })

  const saveAccess = useMutation({
    mutationFn: async (positionIds: string[]) => {
      await api.put(`/wip-items/${wipId}/position-access`, { position_ids: positionIds })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wip-position-access', wipId] }) },
  })

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addId, setAddId] = useState('')

  // Reset when wipId changes
  useEffect(() => {
    setSelectedIds([])
    setDirty(false)
  }, [wipId])

  // Sync from server
  useEffect(() => {
    if (access.data) {
      setSelectedIds(access.data.map(a => a.position_id))
      setDirty(false)
    }
  }, [access.data])

  const assignedSet = new Set(selectedIds)
  const availablePositions = (allPositions.data || []).filter(p => !assignedSet.has(p.id))

  const handleAdd = () => {
    if (!addId) return
    setSelectedIds([...selectedIds, addId])
    setDirty(true)
    setAddId('')
    setShowAdd(false)
  }

  const handleRemove = (posId: string) => {
    setSelectedIds(selectedIds.filter(id => id !== posId))
    setDirty(true)
  }

  const handleSave = async () => {
    try {
      await saveAccess.mutateAsync(selectedIds)
      toast.success('Akses posisi disimpan')
      setDirty(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan akses posisi')) }
  }

  const positionMap = new Map((allPositions.data || []).map(p => [p.id, p]))

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Akses Posisi</h2>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={handleSave} disabled={saveAccess.isPending}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {saveAccess.isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200">
            <Plus className="w-3 h-3" /> Tambah
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400">
          {selectedIds.length === 0
            ? '⚠️ Tidak ada restriction — semua posisi bisa akses WIP ini.'
            : `Hanya ${selectedIds.length} posisi yang bisa akses WIP ini.`}
        </p>

        {/* Add dropdown */}
        {showAdd && (
          <div className="flex items-center gap-2">
            <select value={addId} onChange={e => setAddId(e.target.value)}
              className="flex-1 h-8 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Pilih posisi...</option>
              {availablePositions.map(p => (
                <option key={p.id} value={p.id}>{p.position_name} ({p.department_name})</option>
              ))}
            </select>
            <button onClick={handleAdd} disabled={!addId} className="px-2 py-1 text-xs bg-purple-600 text-white rounded disabled:opacity-50">✓</button>
            <button onClick={() => { setShowAdd(false); setAddId('') }} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded">✕</button>
          </div>
        )}

        {/* Position badges */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map(posId => {
              const pos = positionMap.get(posId)
              return (
                <span key={posId} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg">
                  {pos?.position_name || posId}
                  <button onClick={() => handleRemove(posId)} className="text-purple-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
