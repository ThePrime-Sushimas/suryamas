import { Bell, Edit, Trash2, Send } from 'lucide-react'
import type { PaymentMethodAlert } from '../types'

interface AlertCardProps {
  alert: PaymentMethodAlert
  onEdit: (alert: PaymentMethodAlert) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onToggle: (alert: PaymentMethodAlert) => void
}

export function AlertCard({ alert, onEdit, onDelete, onTest, onToggle }: AlertCardProps) {
  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {alert.payment_method_name || `PM #${alert.payment_method_id}`}
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
              alert.is_active 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {alert.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Threshold: <span className="font-semibold">Rp {fmt(alert.threshold_amount)}</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Chat ID: {alert.telegram_chat_id}
          </p>
          {alert.last_triggered_date && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              Terakhir trigger: {alert.last_triggered_date} · Rp {fmt(alert.last_triggered_amount)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onTest(alert.id)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
            title="Test"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(alert)}
            className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggle(alert)}
            className="p-1.5 text-gray-400 hover:text-amber-600 rounded transition-colors"
            title={alert.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          >
            <Bell className={`w-3.5 h-3.5 ${alert.is_active ? '' : 'opacity-40'}`} />
          </button>
          <button
            onClick={() => onDelete(alert.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
            title="Hapus"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}