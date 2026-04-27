import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, ArrowRight, UserCheck, UserX } from 'lucide-react'
import api from '@/lib/axios'
import { MetricCard } from '../components/MetricCard'

export default function DashboardHRDPage() {
  const employees = useQuery({
    queryKey: ['dashboard', 'employee-summary'],
    queryFn: async () => {
      const [all, active, inactive] = await Promise.all([
        api.get('/employees', { params: { limit: 1, page: 1 } }),
        api.get('/employees', { params: { limit: 1, page: 1, is_active: true } }),
        api.get('/employees', { params: { limit: 1, page: 1, is_active: false } }),
      ])
      return {
        total: all.data.pagination?.total || 0,
        active: active.data.pagination?.total || 0,
        inactive: inactive.data.pagination?.total || 0,
      }
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">HRD</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard label="Total Karyawan" value={employees.isLoading ? '...' : `${employees.data?.total || 0}`} loading={employees.isLoading} icon={<Users className="w-4 h-4 text-blue-500" />} />
        <MetricCard label="Aktif" value={employees.isLoading ? '...' : `${employees.data?.active || 0}`} loading={employees.isLoading} icon={<UserCheck className="w-4 h-4 text-emerald-500" />} />
        <MetricCard label="Non-Aktif" value={employees.isLoading ? '...' : `${employees.data?.inactive || 0}`} loading={employees.isLoading} icon={<UserX className="w-4 h-4 text-gray-400" />} color={employees.data?.inactive ? 'warn' : undefined} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/employees" className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Daftar Karyawan</p>
              <p className="text-[11px] text-gray-400">Kelola data karyawan</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
        </Link>
        <Link to="/employee-branches" className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-violet-500" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Penempatan Cabang</p>
              <p className="text-[11px] text-gray-400">Assign karyawan ke cabang</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
        </Link>
      </div>
    </div>
  )
}
