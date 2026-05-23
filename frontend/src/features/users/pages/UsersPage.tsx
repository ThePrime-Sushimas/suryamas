import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { User } from '@/features/users'
import { Users, Search, X, Shield, UserCheck, UserX, Eye, ChevronDown, ChevronRight } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())
  const navigate = useNavigate()
  const { error: showError } = useToast()

  const loadData = useCallback(async () => {
    try {
      const usersData = await usersApi.getAll()
      setUsers(usersData)
    } catch (err) {
      showError(parseApiError(err, 'Gagal memuat data'))
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => { loadData() }, [loadData])

  const branches = useMemo(() =>
    Array.from(new Set(users.map(u => u.branch))).sort(),
    [users],
  )

  const filtered = useMemo(() => {
    let result = users
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(u =>
        u.full_name.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.employee_id?.toLowerCase().includes(s),
      )
    }
    if (selectedBranch !== 'all') {
      result = result.filter(u => u.branch === selectedBranch)
    }
    return result
  }, [users, search, selectedBranch])

  const grouped = useMemo(() => {
    const map: Record<string, User[]> = {}
    filtered.forEach(u => {
      if (!map[u.branch]) map[u.branch] = []
      map[u.branch].push(u)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const stats = useMemo(() => ({
    total: users.length,
    withAccount: users.filter(u => u.has_account).length,
    withBranchRole: users.filter(u => u.role_id).length,
  }), [users])

  const toggleBranch = (branch: string) => {
    setCollapsedBranches(prev => {
      const next = new Set(prev)
      next.has(branch) ? next.delete(branch) : next.add(branch)
      return next
    })
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Manajemen Pengguna</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {stats.total} karyawan · {stats.withAccount} punya akun · {stats.withBranchRole} punya role cabang
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-4 sm:px-6 py-2">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Role diatur per cabang di menu <strong>Penempatan Karyawan</strong> — bukan dari halaman ini.
        </p>
      </div>

      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2.5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari nama, email, atau ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Semua Cabang</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button
            onClick={() => setCollapsedBranches(new Set())}
            className="px-2.5 py-1.5 text-[11px] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Buka Semua
          </button>
          <button
            onClick={() => setCollapsedBranches(new Set(branches))}
            className="px-2.5 py-1.5 text-[11px] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0 p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search ? 'Tidak ditemukan' : 'Belum ada data'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([branch, branchUsers]) => (
              <div key={branch} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleBranch(branch)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {collapsedBranches.has(branch)
                      ? <ChevronRight className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{branch}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{branchUsers.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-0.5"><UserCheck className="w-3 h-3 text-green-500" />{branchUsers.filter(u => u.has_account).length}</span>
                    <span className="flex items-center gap-0.5"><UserX className="w-3 h-3 text-gray-400" />{branchUsers.filter(u => !u.has_account).length}</span>
                  </div>
                </button>

                {!collapsedBranches.has(branch) && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50/50 dark:bg-gray-700/30">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Nama</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Email</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Akun</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Role cabang</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {branchUsers.map(user => (
                          <tr key={user.employee_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                            <td className="px-4 py-2">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{user.full_name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{user.job_position}</p>
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400 truncate hidden sm:table-cell">{user.email || '—'}</td>
                            <td className="px-4 py-2 text-center">
                              {user.has_account ? (
                                <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                                  <UserCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
                                </span>
                              ) : (
                                <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                                  <UserX className="w-3 h-3 text-gray-400" />
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {user.role_name ? (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                                  {user.role_name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => navigate(`/users/${user.employee_id}`)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                title="Lihat"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
