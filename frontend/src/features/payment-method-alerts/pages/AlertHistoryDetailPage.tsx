import { ArrowLeft, MessageSquare, TrendingUp, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAlertHistoryDetail } from '../api/alerts'

export default function AlertHistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: history, isLoading } = useAlertHistoryDetail(id!)

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
  const formatDateTime = (date: string) => new Date(date).toLocaleString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!history) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Link to="/settings/alerts/history" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Alert History Detail</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">History tidak ditemukan</p>
        </div>
      </div>
    )
  }

  const exceedAmount = history.triggered_amount - history.threshold_amount
  const exceedPercentage = ((exceedAmount / history.threshold_amount) * 100).toFixed(1)

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2.5">
          <Link to="/settings/alerts/history" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <MessageSquare className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Alert Detail</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{history.payment_method_name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 p-4 sm:p-6 space-y-4">
        {/* Alert Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Alert Summary</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Payment Method:</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">{history.payment_method_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Threshold:</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">Rp {fmt(history.threshold_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Triggered:</span>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Rp {fmt(history.triggered_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Kelebihan:</span>
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                  Rp {fmt(exceedAmount)} (+{exceedPercentage}%)
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Tanggal Trigger:</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">{formatDate(history.triggered_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Waktu Kirim:</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">{formatDateTime(history.telegram_sent_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Chat ID:</span>
                <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{history.telegram_chat_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Status Alert:</span>
                <span className={`text-xs font-medium ${
                  history.alert_is_active === true
                    ? 'text-green-600 dark:text-green-400' 
                    : history.alert_is_active === false
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-red-500 dark:text-red-400'
                }`}>
                  {history.alert_is_active === true ? 'Aktif' : history.alert_is_active === false ? 'Nonaktif' : 'Dihapus'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Branch Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Breakdown per Cabang ({history.branch_breakdown.length})
            </h2>
          </div>
          
          <div className="space-y-2">
            {history.branch_breakdown
              .sort((a, b) => b.amount - a.amount)
              .map((branch, idx) => {
                const percentage = ((branch.amount / history.triggered_amount) * 100).toFixed(1)
                return (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-[10px] font-medium">
                        {idx + 1}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{branch.branch_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">Rp {fmt(branch.amount)}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{percentage}%</div>
                    </div>
                  </div>
                )
              })}
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Keseluruhan:</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Rp {fmt(history.triggered_amount)}</span>
            </div>
          </div>
        </div>

        {/* Telegram Message Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Preview Pesan Telegram</h2>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 font-mono text-xs">
            <div className="whitespace-pre-line text-gray-800 dark:text-gray-200">
              {`🔔 *ALERT: ${history.payment_method_name}*

Total hari ini: *Rp ${fmt(history.triggered_amount)}*
Threshold: Rp ${fmt(history.threshold_amount)}

📍 Breakdown per cabang:
${history.branch_breakdown
  .sort((a, b) => b.amount - a.amount)
  .map(b => `• ${b.branch_name}: Rp ${fmt(b.amount)}`)
  .join('\n')}

📅 ${history.triggered_date}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}