import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'

interface EmployeeOption {
  id: string
  full_name: string
  mobile_phone: string
}

export interface PoWhatsAppModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (phone: string) => void | Promise<void>
  isPending?: boolean
  title?: string
  description?: string
  confirmLabel?: string
}

export function PoWhatsAppModal({
  open,
  onClose,
  onConfirm,
  isPending = false,
  title = 'Kirim via WhatsApp',
  description = 'Pilih penerima dan kirim ringkasan PO melalui WhatsApp.',
  confirmLabel = 'Kirim WhatsApp',
}: PoWhatsAppModalProps) {
  const [whatsappNumber, setWhatsappNumber] = useState('')

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'with-phone'],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params: { limit: 100 } })
      return (data.data ?? []).filter((e: Record<string, unknown>) => e.mobile_phone) as EmployeeOption[]
    },
    staleTime: 120_000,
    enabled: open,
  })
  const employees = employeesData ?? []

  useEffect(() => {
    if (!open) setWhatsappNumber('')
  }, [open])

  if (!open) return null

  const handleConfirm = async () => {
    await onConfirm(whatsappNumber)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">{description}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pilih Penerima
            </label>
            <select
              onChange={(e) => {
                const emp = employees.find((x) => x.id === e.target.value)
                if (emp) setWhatsappNumber(emp.mobile_phone)
              }}
              className={inputCls}
            >
              <option value="">Pilih employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} - {emp.mobile_phone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nomor WhatsApp
            </label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className={inputCls}
            />
            <p className="text-xs text-gray-500 mt-1">
              Kosongkan jika tidak ingin membuka WhatsApp
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? 'Memproses...' : (
              <>
                <MessageCircle className="w-4 h-4" /> {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
