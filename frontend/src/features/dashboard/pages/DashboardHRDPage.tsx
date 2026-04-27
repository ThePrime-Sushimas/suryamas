import { Users } from 'lucide-react'

export default function DashboardHRDPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Dashboard HRD</h2>
      <p className="text-sm text-gray-400 dark:text-gray-500">Segera hadir — ringkasan data karyawan dan kehadiran.</p>
    </div>
  )
}
