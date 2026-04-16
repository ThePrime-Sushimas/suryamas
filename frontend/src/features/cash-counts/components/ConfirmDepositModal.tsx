import { useState } from 'react'
import { X, Loader2, Upload, CheckCircle, Image } from 'lucide-react'
import type { CashDeposit } from '../types'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  deposit: CashDeposit | null
  isLoading: boolean
}

export function ConfirmDepositModal({ isOpen, onClose, onConfirm, deposit, isLoading }: Props) {
  const [depositedAt, setDepositedAt] = useState(new Date().toISOString().split('T')[0])
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!isOpen || !deposit) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!proofFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('proof', proofFile)
      formData.append('deposited_at', depositedAt)

      const { default: apiClient } = await import('@/lib/axios')
      await apiClient.post(`/cash-counts/deposits/${deposit.id}/confirm`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      await onConfirm()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Upload gagal'
      alert(`Upload gagal: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  const canSubmit = proofFile && depositedAt && !isLoading && !uploading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Konfirmasi Setoran</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Deposit info */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cabang</span>
              <span className="font-medium text-gray-900 dark:text-white">{deposit.branch_name || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bank Tujuan</span>
              <span className="font-medium text-gray-900 dark:text-white">{deposit.bank_account_name || '-'}</span>
            </div>
            <div className="border-t border-green-200 dark:border-green-700 pt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pecahan Besar (Kasir)</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(deposit.large_amount ?? deposit.deposit_amount)}</span>
              </div>
              {(deposit.owner_top_up ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Top Up Modal</span>
                  <span className="font-mono text-orange-600 dark:text-orange-400">{fmt(deposit.owner_top_up!)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-green-200 dark:border-green-700 pt-1.5">
                <span className="text-gray-700 dark:text-gray-200">Total Setor ke Bank</span>
                <span className="font-mono text-green-700 dark:text-green-300">{fmt(deposit.deposit_amount)}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Tanggal Setor Aktual *</label>
              <input type="date" value={depositedAt} onChange={(e) => setDepositedAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Bukti Setoran *</label>
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                  <button onClick={() => { setProofFile(null); setPreviewUrl(null) }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                  <div className="flex flex-col items-center gap-1.5">
                    <Image className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">Klik untuk upload foto bukti setoran</span>
                    <span className="text-[10px] text-gray-400">JPG, PNG, PDF (maks 5MB)</span>
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
            {(isLoading || uploading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Konfirmasi Setoran
          </button>
        </div>
      </div>
    </div>
  )
}
