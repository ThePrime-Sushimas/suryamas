import { useState } from 'react'
import { Package, RefreshCw, Filter, X, Search } from 'lucide-react'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { useAssets, useCategories } from '../api/fixed-assets.api'
import type { AssetStatus } from '../api/fixed-assets.api'
import { fixedAssetFilterConfig } from '../utils/fixedAssetFilters.url'
import { Pagination } from '@/components/ui/Pagination'
import { useBranches } from '@/features/branches/api/branches.api'

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AssetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  DISPOSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Aktif',
  MAINTENANCE: 'Maintenance',
  DISPOSED: 'Disposed',
}

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtCurrency = (n: number) =>
  `Rp ${n.toLocaleString('id-ID')}`

// ─── Page Component ──────────────────────────────────────────────────────────

export default function FixedAssetsPage() {
  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...fixedAssetFilterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/fixed-assets')

  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading, refetch, isFetching } = useAssets({
    page: filters.page,
    limit: filters.limit,
    search: filters.search || undefined,
    status: (filters.status || undefined) as AssetStatus | undefined,
    asset_category_id: filters.category_id || undefined,
    branch_id: filters.branch_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  })
  const assets = data?.data ?? []
  const pagination = data?.pagination

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const { data: categoriesData } = useCategories({ limit: 100, is_active: true })
  const categories = categoriesData?.data ?? []

  const hasActiveFilters = filters.status || filters.category_id || filters.branch_id || filters.date_from || filters.date_to

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Daftar Aset Tetap
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {pagination?.total ?? 0} aset
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari kode / nama aset..."
                className="pl-9 pr-3 py-2 w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                hasActiveFilters
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="mt-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari kode / nama aset..."
              className="pl-9 pr-3 py-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ status: e.target.value as typeof filters.status })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Semua Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="DISPOSED">Disposed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kategori</label>
                <select
                  value={filters.category_id}
                  onChange={(e) => setFilters({ category_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Branch</label>
                <select
                  value={filters.branch_id}
                  onChange={(e) => setFilters({ branch_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Semua Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ date_from: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ date_to: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-3 w-3" /> Reset Filter
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kode Aset</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Aset</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Nilai Buku</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tgl Perolehan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-6 py-5">
                      <div className="h-5 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                    </td></tr>
                  ))
                ) : assets.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-16 text-center">
                    <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Belum ada aset tetap</p>
                  </td></tr>
                ) : assets.map(asset => (
                  <tr
                    key={asset.id}
                    onClick={() => openDetail(`/fixed-assets/${asset.id}`)}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-blue-700 dark:text-blue-400">
                      {asset.asset_code}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {asset.asset_name}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {asset.category_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {asset.branch_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <AssetStatusBadge status={asset.status} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-900 dark:text-white">
                      {fmtCurrency(asset.book_value)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {fmtDate(asset.acquisition_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Belum ada aset tetap</div>
            ) : assets.map(asset => (
              <div
                key={asset.id}
                onClick={() => openDetail(`/fixed-assets/${asset.id}`)}
                className="p-4 cursor-pointer hover:bg-blue-50/10 dark:hover:bg-blue-900/5 active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">{asset.asset_code}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{asset.asset_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {asset.category_name} · {asset.branch_name} · {fmtDate(asset.acquisition_date)}
                    </p>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-0.5">
                      {fmtCurrency(asset.book_value)}
                    </p>
                  </div>
                  <AssetStatusBadge status={asset.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 p-4">
              <Pagination
                pagination={pagination}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
