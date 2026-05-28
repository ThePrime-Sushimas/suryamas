import { useState } from 'react'
import { Clock, CheckCircle2, Play, AlertTriangle } from 'lucide-react'
import { useAmortizations, useExecuteAmortization } from '../api/generalApi.api'
import type { AmortizationItem, AmortizationEntry } from '../api/generalApi.api'
import { formatRupiah, formatDate } from '../constants'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'

export default function AmortizationsPage() {
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | ''>('ACTIVE')
  const { data: amortizations = [], isLoading } = useAmortizations({
    status: statusFilter || undefined,
  })
  const executeMutation = useExecuteAmortization()

  const handleExecute = async (amort: AmortizationItem, entry: AmortizationEntry) => {
    if (entry.journal_id) return
    try {
      await executeMutation.mutateAsync({
        id: amort.id,
        period_number: entry.period_number,
      })
      toast.success(`Amortisasi periode ${entry.period_number} berhasil dieksekusi`)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal eksekusi amortisasi'))
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Amortisasi Prepaid</h1>
        <p className="text-sm text-gray-500">
          Jadwal amortisasi dari invoice prepaid. Eksekusi manual per periode untuk membuat jurnal beban.
        </p>
      </div>

      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ACTIVE' | 'COMPLETED' | '')}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="COMPLETED">Selesai</option>
        </select>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
      ) : amortizations.length === 0 ? (
        <div className="p-12 text-center text-gray-400 text-sm">
          Belum ada jadwal amortisasi.
        </div>
      ) : (
        <div className="space-y-4">
          {amortizations.map((amort) => (
            <div key={amort.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">{amort.vendor_name}</p>
                    <p className="text-sm text-gray-600">{amort.invoice_number}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {amort.prepaid_account_code} — {amort.prepaid_account_name}
                      </span>
                      <span>→</span>
                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        {amort.expense_account_code} — {amort.expense_account_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatRupiah(amort.total_amount)}</p>
                    <p className="text-xs text-gray-500">
                      {amort.periods_executed}/{amort.total_periods} periode
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      amort.status === 'ACTIVE' ? 'bg-amber-100 text-amber-700' :
                      amort.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {amort.status}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Periode: {formatDate(amort.start_date)} — {formatDate(amort.end_date)} · {formatRupiah(amort.amount_per_period)}/bulan
                </div>
              </div>

              {/* Entries */}
              <div className="divide-y divide-gray-50">
                {amort.entries.map((entry) => {
                  const isOverdue = !entry.journal_id && entry.period_date <= today
                  const isExecuted = !!entry.journal_id

                  return (
                    <div
                      key={entry.id}
                      className={`px-4 py-2.5 flex items-center justify-between text-sm ${
                        isOverdue ? 'bg-red-50' : isExecuted ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isExecuted ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : isOverdue ? (
                          <AlertTriangle size={14} className="text-red-500" />
                        ) : (
                          <Clock size={14} className="text-gray-400" />
                        )}
                        <span className="text-xs text-gray-600">
                          Periode {entry.period_number} — {formatDate(entry.period_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-700">
                          {formatRupiah(entry.amount)}
                        </span>
                        {!isExecuted && (
                          <button
                            type="button"
                            onClick={() => handleExecute(amort, entry)}
                            disabled={executeMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Play size={10} /> Eksekusi
                          </button>
                        )}
                        {isExecuted && (
                          <span className="text-xs text-green-600">✓ {formatDate(entry.executed_at)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
