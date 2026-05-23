// FILE: frontend/src/features/ap-payments/components/VerifyScreenshotModal.tsx

import { useState, useCallback } from 'react'
import { Upload, Loader2, CheckCircle2, AlertTriangle, XCircle, X, ShieldCheck } from 'lucide-react'
import api from '@/lib/axios'
import { apTheme } from '../ap-payments.theme'
import { useApPayments } from '../api/apPayments.api'

interface BcaOcrRow {
  va: string
  amount: number
  type: string
  name: string
}

interface MatchRow {
  payment_id: string
  payment_number: string
  bank_account_number: string
  system_amount: number
  ocr_amount: number | null
  status: 'match' | 'amount_mismatch' | 'not_found_in_screenshot' | 'not_found_in_system'
}

interface VerifyResult {
  ocr_rows: BcaOcrRow[]
  ocr_total: number
  matches: MatchRow[]
}

interface VerifyScreenshotModalProps {
  onClose: () => void
  /**
   * Kalau diisi → cross-check hanya payment ID ini (dari detail page).
   * Kalau kosong → auto-load semua APPROVED (dari list page).
   */
  paymentIds?: string[]
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const STATUS_CONFIG: Record<MatchRow['status'], {
  label: string
  Icon: typeof CheckCircle2
  rowClass: string
  textClass: string
}> = {
  match: {
    label: 'Cocok',
    Icon: CheckCircle2,
    rowClass: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-900/10',
    textClass: 'text-emerald-700 dark:text-emerald-300',
  },
  amount_mismatch: {
    label: 'Nominal beda',
    Icon: AlertTriangle,
    rowClass: 'border-red-200 bg-red-50/60 dark:border-red-700/40 dark:bg-red-900/10',
    textClass: 'text-red-600 dark:text-red-400',
  },
  not_found_in_screenshot: {
    label: 'Tidak ada di screenshot',
    Icon: XCircle,
    rowClass: 'border-red-200 bg-red-50/60 dark:border-red-700/40 dark:bg-red-900/10',
    textClass: 'text-red-600 dark:text-red-400',
  },
  not_found_in_system: {
    label: 'Tidak ada di sistem',
    Icon: AlertTriangle,
    rowClass: 'border-amber-200 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-900/10',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
}

export function VerifyScreenshotModal({ onClose, paymentIds }: VerifyScreenshotModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)

  // Auto-load semua APPROVED payment kalau paymentIds tidak diisi
  const isAutoMode = !paymentIds || paymentIds.length === 0
  const { data: approvedData, isLoading: loadingApproved } = useApPayments(
    isAutoMode ? { status: 'APPROVED', limit: 100 } : {},
  )

  // ID yang akan dikirim ke backend
  const resolvedPaymentIds: string[] = isAutoMode
    ? (approvedData?.data ?? []).map((p) => p.id)
    : paymentIds

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setResult(null)
    setError(null)
  }, [])

  const handleVerify = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const base64 = await fileToBase64(file)
      const { data } = await api.post('/ap-payments/verify-screenshot', {
        image: base64,
        mime_type: file.type || 'image/jpeg',
        payment_ids: resolvedPaymentIds.length > 0 ? resolvedPaymentIds : undefined,
      })
      setResult(data.data as VerifyResult)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memverifikasi'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [file, resolvedPaymentIds])

  const handleReset = () => {
    setResult(null)
    setFile(null)
    setPreviewUrl(null)
    setError(null)
  }

  const hasIssues = result?.matches.some(
    (m) => m.status === 'amount_mismatch' || m.status === 'not_found_in_screenshot',
  )
  const allMatch = result && result.matches.length > 0 && !hasIssues

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rose-900/12 dark:bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#fff9f7] dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col border border-rose-200/85 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-rose-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-violet-500" />
            <div>
              <h3 className="font-semibold text-rose-950 dark:text-white text-sm">
                Verifikasi Screenshot BCA
              </h3>
              <p className="text-xs text-rose-700/65 dark:text-gray-400 mt-0.5">
                {isAutoMode
                  ? `Cross-check dengan ${loadingApproved ? '...' : resolvedPaymentIds.length} payment menunggu bayar`
                  : 'Cross-check dengan payment yang dipilih'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Upload area */}
          {!result && (
            <div className="space-y-3">
              <label className={apTheme.uploadZone}>
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {file ? file.name : 'Pilih screenshot halaman "Transaksi Belum Diotorisasi"'}
                </span>
                <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-40 rounded-xl border border-rose-200 dark:border-gray-600 object-contain mx-auto"
                />
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Hasil */}
          {result && (
            <div className="space-y-4">

              {/* Summary badge */}
              {result.matches.length > 0 && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                  allMatch
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/40'
                    : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700/40'
                }`}>
                  {allMatch
                    ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Semua nominal cocok — aman untuk diotorisasi</>
                    : <><XCircle className="w-4 h-4 shrink-0" /> Ada ketidaksesuaian — periksa sebelum otorisasi</>
                  }
                </div>
              )}

              {/* Cross-check results */}
              {result.matches.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-rose-950 dark:text-white uppercase tracking-wide mb-2">
                    Hasil Cross-Check
                  </p>
                  <div className="space-y-2">
                    {result.matches.map((m, i) => {
                      const cfg = STATUS_CONFIG[m.status]
                      const Icon = cfg.Icon
                      return (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${cfg.rowClass}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {m.payment_number || '—'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                              {m.bank_account_number}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Sistem: {fmtCurrency(m.system_amount)}
                              {m.ocr_amount != null && (
                                <span className={m.status === 'amount_mismatch' ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                  {' · '}Screenshot: {fmtCurrency(m.ocr_amount)}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className={`flex items-center gap-1.5 ml-3 shrink-0 ${cfg.textClass}`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium">{cfg.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* OCR rows */}
              <div>
                <p className="text-xs font-semibold text-rose-950 dark:text-white uppercase tracking-wide mb-2">
                  Detail Transaksi di Screenshot ({result.ocr_rows.length} baris · {fmtCurrency(result.ocr_total)})
                </p>
                <div className="overflow-x-auto rounded-xl border border-rose-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rose-200 dark:border-gray-700 bg-rose-50/50 dark:bg-gray-700/50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">No. Rekening</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nama</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Jenis</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                      {result.ocr_rows.map((row, i) => (
                        <tr key={i} className="hover:bg-rose-50/40 dark:hover:bg-gray-700/30">
                          <td className="px-3 py-2 text-gray-900 dark:text-white font-mono text-xs">{row.va}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">{row.name || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{row.type}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white text-right">{fmtCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-rose-200 dark:border-gray-700 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className={apTheme.btnSecondary}>Tutup</button>
          {!result ? (
            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={!file || loading || (isAutoMode && loadingApproved)}
              className={apTheme.btnPrimary}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
                : <><ShieldCheck className="w-4 h-4" /> Verifikasi</>
              }
            </button>
          ) : (
            <button type="button" onClick={handleReset} className={apTheme.btnPrimary}>
              <Upload className="w-4 h-4" /> Upload Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}