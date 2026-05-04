import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, Building2, ArrowRight, GitBranch, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { useHrdSummary } from '../api/useDashboardApi'

const POSITION_COLORS: Record<string, string> = {
  SUSHIMAN: 'bg-blue-500',
  SERVER: 'bg-emerald-500',
  COOK: 'bg-orange-500',
  BARISTA: 'bg-purple-500',
  DISHWASHER: 'bg-gray-500',
  MANAGER: 'bg-red-500',
  SEKRETARIS: 'bg-pink-500',
}

function getPositionColor(pos: string): string {
  return POSITION_COLORS[pos] || 'bg-slate-400'
}

export default function DashboardHRDPage() {
  const { data, isLoading, isError } = useHrdSummary()
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">HRD</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">HRD</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 dark:text-red-400">Gagal memuat data HRD</p>
        </div>
      </div>
    )
  }

  const { summary, branches, position_summary, multi_branch_employees } = data
  const staffRotasi = multi_branch_employees.filter(e => e.role_name !== 'Super Admin')
  const adminAccess = multi_branch_employees.filter(e => e.role_name === 'Super Admin')
  const maxBranchCount = Math.max(...branches.map(b => b.employee_count), 1)
  const maxPositionCount = position_summary[0]?.count || 1

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">HRD</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Users className="w-4 h-4 text-blue-500" />} label="Total Karyawan" value={summary.total_employees} />
        <SummaryCard icon={<UserCheck className="w-4 h-4 text-emerald-500" />} label="Aktif" value={summary.active_employees} />
        <SummaryCard icon={<Building2 className="w-4 h-4 text-violet-500" />} label="Cabang Aktif" value={summary.active_branches} />
        <SummaryCard icon={<GitBranch className="w-4 h-4 text-amber-500" />} label="Multi-Cabang" value={summary.multi_branch_count} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Karyawan per Cabang */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Karyawan per Cabang</h2>
            <p className="text-[11px] text-gray-400">Berdasarkan cabang utama (primary)</p>
          </div>
          <div className="p-4 space-y-2">
            {branches.map(branch => (
              <div key={branch.branch_id}>
                <button
                  onClick={() => setExpandedBranch(expandedBranch === branch.branch_id ? null : branch.branch_id)}
                  className="w-full flex items-center gap-3 group"
                >
                  {expandedBranch === branch.branch_id
                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{branch.branch_name}</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white ml-2">{branch.employee_count}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(branch.employee_count / maxBranchCount) * 100}%` }} />
                    </div>
                  </div>
                </button>
                {expandedBranch === branch.branch_id && (
                  <div className="ml-7 mt-2 mb-1 flex flex-wrap gap-1.5">
                    {branch.positions.map(p => (
                      <span key={p.job_position} className="inline-flex items-center gap-1 text-[10px] bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        <span className={`w-1.5 h-1.5 rounded-full ${getPositionColor(p.job_position)}`} />
                        {p.job_position} ({p.count})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {branches.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
            )}
          </div>
        </div>

        {/* Breakdown per Posisi */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Breakdown per Posisi</h2>
            <p className="text-[11px] text-gray-400">Seluruh cabang aktif</p>
          </div>
          <div className="p-4 space-y-2">
            {position_summary.map(p => (
              <div key={p.job_position} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${getPositionColor(p.job_position)}`} />
                <span className="text-xs text-gray-600 dark:text-gray-400 w-24 truncate">{p.job_position}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${getPositionColor(p.job_position)}`} style={{ width: `${(p.count / maxPositionCount) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white w-8 text-right">{p.count}</span>
              </div>
            ))}
            {position_summary.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Branch Employees */}
      {multi_branch_employees.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Karyawan Multi-Cabang</h2>
            <p className="text-[11px] text-gray-400">{staffRotasi.length} staff rotasi · {adminAccess.length} admin</p>
          </div>

          {staffRotasi.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Nama</th>
                    <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Posisi</th>
                    <th className="px-4 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Cabang</th>
                    <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Daftar Cabang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {staffRotasi.slice(0, 20).map(emp => (
                    <tr key={emp.employee_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">{emp.full_name}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{emp.job_position}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">{emp.branch_count}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {emp.branches.map(b => (
                            <span key={b} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">{b.replace('SUSHIMAS ', '')}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staffRotasi.length > 20 && (
                <div className="px-4 py-2 text-center text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  +{staffRotasi.length - 20} lainnya
                </div>
              )}
            </div>
          )}

          {adminAccess.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Admin Access</p>
              <div className="space-y-1">
                {adminAccess.map(emp => (
                  <div key={emp.employee_id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{emp.full_name} <span className="text-gray-400">· {emp.role_name}</span></span>
                    <span className="text-gray-400">{emp.branch_count} cabang</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Links */}
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

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}
