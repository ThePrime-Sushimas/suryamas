import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import type {
  FiscalPeriodWithDetails,
  PeriodClosingSummary,
  ClosingAccountLine,
} from '../types/fiscal-period.types'

interface EquityAccount {
  id: string
  account_code: string
  account_name: string
}

interface ClosePeriodModalProps {
  period: FiscalPeriodWithDetails
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ModalStep = 'preview' | 'confirm'

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))
}

function SummaryCard({ label, value, variant = 'neutral' }: {
  label: string; value: number; variant?: 'revenue' | 'expense' | 'income' | 'loss' | 'neutral'
}) {
  const colors: Record<string, string> = {
    revenue: 'text-blue-700 dark:text-blue-400',
    expense: 'text-red-600 dark:text-red-400',
    income: 'text-green-700 dark:text-green-400',
    loss: 'text-red-700 dark:text-red-400',
    neutral: 'text-gray-900 dark:text-white',
  }
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${colors[variant]}`}>{formatRupiah(value)}</p>
    </div>
  )
}

function AccountTable({ accounts }: { accounts: ClosingAccountLine[] }) {
  const [expanded, setExpanded] = useState(false)
  const revenues = accounts.filter(a => a.account_type === 'REVENUE')
  const expenses = accounts.filter(a => a.account_type === 'EXPENSE')

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
        <span>Detail Akun ({accounts.length} akun)</span>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Kode</th>
                <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Nama Akun</th>
                <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Net</th>
                <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Closing Dr</th>
                <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Closing Cr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {revenues.length > 0 && (
                <tr><td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">REVENUE</td></tr>
              )}
              {revenues.map(a => (
                <tr key={a.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-400">{a.account_code}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{a.account_name}</td>
                  <td className="px-3 py-1.5 text-right text-blue-600 dark:text-blue-400">{formatRupiah(a.net_amount)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{a.closing_debit > 0 ? formatRupiah(a.closing_debit) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{a.closing_credit > 0 ? formatRupiah(a.closing_credit) : '—'}</td>
                </tr>
              ))}
              {expenses.length > 0 && (
                <tr><td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">EXPENSE</td></tr>
              )}
              {expenses.map(a => (
                <tr key={a.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-400">{a.account_code}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{a.account_name}</td>
                  <td className="px-3 py-1.5 text-right text-red-600 dark:text-red-400">{formatRupiah(a.net_amount)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{a.closing_debit > 0 ? formatRupiah(a.closing_debit) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{a.closing_credit > 0 ? formatRupiah(a.closing_credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ClosePeriodModal({ period, isOpen, onClose, onSuccess }: ClosePeriodModalProps) {
  const navigate = useNavigate()
  const { getClosingPreview, closePeriodWithEntries } = useFiscalPeriodsStore()

  const [step, setStep] = useState<ModalStep>('preview')
  const [preview, setPreview] = useState<PeriodClosingSummary | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<{ journalId: string; journalNumber: string } | null>(null)
  const [equityAccounts, setEquityAccounts] = useState<EquityAccount[]>([])

  useEffect(() => {
    if (!isOpen) return
    setStep('preview')
    setPreview(null)
    setPreviewError(null)
    setPreviewLoading(true)
    setResult(null)
    setSubmitError(null)
    setCloseReason('')

    Promise.all([
      getClosingPreview(period.id),
      api.get('/chart-of-accounts', { params: { account_type: 'EQUITY', limit: 100 } })
        .then(res => {
          const items = res.data?.data || []
          return items.filter((a: Record<string, unknown>) => !a.is_header) as EquityAccount[]
        })
        .catch(() => [] as EquityAccount[]),
    ])
      .then(([data, accounts]) => {
        setPreview(data)
        setEquityAccounts(accounts)
        setRetainedEarningsAccountId(data.default_retained_earnings_account_id ?? '')
      })
      .catch(err => setPreviewError(parseApiError(err, 'Gagal memuat preview closing')))
      .finally(() => setPreviewLoading(false))
  }, [isOpen, period.id, getClosingPreview])

  const handleConfirm = async () => {
    if (!retainedEarningsAccountId) {
      setSubmitError('Pilih akun Retained Earnings terlebih dahulu')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await closePeriodWithEntries(period.id, {
        retained_earnings_account_id: retainedEarningsAccountId,
        close_reason: closeReason || undefined,
      })
      setResult({ journalId: res.closing_journal_id, journalNumber: res.closing_journal_number })
      onSuccess()
    } catch (err) {
      setSubmitError(parseApiError(err, 'Gagal menutup periode'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  if (result) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Periode Ditutup</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
            Periode <span className="font-semibold">{period.period}</span> berhasil ditutup.
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Closing journal:{' '}
            <button type="button" onClick={() => navigate(`/accounting/journals/${result.journalId}`)}
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-mono">
              {result.journalNumber}
            </button>
          </p>
          <button type="button" onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Tutup
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true" aria-labelledby="close-period-title">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 id="close-period-title" className="text-lg font-bold text-gray-900 dark:text-white">
              Tutup Periode — {period.period}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {step === 'preview' ? 'Langkah 1 dari 2: Review closing summary' : 'Langkah 2 dari 2: Konfirmasi'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none disabled:opacity-50" aria-label="Tutup modal">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {step === 'preview' && (
            <>
              {previewLoading && (
                <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Memuat closing preview...
                </div>
              )}
              {previewError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {previewError}
                </div>
              )}
              {preview && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SummaryCard label="Total Revenue" value={preview.total_revenue} variant="revenue" />
                    <SummaryCard label="Total Expense" value={preview.total_expense} variant="expense" />
                    <SummaryCard label={preview.is_profit ? 'Net Income (Laba)' : 'Net Loss (Rugi)'} value={preview.net_income} variant={preview.is_profit ? 'income' : 'loss'} />
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>📋 {preview.posted_journals_count} jurnal posted</span>
                    {preview.pending_journals_count > 0 && (
                      <span className="text-orange-600 dark:text-orange-400">⏳ {preview.pending_journals_count} jurnal pending</span>
                    )}
                  </div>
                  {preview.pending_journals_count > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-300">⚠️ {preview.pending_journals_count} jurnal belum diposting</p>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                        Jurnal berstatus DRAFT/SUBMITTED/APPROVED tidak akan masuk dalam closing entry. Setelah periode ditutup, jurnal tersebut tidak bisa diposting.
                      </p>
                    </div>
                  )}
                  <AccountTable accounts={preview.accounts} />
                  {preview.posted_journals_count === 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                      ❌ Tidak ada jurnal POSTED di periode ini. Tidak bisa melakukan closing.
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {step === 'confirm' && preview && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Akun Retained Earnings <span className="text-red-500">*</span>
                </label>
                <select value={retainedEarningsAccountId}
                  onChange={e => setRetainedEarningsAccountId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Pilih akun —</option>
                  {equityAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 310202 - RE current period</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Alasan Tutup <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} maxLength={500} rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  placeholder="Masukkan alasan penutupan periode..." />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{closeReason.length}/500</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-700 dark:text-gray-300">Ringkasan Closing</p>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Periode</span><span className="font-mono">{period.period}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Net Income</span>
                  <span className={preview.is_profit ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                    {preview.is_profit ? '+' : '-'}{formatRupiah(preview.net_income)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Jurnal lines</span>
                  <span>{preview.accounts.filter(a => Math.abs(a.net_amount) >= 0.005).length + 1} lines (+ 1 RE)</span>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">⚠️ Aksi ini tidak dapat dibatalkan</p>
                <ul className="text-xs text-red-700 dark:text-red-400 mt-1 space-y-1 list-disc list-inside">
                  <li>Periode akan di-lock — jurnal baru tidak bisa dibuat</li>
                  <li>Closing journal akan langsung POSTED ke ledger</li>
                  <li>Semua akun Revenue &amp; Expense akan di-nol-kan</li>
                </ul>
              </div>
              {submitError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm" role="alert">
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 text-sm transition">
            Batal
          </button>
          <div className="flex gap-2">
            {step === 'confirm' && (
              <button type="button" onClick={() => setStep('preview')} disabled={submitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 text-sm transition">
                ← Kembali
              </button>
            )}
            {step === 'preview' && (
              <button type="button" onClick={() => setStep('confirm')}
                disabled={previewLoading || !!previewError || !preview || preview.posted_journals_count === 0}
                className="px-5 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm transition font-medium">
                Lanjutkan →
              </button>
            )}
            {step === 'confirm' && (
              <button type="button" onClick={handleConfirm} disabled={submitting || !retainedEarningsAccountId}
                className="px-5 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm transition font-medium min-w-[140px]">
                {submitting ? (
                  <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Menutup...
                  </span>
                ) : '🔒 Tutup Periode'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
