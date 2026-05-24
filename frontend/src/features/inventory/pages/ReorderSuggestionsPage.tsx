import { useState, useMemo } from 'react'
import { AlertTriangle, ShoppingCart, RefreshCw, Clock } from 'lucide-react'
import { useReorderSuggestions } from '../api/inventory.api'
import type { ReorderSuggestionItem } from '../api/inventory.api'

const fmt = (n: number, unit?: string | null) =>
  `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)}${unit ? ` ${unit}` : ''}`
const fmtCurrency = (n: number) =>
  `Rp ${new Intl.NumberFormat('id-ID').format(n)}`

function StatusBadge({ item }: { item: ReorderSuggestionItem }) {
  if (item.is_critical) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <AlertTriangle className="w-3 h-3" /> Kritis
      </span>
    )
  }
  if (!item.still_short_after_order && item.qty_on_order > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <Clock className="w-3 h-3" /> PO Aktif
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      <AlertTriangle className="w-3 h-3" /> Perlu PO
    </span>
  )
}

export default function ReorderSuggestionsPage() {
  const { data: items = [], isLoading, refetch, isFetching } = useReorderSuggestions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filterBranch, setFilterBranch] = useState('')

  const branches = useMemo(() => {
    const seen = new Map<string, string>()
    items.forEach(i => seen.set(i.branch_id, i.branch_name))
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  const filtered = useMemo(() =>
    filterBranch ? items.filter(i => i.branch_id === filterBranch) : items,
    [items, filterBranch]
  )

  const itemKey = (i: ReorderSuggestionItem) => `${i.product_id}|${i.warehouse_id}`

  const toggleAll = () => {
    const actionable = filtered.filter(i => i.still_short_after_order)
    if (selected.size === actionable.length && actionable.length > 0)
      setSelected(new Set())
    else
      setSelected(new Set(actionable.map(itemKey)))
  }

  const toggle = (key: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const summary = useMemo(() => ({
    critical: items.filter(i => i.is_critical).length,
    needsPo: items.filter(i => i.still_short_after_order).length,
    hasActivePo: items.filter(i => !i.still_short_after_order && i.qty_on_order > 0).length,
  }), [items])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Reorder Suggestions
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {items.length} item stok di bawah reorder point
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  // TODO: open GeneratePRModal dengan selectedItems
                  alert(`Generate PR untuk ${selected.size} item — coming soon`)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <ShoppingCart className="w-4 h-4" />
                Generate PR ({selected.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary pills */}
      {!isLoading && items.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            {summary.critical > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {summary.critical} kritis (di bawah safety stock)
              </span>
            )}
            {summary.needsPo > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {summary.needsPo} perlu dibuat PO
              </span>
            )}
            {summary.hasActivePo > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {summary.hasActivePo} sudah ada PO aktif
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <select
          value={filterBranch}
          onChange={e => setFilterBranch(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Semua Cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">

          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === filtered.filter(i => i.still_short_after_order).length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang / Gudang</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stok</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROP</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kurang</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">On Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-4 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      Semua stok di atas reorder point 🎉
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => {
                    const key = itemKey(item)
                    const isSelected = selected.has(key)
                    const canSelect = item.still_short_after_order

                    return (
                      <tr
                        key={key}
                        onClick={() => canSelect && toggle(key)}
                        className={`transition-colors ${
                          canSelect ? 'cursor-pointer' : 'cursor-default opacity-75'
                        } ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!canSelect}
                            onChange={() => toggle(key)}
                            onClick={e => e.stopPropagation()}
                            className="rounded disabled:opacity-30"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{item.product_code}</p>
                          {item.config_source === 'product_default' && (
                            <p className="text-xs text-gray-400 italic">default produk</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          <p className="font-medium">{item.branch_name}</p>
                          <p className="text-xs text-gray-400">{item.warehouse_name}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono font-semibold ${item.is_critical ? 'text-red-600' : 'text-amber-600'}`}>
                            {fmt(item.current_qty, item.base_unit_name)}
                          </span>
                          {item.safety_stock != null && (
                            <p className="text-xs text-gray-400">SS: {fmt(item.safety_stock)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                          {fmt(item.reorder_point, item.base_unit_name)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-red-500 font-semibold">
                          {fmt(item.shortage, item.base_unit_name)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {item.qty_on_order > 0
                            ? <span className="text-blue-600">{fmt(item.qty_on_order, item.base_unit_name)}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {item.preferred_supplier_name
                            ? (
                              <div>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">{item.preferred_supplier_name}</p>
                                <p className="text-xs text-gray-400">
                                  {item.lead_time_days != null && `${item.lead_time_days} hari`}
                                  {item.lead_time_days != null && item.last_purchase_price != null && ' · '}
                                  {item.last_purchase_price != null && fmtCurrency(item.last_purchase_price)}
                                </p>
                              </div>
                            )
                            : <span className="text-gray-300 italic text-xs">Belum ada</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge item={item} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Semua stok di atas reorder point 🎉</div>
            ) : (
              filtered.map(item => {
                const key = itemKey(item)
                const isSelected = selected.has(key)
                const canSelect = item.still_short_after_order
                return (
                  <div
                    key={key}
                    onClick={() => canSelect && toggle(key)}
                    className={`p-4 ${canSelect ? 'cursor-pointer' : 'opacity-75'} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => toggle(key)}
                          onClick={e => e.stopPropagation()}
                          className="mt-0.5 rounded disabled:opacity-30"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.product_name}</p>
                          <p className="text-xs text-gray-400">{item.branch_name} · {item.warehouse_name}</p>
                        </div>
                      </div>
                      <StatusBadge item={item} />
                    </div>
                    <div className="mt-2 ml-6 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Stok</p>
                        <p className={`font-mono font-semibold ${item.is_critical ? 'text-red-600' : 'text-amber-600'}`}>
                          {fmt(item.current_qty, item.base_unit_name)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">ROP</p>
                        <p className="font-mono text-gray-600 dark:text-gray-400">{fmt(item.reorder_point, item.base_unit_name)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Kurang</p>
                        <p className="font-mono text-red-500 font-semibold">{fmt(item.shortage, item.base_unit_name)}</p>
                      </div>
                    </div>
                    {item.preferred_supplier_name && (
                      <p className="mt-1.5 ml-6 text-xs text-gray-500">
                        {item.preferred_supplier_name}
                        {item.lead_time_days != null && ` · ${item.lead_time_days} hari`}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
