import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, RefreshCw, Search, Filter, X, Plus, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useMenus, useMenuCategories, useMenuGroups, useSyncMenus, useDeleteMenu } from '../api/food-production.api'
import type { Menu } from '../types/food-production.types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n.toFixed(1)}%`

export default function MenusPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [recipeFilter, setRecipeFilter] = useState<'' | 'true' | 'false'>('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [categoryFilter, groupFilter, recipeFilter])

  const queryParams = useMemo(() => ({
    page, limit: 50,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categoryFilter ? { category_id: categoryFilter } : {}),
    ...(groupFilter ? { group_id: groupFilter } : {}),
    ...(recipeFilter ? { has_recipe: recipeFilter === 'true' } : {}),
  }), [page, debouncedSearch, categoryFilter, groupFilter, recipeFilter])

  const menus = useMenus(queryParams)
  const categories = useMenuCategories()
  const groups = useMenuGroups(categoryFilter ? { category_id: categoryFilter } : {})
  const syncMenus = useSyncMenus()
  const deleteMenu = useDeleteMenu()

  const hasFilters = !!debouncedSearch || !!categoryFilter || !!groupFilter || !!recipeFilter

  const handleSync = async () => {
    try {
      const result = await syncMenus.mutateAsync(false)
      toast.success(`Sync selesai: ${result.inserted} baru, ${result.updated} diupdate, ${result.skipped} dilewati`)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal sync menu')) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMenu.mutateAsync(deleteTarget.id)
      toast.success('Menu dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus menu')) }
    finally { setDeleteTarget(null) }
  }

  const clearFilters = () => { setSearch(''); setDebouncedSearch(''); setCategoryFilter(''); setGroupFilter(''); setRecipeFilter('') }

  const data = menus.data?.data || []
  const pagination = menus.data?.pagination

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-orange-600 rounded-xl"><UtensilsCrossed className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Master Menu</h1>
          <p className="text-xs text-gray-400">Kelola menu, resep, dan estimasi biaya</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleSync} disabled={syncMenus.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncMenus.isPending ? 'animate-spin' : ''}`} />
            Sync POS
          </button>
          <button onClick={() => navigate('/food-production/menus/new')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700">
            <Plus className="w-3.5 h-3.5" /> Tambah Menu
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter className="w-3.5 h-3.5" /> Filter</div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu..."
              className="w-full h-9 pl-8 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none" />
          </div>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setGroupFilter('') }}
            className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Semua Kategori</option>
            {(categories.data || []).map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
          </select>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Semua Group</option>
            {(groups.data || []).map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
          </select>
          <select value={recipeFilter} onChange={e => setRecipeFilter(e.target.value as '' | 'true' | 'false')}
            className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Semua Resep</option>
            <option value="true">Punya Resep</option>
            <option value="false">Belum Ada Resep</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 h-9 px-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Nama Menu</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Harga Jual</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Cost %</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Resep</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {menus.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                  {hasFilters ? 'Tidak ada menu yang cocok dengan filter' : 'Belum ada menu. Klik "Sync POS" untuk import dari POS.'}
                </td></tr>
              ) : data.map((m: Menu) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/food-production/menus/${m.id}`)}>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{m.menu_code}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium">{m.menu_name}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{m.category_name}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{m.group_name || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-900 dark:text-white">{fmt(m.selling_price)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-900 dark:text-white">{m.estimated_cost > 0 ? fmt(m.estimated_cost) : '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {m.cost_percentage > 0 ? (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        m.cost_percentage > 40 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        m.cost_percentage > 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>{fmtPct(m.cost_percentage)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {m.has_recipe
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />}
                  </td>
                  <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDeleteTarget({ id: m.id, name: m.menu_name })} className="text-xs text-red-500 hover:text-red-700">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              pagination={{ page: pagination.page, limit: pagination.limit, total: pagination.total, totalPages: pagination.totalPages, hasNext: pagination.hasNext, hasPrev: pagination.hasPrev }}
              onPageChange={setPage} currentLength={data.length}
            />
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Menu"
        message={`Yakin ingin menghapus menu "${deleteTarget?.name}"?`}
        confirmText="Hapus"
        variant="danger"
      />
    </div>
  )
}
