import { useState } from 'react'
import { Calendar, Plus, Trash2, Loader2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePublicHolidays, useUpsertHoliday, useDeleteHoliday } from '../api/dailyPrepOrders.api'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function DpoHolidaysPage() {
  const toast = useToast()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const { data: holidays = [], isLoading } = usePublicHolidays(year)
  const upsertMutation = useUpsertHoliday()
  const deleteMutation = useDeleteHoliday()

  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    if (!holidayDate || !holidayName.trim()) {
      toast.error('Tanggal dan nama holiday wajib diisi')
      return
    }
    upsertMutation.mutate(
      { holiday_date: holidayDate, holiday_name: holidayName.trim() },
      {
        onSuccess: () => {
          toast.success('Holiday berhasil disimpan')
          setHolidayDate('')
          setHolidayName('')
        },
        onError: (err) => toast.error(parseApiError(err, 'Gagal menyimpan holiday')),
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        toast.success('Holiday berhasil dihapus')
        setDeleteTarget(null)
      },
      onError: (err) => toast.error(parseApiError(err, 'Gagal menghapus holiday')),
    })
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Public Holidays</h1>
      </div>

      {/* Add form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tanggal</label>
            <input
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nama Holiday</label>
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="e.g. Hari Raya Idul Fitri"
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={upsertMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Tambah
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Nama Holiday</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Belum ada holiday untuk tahun {year}
                </td>
              </tr>
            ) : (
              holidays.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{fmtDate(h.holiday_date)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{h.holiday_name}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDeleteTarget(h.id)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Holiday"
        message="Holiday ini akan dihapus. Lanjutkan?"
        variant="danger"
        confirmText="Ya, Hapus"
        cancelText="Batal"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
