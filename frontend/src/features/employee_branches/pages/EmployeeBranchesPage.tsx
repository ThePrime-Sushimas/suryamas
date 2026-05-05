import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, X, Star, Settings } from 'lucide-react'
import { employeeBranchesApi } from '../api/employeeBranches.api'

interface BranchCell {
  branch_id: string
  branch_name: string
  is_primary: boolean
  role_name: string
  status: string
}

interface MatrixRow {
  employee_id: string
  employee_name: string
  job_position: string
  branches: BranchCell[]
}

export default function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<MatrixRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [branchColumns, setBranchColumns] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const fetchMatrix = async () => {
      setLoading(true)
      try {
        const result = await employeeBranchesApi.listGrouped({ page: 1, limit: 500, search: '' })
        const raw = result.data as unknown as Array<{
          employee_id: string
          employee_name: string
          branches: Array<{
            branch_id: string
            branch?: { id?: string; branch_name?: string }
            branch_name?: string
            is_primary: boolean
            role?: { name?: string }
            role_name?: string
            status?: string
            employee?: { job_position?: string }
          }>
        }>

        const rows: MatrixRow[] = raw.map(item => ({
          employee_id: item.employee_id,
          employee_name: item.employee_name,
          job_position: item.branches?.[0]?.employee?.job_position || '',
          branches: (item.branches || []).map(b => ({
            branch_id: b.branch_id || b.branch?.id || '',
            branch_name: b.branch?.branch_name || b.branch_name || '',
            is_primary: b.is_primary,
            role_name: b.role?.name || b.role_name || '',
            status: b.status || 'active',
          })),
        }))

        // Extract unique branches for columns
        const branchMap = new Map<string, string>()
        rows.forEach(r => r.branches.forEach(b => {
          if (b.branch_id && !branchMap.has(b.branch_id)) branchMap.set(b.branch_id, b.branch_name)
        }))
        const cols = Array.from(branchMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setBranchColumns(cols)
        setData(rows.sort((a, b) => a.employee_name.localeCompare(b.employee_name)))
      } catch {
        setData([])
        setBranchColumns([])
      } finally {
        setLoading(false)
      }
    }
    fetchMatrix()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const s = search.toLowerCase()
    return data.filter(r =>
      r.employee_name.toLowerCase().includes(s) ||
      r.job_position.toLowerCase().includes(s) ||
      r.branches.some(b => b.branch_name.toLowerCase().includes(s))
    )
  }, [data, search])

  const shortName = (name: string) => name.replace(/^SUSHIMAS\s*/i, '')

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Penempatan Cabang</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {data.length} karyawan · {branchColumns.length} cabang
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2.5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Cari karyawan..."
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
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search ? 'Tidak ditemukan' : 'Belum ada data'}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-r border-gray-200 dark:border-gray-700 min-w-[180px]">
                  Karyawan
                </th>
                {branchColumns.map(col => (
                  <th
                    key={col.id}
                    className="px-2 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[100px] whitespace-nowrap"
                  >
                    <span className="text-[10px] uppercase tracking-wide">{shortName(col.name)}</span>
                  </th>
                ))}
                <th className="px-2 py-2.5 border-b border-gray-200 dark:border-gray-700 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr
                  key={row.employee_id}
                  className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'} hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors`}
                >
                  <td className="sticky left-0 z-10 px-3 py-2 border-r border-gray-100 dark:border-gray-700 bg-inherit">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {row.employee_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate text-xs">{row.employee_name}</p>
                        {row.job_position && (
                          <p className="text-[10px] text-gray-400 truncate">{row.job_position}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {branchColumns.map(col => {
                    const cell = row.branches.find(b => b.branch_id === col.id)
                    return (
                      <td key={col.id} className="px-2 py-2 text-center border-gray-100 dark:border-gray-700">
                        {cell ? (
                          <div className="flex items-center justify-center gap-0.5">
                            {cell.is_primary && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                              cell.status === 'active' ? 'bg-green-500' :
                              cell.status === 'suspended' ? 'bg-yellow-500' : 'bg-gray-300'
                            }`} title={`${cell.role_name} (${cell.status})`} />
                          </div>
                        ) : (
                          <span className="text-gray-200 dark:text-gray-700">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => navigate(`/employees/${row.employee_id}/branches`)}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                      title="Kelola"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      {!loading && filtered.length > 0 && (
        <div className="shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Cabang utama</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Aktif</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Ditangguhkan</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /> Nonaktif</span>
          <span className="ml-auto">{filtered.length} karyawan ditampilkan</span>
        </div>
      )}
    </div>
  )
}
