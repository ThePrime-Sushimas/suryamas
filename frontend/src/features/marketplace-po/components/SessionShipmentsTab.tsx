import { useState } from 'react'
import { Truck } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useShipSession } from '../api/marketplacePo.api'
import { fmtDate } from '../utils/format'
import type {
  MarketplaceCheckoutLine,
  MarketplaceShipment,
  MarketplaceSessionStatus,
} from '../types/marketplacePo.types'

export function SessionShipmentsTab({
  sessionId,
  status,
  lines,
  shipments,
}: {
  sessionId: string
  status: MarketplaceSessionStatus
  lines: MarketplaceCheckoutLine[]
  shipments: MarketplaceShipment[]
}) {
  const toast = useToast()
  const shipSession = useShipSession()
  const canAdd = status === 'ORDERED' || status === 'SHIPPED'

  const branchOptions = Array.from(
    new Map(lines.map((l) => [l.branch_id, l.branch_name ?? l.branch_id])).entries(),
  ).map(([id, name]) => ({ id, name }))

  const [branchId, setBranchId] = useState(branchOptions[0]?.id ?? '')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [courier, setCourier] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId || !trackingNumber.trim()) {
      toast.warning('Cabang dan nomor resi wajib diisi')
      return
    }
    try {
      await shipSession.mutateAsync({
        id: sessionId,
        shipments: [
          {
            branch_id: branchId,
            tracking_number: trackingNumber.trim(),
            courier: courier.trim() || null,
            shipped_at: new Date().toISOString(),
          },
        ],
      })
      toast.success('Resi berhasil disimpan & status dikirim')
      setTrackingNumber('')
      setCourier('')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan resi'))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Resi Terdaftar</h3>
        {shipments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Belum ada resi untuk session ini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shipments.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <p className="font-medium text-gray-900 dark:text-white">{s.branch_name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {s.courier ?? 'Kurir'} · <span className="font-mono">{s.tracking_number}</span>
                </p>
                {s.shipped_at && (
                  <p className="text-xs text-gray-400 mt-1">Dikirim: {fmtDate(s.shipped_at)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canAdd && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-900/10 space-y-3"
        >
          <h3 className="text-sm font-semibold text-teal-800 dark:text-teal-300">Tambah Resi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cabang *</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kurir</label>
              <input
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="JNE, SiCepat, AnterAja..."
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nomor Resi *</label>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Nomor tracking"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={shipSession.isPending}
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {shipSession.isPending ? 'Menyimpan...' : 'Simpan & Tandai Dikirim'}
          </button>
        </form>
      )}
    </div>
  )
}
