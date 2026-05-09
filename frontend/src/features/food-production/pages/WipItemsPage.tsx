import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Beaker, Plus, Search, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useWipItems, useDeleteWipItem } from '../api/food-production.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)

export default function WipItemsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const queryParams = useMemo(() => ({
    page, limit: 50,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [page, debouncedSearch])

  const wipItems = useWipItems(queryParams)
  const deleteWip = useDeleteWipItem()

  const handleDelete = async () => {
    if (!deleteId) return
    try { await deleteWip.mutateAsync(deleteId); toast.success('WIP dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus WIP')) }
    finally { setDeleteId(null) }
  }

  const data = wipItems.data?.data || []
  const pagination = wipItems.data?.pagination

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-purple-600 rounded-xl"><Beaker className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Bahan Setengah Jadi (WIP)</h1>
          <p className="text-xs text-gray-400">Kelola bahan setengah jadi seperti Nasi Sushi, Saus, dll</p>
        </div>
        <button onClick={() => navigate('/food-production/wip/new')}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          <Plus className="w-3.5 h-3.5" /> Tambah WIP
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari WIP..."
          className="w-full h-9 pl-8 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Nama WIP</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Hasil/Batch</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Cost/Batch</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {wipItems.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-gray-400">Belum ada WIP</td></tr>
              ) : data.map(w => (
                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/food-production/wip/${w.id}`)}>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{w.wip_code}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium">{w.wip_name}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{w.yield_qty} <span className="text-gray-400 text-xs">{w.uom}</span></td>
                  <td className="px-3 py-2.5 text-right font-mono">{w.estimated_cost > 0 ? fmt(w.estimated_cost) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium">{w.cost_per_unit > 0 ? fmt(w.cost_per_unit) : '—'}</td>
                  <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDeleteId(w.id)} className="text-xs text-red-500 hover:text-red-700">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Pagination pagination={pagination} onPageChange={setPage} currentLength={data.length} />
          </div>
        )}
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Hapus WIP" message="Yakin ingin menghapus WIP ini?" confirmText="Hapus" variant="danger" />
    </div>
  )
}
