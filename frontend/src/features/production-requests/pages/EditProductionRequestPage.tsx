import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, Trash2, Plus, Package } from 'lucide-react'
import { useProductionRequest, useUpdateProductionRequest } from '../api/productionRequests.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { WipSaucePickerModal } from '../components/WipSaucePickerModal'

interface LineItem {
  wip_id: string
  wip_code: string
  wip_name: string
  yield_qty: number
  uom: string
  qty_batch: number
  notes: string
}

export default function EditProductionRequestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { branches } = useBranchContextStore()
  const { data: request, isLoading: loadingRequest } = useProductionRequest(id ?? '')
  const updateRequest = useUpdateProductionRequest()

  const [fulfillingBranchId, setFulfillingBranchId] = useState('')
  const [requestDate, setRequestDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [showWipModal, setShowWipModal] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Fetch FINISHED_GOODS warehouses
  const { data: fgWarehousesData } = useWarehouses({ limit: 200, warehouse_type: 'FINISHED_GOODS' })
  const fgWarehouses = fgWarehousesData?.data ?? []

  const fulfillingBranches = useMemo(() => {
    const branchIdsWithFG = new Set(fgWarehouses.map(w => w.branch_id))
    return branches.filter(b => branchIdsWithFG.has(b.branch_id) && b.branch_id !== request?.requesting_branch_id)
  }, [branches, fgWarehouses, request?.requesting_branch_id])

  // Initialize form
  useEffect(() => {
    if (request && !initialized) {
      setFulfillingBranchId(request.fulfilling_branch_id)
      setRequestDate(request.request_date)
      setNotes(request.notes ?? '')
      setLines(
        request.lines?.map(l => ({
          wip_id: l.wip_id,
          wip_code: l.wip_code,
          wip_name: l.wip_name,
          yield_qty: l.yield_qty,
          uom: l.uom,
          qty_batch: l.qty_batch,
          notes: l.notes ?? '',
        })) ?? []
      )
      setInitialized(true)
    }
  }, [request, initialized])

  const handleAddWip = (wip: { id: string; wip_code: string; wip_name: string; yield_qty: number; uom: string }) => {
    if (lines.some(l => l.wip_id === wip.id)) return
    setLines(prev => [...prev, {
      wip_id: wip.id,
      wip_code: wip.wip_code,
      wip_name: wip.wip_name,
      yield_qty: wip.yield_qty,
      uom: wip.uom,
      qty_batch: 1,
      notes: '',
    }])
  }

  const removeLine = (index: number) => setLines(prev => prev.filter((_, i) => i !== index))
  const updateLine = (index: number, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line))
  }

  const handleSubmit = async () => {
    if (!fulfillingBranchId) { toast.error('Pilih central/pabrik'); return }
    if (!requestDate) { toast.error('Pilih tanggal request'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 WIP'); return }
    if (lines.some(l => l.qty_batch <= 0)) { toast.error('Semua jumlah batch harus lebih dari 0'); return }

    try {
      await updateRequest.mutateAsync({
        id: id!,
        fulfilling_branch_id: fulfillingBranchId,
        request_date: requestDate,
        notes: notes || null,
        lines: lines.map(l => ({ wip_id: l.wip_id, qty_batch: l.qty_batch, notes: l.notes || null })),
      })
      toast.success('Request berhasil diupdate')
      navigate(`/food-production/production-requests/${id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal mengupdate request'))
    }
  }

  if (loadingRequest) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
  if (!request) return <div className="flex items-center justify-center h-48 text-gray-400">Request tidak ditemukan</div>
  if (request.status !== 'DRAFT') {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p>Request ini sudah tidak bisa diedit (status: {request.status})</p>
        <button onClick={() => navigate(`/food-production/production-requests/${id}`)} className="mt-3 text-blue-500 underline text-sm">Kembali</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Topbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/food-production/production-requests/${id}`)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Edit {request.request_number}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ubah detail request produksi</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cabang Peminta</label>
            <input type="text" value={request.requesting_branch_name} disabled
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-500" />
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

      {/* Add button */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <button onClick={() => setShowWipModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Tambah WIP
        </button>
      </div>

      {/* Lines */}
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          {lines.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Belum ada item.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">WIP</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Hasil/Batch</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">Total Hasil</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catatan</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {lines.map((line, idx) => (
                  <tr key={line.wip_id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{line.wip_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{line.wip_code}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="1" step="1" value={line.qty_batch || ''}
                        onChange={e => updateLine(idx, 'qty_batch', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:border-blue-500" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{line.yield_qty} {line.uom}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {(line.qty_batch * line.yield_qty).toFixed(1)} {line.uom}
                    </td>
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
            <button onClick={() => navigate(`/food-production/production-requests/${id}`)} className="px-4 py-2.5 text-sm text-gray-600">Batal</button>
            <button onClick={handleSubmit} disabled={updateRequest.isPending || lines.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {updateRequest.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Simpan</>}
            </button>
          </div>
        </div>
      </div>

      {/* WIP Picker Modal */}
      <WipSaucePickerModal open={showWipModal} onClose={() => setShowWipModal(false)} onSelect={handleAddWip} excludeWipIds={lines.map(l => l.wip_id)} />
    </div>
  )
}
