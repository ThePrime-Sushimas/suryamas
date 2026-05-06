import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { usePaymentMethods } from '../api/alerts'
import type { PaymentMethodAlert, CreateAlertDto, UpdateAlertDto } from '../types'

interface AlertFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateAlertDto | UpdateAlertDto) => void
  editingAlert?: PaymentMethodAlert | null
  loading?: boolean
}

export function AlertForm({ isOpen, onClose, onSubmit, editingAlert, loading }: AlertFormProps) {
  const { data: paymentMethods = [] } = usePaymentMethods()
  const [form, setForm] = useState<CreateAlertDto>({
    payment_method_id: 0,
    threshold_amount: 0,
    telegram_chat_id: '',
    is_active: true,
  })

  useEffect(() => {
    if (editingAlert) {
      setForm({
        payment_method_id: editingAlert.payment_method_id,
        threshold_amount: editingAlert.threshold_amount,
        telegram_chat_id: editingAlert.telegram_chat_id,
        is_active: editingAlert.is_active,
      })
    } else {
      setForm({
        payment_method_id: paymentMethods[0]?.id || 0,
        threshold_amount: 0,
        telegram_chat_id: import.meta.env.VITE_TELEGRAM_CHAT_ID || '-5202987932',
        is_active: true,
      })
    }
  }, [editingAlert, paymentMethods])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.payment_method_id || !form.threshold_amount || !form.telegram_chat_id) return
    onSubmit(form)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            {editingAlert ? 'Ubah Alert' : 'Tambah Alert'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Method
            </label>
            <select
              value={form.payment_method_id}
              onChange={e => setForm({ ...form, payment_method_id: Number(e.target.value) })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value={0}>Pilih...</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Threshold (Rp)
            </label>
            <input
              type="number"
              value={form.threshold_amount || ''}
              onChange={e => setForm({ ...form, threshold_amount: Number(e.target.value) })}
              placeholder="12000000"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={form.telegram_chat_id}
              onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="-5202987932"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-xs text-gray-700 dark:text-gray-300">Aktif</label>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}