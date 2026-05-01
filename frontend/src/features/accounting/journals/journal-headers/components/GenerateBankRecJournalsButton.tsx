import { useState, useEffect } from 'react'
import { Loader2, X, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react'
import api from '@/lib/axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useBankAccountsStore } from '@/features/bank-accounts/store/useBankAccounts'

// ============================================================
// Types
// ============================================================

interface JobResult {
  success: Array<{
    bank_account_number: string
    journal_date: string
    journal_number: string
    total_credit: number
    total_debit: number
  }>
  failed: Array<{
    bank_account_id: number
    journal_date: string
    error: string
  }>
  total_statements: number
  total_journals: number
}

// ============================================================
// Format helpers
// ============================================================

const fmt = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

// ============================================================
// Job polling helper
// ============================================================

async function pollJobStatus(jobId: string, maxAttempts = 60): Promise<JobResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))

    const { data } = await api.get(`/jobs/${jobId}`)
    const job = data?.data || data
    const status = (job?.status || '').toUpperCase()

    if (status === 'COMPLETED') {
      const meta = job?.metadata || {}
      const results = meta?.importResults || job?.result?.importResults || job?.importResults || {}
      return {
        success: results.success || [],
        failed: results.failed || [],
        total_statements: results.total_statements || 0,
        total_journals: results.total_journals || 0,
      }
    }

    if (status === 'FAILED') {
      throw new Error(job?.error_message || job?.error || 'Job failed')
    }
  }

  throw new Error('Timeout: job did not complete within 2 minutes')
}

// ============================================================
// Modal
// ============================================================

function GenerateBankRecModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const { accounts, fetchByOwner } = useBankAccountsStore()

  const [bankAccountId, setBankAccountId] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<JobResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'form' | 'loading' | 'result'>('form')

  useEffect(() => {
    if (isOpen && currentBranch?.company_id) {
      fetchByOwner('company', currentBranch.company_id)
    }
  }, [isOpen, currentBranch?.company_id, fetchByOwner])

  useEffect(() => {
    if (!isOpen) {
      setPhase('form')
      setResult(null)
      setError(null)
      setIsLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const companyId = currentBranch?.company_id

  const handleGenerate = async () => {
    if (!companyId) {
      setError('Company belum dipilih. Pilih branch terlebih dahulu.')
      return
    }

    setIsLoading(true)
    setError(null)
    setPhase('loading')

    try {
      const { data: jobResponse } = await api.post('/jobs', {
        type: 'import',
        module: 'bank_rec_journals',
        name: `Bank Rec Journals ${dateFrom} - ${dateTo}`,
        metadata: {
          type: 'import',
          module: 'bank_rec_journals',
          companyId,
          branchId: currentBranch?.branch_id,
          ...(bankAccountId ? { bank_account_id: Number(bankAccountId) } : {}),
          date_from: dateFrom,
          date_to: dateTo,
        },
      })

      const jobId = jobResponse?.data?.job_id || jobResponse?.data?.id || jobResponse?.job_id

      if (!jobId) {
        throw new Error('Job ID tidak ditemukan dari response')
      }

      const pollResult = await pollJobStatus(jobId)
      setResult(pollResult)
      setPhase('result')
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal men-generate jurnal'
      setError(msg)
      setPhase('form')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Landmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Generate Jurnal Rekonsiliasi Bank
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Buat jurnal otomatis dari bank statement yang sudah direkonsiliasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {phase === 'form' && (
            <div className="space-y-4">
              {error && (
                <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Rekening Bank (opsional)
                </label>
                <select
                  value={bankAccountId}
                  onChange={e => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                >
                  <option value="">Semua Rekening</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} – {acc.account_number}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Kosongkan untuk generate semua rekening sekaligus.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <p className="font-semibold">Yang akan terjadi:</p>
                <ul className="space-y-0.5 ml-2">
                  <li>• Hanya statement yang sudah direkonsiliasi &amp; belum punya jurnal</li>
                  <li>• Dikelompokkan per rekening per tanggal</li>
                  <li>• Jurnal langsung berstatus POSTED</li>
                  <li>• Statement debit-only (fase 2) akan di-skip</li>
                </ul>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Sedang men-generate jurnal...
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Proses ini mungkin memakan waktu beberapa menit
                </p>
              </div>
            </div>
          )}

          {phase === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {result.total_statements}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Statement diproses</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {result.total_journals}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Jurnal dibuat</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {result.failed.length}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Gagal</p>
                </div>
              </div>

              {result.success.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Jurnal berhasil dibuat
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {result.success.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {s.journal_number}
                          </span>
                          <span className="text-gray-500 ml-1.5">
                            {s.journal_date} · {s.bank_account_number}
                          </span>
                        </div>
                        <span className="text-green-700 dark:text-green-400 font-medium shrink-0">
                          {fmt(s.total_credit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.failed.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                    Gagal ({result.failed.length})
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {result.failed.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/10 rounded-lg text-xs"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {f.journal_date}
                          </span>
                          <p className="text-red-600 dark:text-red-400 mt-0.5">{f.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
          {phase === 'result' ? (
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Selesai
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !dateFrom || !dateTo}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate Jurnal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main exported button
// ============================================================

export function GenerateBankRecJournalsButton({
  onAfterClose,
}: {
  onAfterClose?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
      >
        <Landmark size={16} />
        <span className="hidden sm:inline">Generate Jurnal Bank</span>
      </button>

      <GenerateBankRecModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
          onAfterClose?.()
        }}
      />
    </>
  )
}
