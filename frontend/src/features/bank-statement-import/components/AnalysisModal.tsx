import { useState } from 'react'
import { 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2,
  FileCheck,
  FileX,
  Copy
} from 'lucide-react'
import type { BankStatementAnalysisResult } from '../types/bank-statement-import.types'
import { formatDateRange } from '../utils/format'

interface AnalysisModalProps {
  result: BankStatementAnalysisResult | null
  onConfirm: (skipDuplicates: boolean) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function AnalysisModal({
  result,
  onConfirm,
  onCancel,
  isLoading,
}: AnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'duplicates'>('overview')
  const [skipDuplicates, setSkipDuplicates] = useState(false)

  if (!result) return null

  const { import: imp, stats, warnings, duplicates } = result

  const statCards = [
    {
      label: 'Total Baris',
      value: stats.total_rows.toLocaleString(),
      icon: FileSpreadsheet,
      color: 'blue',
    },
    {
      label: 'Valid',
      value: stats.valid_rows.toLocaleString(),
      icon: CheckCircle,
      color: 'green',
    },
    {
      label: 'Duplikat',
      value: stats.duplicate_rows.toLocaleString(),
      icon: Copy,
      color: 'orange',
    },
    {
      label: 'Invalid',
      value: stats.invalid_rows.toLocaleString(),
      icon: FileX,
      color: 'red',
    },
  ]

  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Analisis Bank Statement
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review hasil analisis sebelum melakukan import ke sistem
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">File</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{imp.file_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Periode</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDateRange(imp)}
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {statCards.map((stat) => (
            <div 
              key={stat.label}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                stat.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                stat.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                stat.color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' :
                'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
            >
              <div className={`p-2 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {(warnings.has_future_dates || warnings.has_old_data) && (
          <div className="mb-4">
            {(warnings.has_future_dates || warnings.has_old_data) && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">Peringatan Data</p>
                  <div className="text-sm text-amber-700 dark:text-amber-400 mt-1 space-y-1">
                    {warnings.has_future_dates && (
                      <p>• {warnings.future_dates_count} transaksi dengan tanggal di masa depan</p>
                    )}
                    {warnings.has_old_data && (
                      <p>• {warnings.old_data_count} transaksi dengan tanggal yang sangat lama</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs for Duplicates */}
        {duplicates.length > 0 && (
          <div className="mb-4">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Ringkasan
              </button>
              <button
                onClick={() => setActiveTab('duplicates')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'duplicates'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Duplikat
                <span className="px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
                  {duplicates.length}
                </span>
              </button>
            </div>

            {activeTab === 'duplicates' && (
              <div className="mt-3">
                <div className="overflow-x-auto max-h-64 border rounded-lg">
                  <table className="table table-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="bg-gray-50 dark:bg-gray-900/50">Tanggal</th>
                        <th className="bg-gray-50 dark:bg-gray-900/50">Deskripsi</th>
                        <th className="text-right bg-gray-50 dark:bg-gray-900/50">Debit</th>
                        <th className="text-right bg-gray-50 dark:bg-gray-900/50">Kredit</th>
                        <th className="text-right bg-gray-50 dark:bg-gray-900/50">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {duplicates.slice(0, 20).map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="text-sm">{row.transaction_date}</td>
                          <td className="text-sm max-w-[200px] truncate">{row.description}</td>
                          <td className="text-sm text-right">{row.debit.toLocaleString()}</td>
                          <td className="text-sm text-right">{row.credit.toLocaleString()}</td>
                          <td className="text-sm text-right">{row.balance.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {duplicates.length > 20 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    Menampilkan 20 dari {duplicates.length} baris duplikat
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Options */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              disabled={isLoading || stats.duplicate_rows === 0}
              className="checkbox checkbox-sm checkbox-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Lewati duplikat saat import ({stats.duplicate_rows} baris)
            </span>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="modal-action flex items-center justify-between">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Batal
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline btn-primary"
              disabled={isLoading || stats.duplicate_rows === 0}
              onClick={() => onConfirm(true)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  Import, Skip Duplikat
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isLoading}
              onClick={() => onConfirm(false)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Import Semua
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div 
        className="modal-backdrop" 
        onClick={onCancel}
      />
    </div>
  )
}

