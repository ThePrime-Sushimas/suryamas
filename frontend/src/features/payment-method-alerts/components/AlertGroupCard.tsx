import { Bell, Edit, Trash2, Send, Layers } from 'lucide-react'
import type { PaymentMethodAlertGroup } from '../types'

interface AlertGroupCardProps {
  group: PaymentMethodAlertGroup
  onEdit: (group: PaymentMethodAlertGroup) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onToggle: (group: PaymentMethodAlertGroup) => void
}

export function AlertGroupCard({ group, onEdit, onDelete, onTest, onToggle }: AlertGroupCardProps) {
  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
  const names = group.payment_method_names?.join(' + ') || group.payment_method_ids.join(', ')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {group.name}
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
              group.is_active
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {group.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            {names}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Threshold: <span className="font-semibold">Rp {fmt(group.threshold_amount)}</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Chat ID: {group.telegram_chat_id}
          </p>
          {group.last_triggered_date && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              Terakhir trigger: {group.last_triggered_date} · Rp {fmt(group.last_triggered_amount)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onTest(group.id)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
            title="Test"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(group)}
            className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggle(group)}
            className="p-1.5 text-gray-400 hover:text-amber-600 rounded transition-colors"
            title={group.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          >
            <Bell className={`w-3.5 h-3.5 ${group.is_active ? '' : 'opacity-40'}`} />
          </button>
          <button
            onClick={() => onDelete(group.id)}
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
