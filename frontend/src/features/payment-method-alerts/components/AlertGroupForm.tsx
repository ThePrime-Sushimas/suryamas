import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { usePaymentMethods } from '../api/alerts'
import type { PaymentMethodAlertGroup, CreateAlertGroupDto, UpdateAlertGroupDto } from '../types'

interface AlertGroupFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateAlertGroupDto | UpdateAlertGroupDto) => void
  editingGroup?: PaymentMethodAlertGroup | null
  loading?: boolean
}

export function AlertGroupForm({ isOpen, onClose, onSubmit, editingGroup, loading }: AlertGroupFormProps) {
  const { data: paymentMethods = [] } = usePaymentMethods()
  const [form, setForm] = useState<CreateAlertGroupDto>({
    name: '',
    payment_method_ids: [],
    threshold_amount: 0,
    telegram_chat_id: '',
    is_active: true,
  })

  useEffect(() => {
    if (editingGroup) {
      setForm({
        name: editingGroup.name,
        payment_method_ids: editingGroup.payment_method_ids,
        threshold_amount: editingGroup.threshold_amount,
        telegram_chat_id: editingGroup.telegram_chat_id,
        is_active: editingGroup.is_active,
      })
    } else if (isOpen) {
      setForm({
        name: '',
        payment_method_ids: [],
        threshold_amount: 0,
        telegram_chat_id: import.meta.env.VITE_TELEGRAM_CHAT_ID || '-5202987932',
        is_active: true,
      })
    }
  }, [editingGroup, isOpen])

  const togglePaymentMethod = (id: number) => {
    setForm(prev => ({
      ...prev,
      payment_method_ids: prev.payment_method_ids.includes(id)
        ? prev.payment_method_ids.filter(pmId => pmId !== id)
        : [...prev.payment_method_ids, id],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || form.payment_method_ids.length < 2 || !form.threshold_amount || !form.telegram_chat_id) {
      return
    }
    onSubmit(form)
  }

  if (!isOpen) return null

  const isValid = form.name.trim() && form.payment_method_ids.length >= 2 && form.threshold_amount > 0 && form.telegram_chat_id.trim()

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            {editingGroup ? 'Ubah Alert Group' : 'Tambah Alert Group'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Group
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Cash + QRIS"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${
                !form.name.trim() ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
          </div>

          {/* Payment Methods Multi-Select */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Methods <span className="text-gray-400">(pilih min. 2)</span>
            </label>
            <div className={`border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 ${
              form.payment_method_ids.length < 2 ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {paymentMethods.map(pm => {
                const isSelected = form.payment_method_ids.includes(pm.id)
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => togglePaymentMethod(pm.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300 dark:border-gray-500'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {pm.name}
                  </button>
                )
              })}
            </div>
            {form.payment_method_ids.length > 0 && form.payment_method_ids.length < 2 && (
              <p className="text-[10px] text-red-500 mt-0.5">Pilih minimal 2 payment method</p>
            )}
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Threshold (Rp) — total gabungan
            </label>
            <input
              type="number"
              value={form.threshold_amount || ''}
              onChange={e => setForm({ ...form, threshold_amount: Number(e.target.value) })}
              placeholder="15000000"
              min="1"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${
                !form.threshold_amount || form.threshold_amount <= 0 ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
          </div>

          {/* Telegram Chat ID */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={form.telegram_chat_id}
              onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="-5202987932"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${
                !form.telegram_chat_id.trim() ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-xs text-gray-700 dark:text-gray-300">Aktif</label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={loading || !isValid}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
