import { useState } from 'react'
import { ArrowRightLeft, Plus, X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { useBranchContextStore } from '@/features/branch_context'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import {
  useTransfers,
  useCreateTransfer,
  useAssets,
  type CreateTransferDto,
} from '../api/fixed-assets.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── Branch picker hook (same company, active only) ───────────────────────────

interface BranchOption {
  id: string
  branch_name: string
  branch_code: string
  company_id: string
}

const useCompanyBranches = (companyId: string | undefined) =>
  useQuery({
    queryKey: ['branches', 'active', companyId],
    queryFn: async () => {
      const { data } = await api.get('/branches', {
        params: { limit: 100, status: 'active' },
      })
      // Filter branches to only those in same company
      return ((data.data || []) as BranchOption[]).filter(
        (b) => b.company_id === companyId
      )
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssetTransfersPage() {
  const toast = useToast()
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  const companyId = currentBranch?.company_id

  // ─── State ──────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Form state
  const [formAssetId, setFormAssetId] = useState('')
  const [formDestBranchId, setFormDestBranchId] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formTransferDate, setFormTransferDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: transfersData, isLoading: transfersLoading } = useTransfers({
    page,
    limit: 20,
  })
  const transfers = transfersData?.data ?? []
  const pagination = transfersData?.pagination

  // Active assets for the picker
  const { data: assetsData } = useAssets({
    status: 'ACTIVE',
    limit: 100,
  })
  const activeAssets = assetsData?.data ?? []

  // Branches in the same company
  const { data: companyBranches } = useCompanyBranches(companyId)
  const branches = companyBranches ?? []

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createTransferMutation = useCreateTransfer()

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormAssetId('')
    setFormDestBranchId('')
    setFormReason('')
    setFormTransferDate(new Date().toISOString().split('T')[0])
  }

  const openCreate = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!formAssetId) {
      toast.error('Pilih aset yang akan ditransfer')
      return
    }
    if (!formDestBranchId) {
      toast.error('Pilih cabang tujuan')
      return
    }

    const body: CreateTransferDto = {
      fixed_asset_id: formAssetId,
      destination_branch_id: formDestBranchId,
      transfer_date: formTransferDate || undefined,
      reason: formReason || undefined,
    }

    try {
      await createTransferMutation.mutateAsync(body)
      toast.success('Transfer aset berhasil')
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal transfer aset'))
    }
  }

  // Get the selected asset's branch to exclude from destination picker
  const selectedAsset = activeAssets.find((a) => a.id === formAssetId)
  const destinationBranches = branches.filter(
    (b) => b.id !== selectedAsset?.branch_id
  )

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              <ArrowRightLeft className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Transfer Aset
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Transfer aset antar cabang dalam perusahaan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Transfer Baru
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
          {transfersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Belum ada riwayat transfer aset.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Tanggal
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Kode Aset
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Nama Aset
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Cabang Asal
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Cabang Tujuan
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Alasan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {transfers.map((transfer) => (
                      <tr
                        key={transfer.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {fmtDate(transfer.transfer_date)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                          {transfer.asset_code ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {transfer.asset_name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {transfer.source_branch_name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {transfer.destination_branch_name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                          {transfer.reason ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination pagination={pagination} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Create Transfer Modal ──────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Transfer Aset Baru
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Asset select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Aset <span className="text-red-500">*</span>
                </label>
                <select
                  value={formAssetId}
                  onChange={(e) => {
                    setFormAssetId(e.target.value)
                    setFormDestBranchId('')
                  }}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Pilih aset...</option>
                  {activeAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_code} - {asset.asset_name}
                      {asset.branch_name ? ` (${asset.branch_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cabang Tujuan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formDestBranchId}
                  onChange={(e) => setFormDestBranchId(e.target.value)}
                  disabled={!formAssetId}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih cabang tujuan...</option>
                  {destinationBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_code} - {branch.branch_name}
                    </option>
                  ))}
                </select>
                {formAssetId && destinationBranches.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Tidak ada cabang tujuan yang tersedia.
                  </p>
                )}
              </div>

              {/* Transfer date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Transfer
                </label>
                <input
                  type="date"
                  value={formTransferDate}
                  onChange={(e) => setFormTransferDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alasan Transfer
                </label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  rows={3}
                  placeholder="Opsional - alasan transfer aset"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  !formAssetId ||
                  !formDestBranchId ||
                  createTransferMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTransferMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
