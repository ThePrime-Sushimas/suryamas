import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { exportSnapshotToExcel } from '../utils/snapshotExport'
import { useToast } from '@/contexts/ToastContext'
import api from '@/lib/axios'
import type { ClosingSnapshotTrialBalanceLine, ClosingSnapshotReportLine } from '../types/fiscal-period.types'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtDate = (s: string) => new Date(s).toLocaleString('id-ID')

type TabKey = 'trial_balance' | 'income_statement' | 'balance_sheet'

export function FiscalPeriodSnapshotsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { snapshots, snapshotDetail, snapshotLoading, fetchSnapshots, fetchSnapshotByVersion, clearSnapshotDetail } =
    useFiscalPeriodsStore()
  const { selectedPeriod, fetchPeriodById } = useFiscalPeriodsStore()

  const [activeTab, setActiveTab] = useState<TabKey>('trial_balance')

  useEffect(() => {
    if (!id) return
    fetchSnapshots(id)
    fetchPeriodById(id)
    return () => clearSnapshotDetail()
  }, [id, fetchSnapshots, fetchPeriodById, clearSnapshotDetail])

  const periodLabel = selectedPeriod?.period ?? id ?? ''

  const handleSelectVersion = (version: number) => {
    if (!id) return
    fetchSnapshotByVersion(id, version)
    setActiveTab('trial_balance')
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'trial_balance', label: 'Trial Balance' },
    { key: 'income_statement', label: 'Income Statement' },
    { key: 'balance_sheet', label: 'Balance Sheet' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/accounting/fiscal-periods')}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
        >
          &larr; Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Closing Snapshots</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Version list */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Versi Tersedia</p>
            </div>
            {snapshotLoading && !snapshotDetail ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            ) : snapshots.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada snapshot.</div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {snapshots.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => handleSelectVersion(s.version)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                        snapshotDetail?.header.version === s.version
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          v{s.version}
                        </span>
                        {s.is_latest ? (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                            Latest
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            Outdated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(s.closed_at)}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        Net: {s.net_income >= 0 ? '+' : ''}{fmt(s.net_income)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3 space-y-4">
          {!snapshotDetail ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow p-8 text-center text-gray-500 dark:text-gray-400">
              {snapshotLoading ? 'Loading...' : 'Pilih versi di sebelah kiri untuk melihat detail.'}
            </div>
          ) : (
            <>
              {/* Outdated badge */}
              {!snapshotDetail.header.is_latest && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span>Ini <strong>bukan versi terakhir</strong>. Ada versi lebih baru yang merupakan hasil koreksi setelah reopen.</span>
                </div>
              )}

              {/* Summary card + Export buttons */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Versi</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">v{snapshotDetail.header.version}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">{fmt(snapshotDetail.header.total_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Expense</p>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">{fmt(snapshotDetail.header.total_expense)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Net Income</p>
                      <p className={`text-sm font-semibold ${snapshotDetail.header.net_income >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(snapshotDetail.header.net_income)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => exportSnapshotToExcel(snapshotDetail, periodLabel)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      title="Export Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const response = await api.get(
                            `/accounting/fiscal-periods/${id}/snapshots/${snapshotDetail.header.version}/pdf`,
                            { responseType: 'blob' }
                          )
                          const url = URL.createObjectURL(response.data)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `closing-snapshot_${periodLabel}_v${snapshotDetail.header.version}.pdf`
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          toast.error('Gagal mengunduh PDF')
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      title="Export PDF"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow">
                <div className="border-b border-gray-200 dark:border-gray-700 flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                        activeTab === tab.key
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  {activeTab === 'trial_balance' && (
                    <TrialBalanceTable rows={snapshotDetail.trial_balance} />
                  )}
                  {activeTab === 'income_statement' && (
                    <ReportLineTable rows={snapshotDetail.income_statement} />
                  )}
                  {activeTab === 'balance_sheet' && (
                    <ReportLineTable rows={snapshotDetail.balance_sheet} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrialBalanceTable({ rows }: { rows: ClosingSnapshotTrialBalanceLine[] }) {
  if (rows.length === 0) return <EmptyTable />
  return (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
      <thead className="bg-gray-50 dark:bg-gray-800">
        <tr>
          {['Kode', 'Nama Akun', 'Tipe', 'Opening D', 'Opening C', 'Period D', 'Period C', 'Closing D', 'Closing C'].map(h => (
            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
            <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{r.account_code}</td>
            <td className="px-3 py-2 text-gray-900 dark:text-white">{r.account_name}</td>
            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.account_type}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.opening_debit)}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.opening_credit)}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.period_debit)}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.period_credit)}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.closing_debit)}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.closing_credit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReportLineTable({ rows }: { rows: ClosingSnapshotReportLine[] }) {
  if (rows.length === 0) return <EmptyTable />

  const typeColors: Record<string, string> = {
    REVENUE: 'text-green-700 dark:text-green-400',
    EXPENSE: 'text-red-700 dark:text-red-400',
    ASSET: 'text-blue-700 dark:text-blue-400',
    LIABILITY: 'text-orange-700 dark:text-orange-400',
    EQUITY: 'text-purple-700 dark:text-purple-400',
  }

  return (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
      <thead className="bg-gray-50 dark:bg-gray-800">
        <tr>
          {['Kode', 'Nama Akun', 'Tipe', 'Group', 'Debit', 'Credit'].map(h => (
            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
            <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{r.account_code}</td>
            <td className="px-3 py-2 text-gray-900 dark:text-white">{r.account_name}</td>
            <td className={`px-3 py-2 font-medium ${typeColors[r.account_type] ?? 'text-gray-500'}`}>{r.account_type}</td>
            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.group_label ?? '-'}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.debit_amount)}</td>
            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(r.credit_amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptyTable() {
  return (
    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
      Tidak ada data.
    </div>
  )
}
