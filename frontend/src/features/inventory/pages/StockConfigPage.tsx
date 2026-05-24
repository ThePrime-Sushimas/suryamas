import { useState, useCallback, useRef, Fragment, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, Search, Check, Filter } from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useStockConfigGrid, useUpsertStockConfig } from '../api/inventory.api'
import type { StockConfigGridRow } from '../api/inventory.api'

// ─── Editable cell ────────────────────────────────────────────────────────────

interface CellProps {
  value: number | null
  productId: string
  branchId: string
  field: 'reorder_point' | 'safety_stock'
  onSave: (productId: string, branchId: string, field: 'reorder_point' | 'safety_stock', value: number | null) => void
}

function EditableCell({ value, productId, branchId, field, onSave }: CellProps) {
  const [editing, setEditing] = useState(false)
  const [localVal, setLocalVal] = useState(value?.toString() ?? '')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = () => {
    setEditing(true)
    setLocalVal(value?.toString() ?? '')
    setSaved(false)
  }

  const handleBlur = () => {
    setEditing(false)
    const parsed = localVal === '' ? null : parseFloat(localVal)
    if (parsed !== null && isNaN(parsed)) { setLocalVal(value?.toString() ?? ''); return }
    if (parsed === value) return
    onSave(productId, branchId, field, parsed)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') { setLocalVal(value?.toString() ?? ''); inputRef.current?.blur() }
  }

  return (
    <td className="px-1 py-1 text-center border-r border-gray-100 dark:border-gray-700 last:border-r-0 w-20">
      <div className="relative flex items-center justify-center">
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={editing ? localVal : (value?.toString() ?? '')}
          placeholder="—"
          onFocus={handleFocus}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-label={`${field === 'reorder_point' ? 'Reorder Point' : 'Safety Stock'}`}
          className={`w-full text-center text-sm py-1 px-1 rounded border outline-none transition-colors
            ${editing
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500'
              : 'border-transparent bg-transparent hover:border-gray-300 dark:hover:border-gray-600'
            }
            text-gray-900 dark:text-gray-100
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        {saved && (
          <span className="absolute -right-3 top-1/2 -translate-y-1/2">
            <Check className="w-3 h-3 text-green-500" />
          </span>
        )}
      </div>
    </td>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: rows = [], isLoading } = useStockConfigGrid()
  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []
  const upsert = useUpsertStockConfig()

  // URL state
  const search = searchParams.get('q') ?? ''
  const selectedCategory = searchParams.get('category') ?? ''

  const setSearch = (val: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set('q', val); else next.delete('q')
      return next
    }, { replace: true })
  }

  const setSelectedCategory = (val: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set('category', val); else next.delete('category')
      return next
    }, { replace: true })
  }

  // local override map: `productId|branchId|field` → value
  const [overrides, setOverrides] = useState<Map<string, number | null>>(new Map())

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(rows.map(r => r.category_name))].sort()
    return cats
  }, [rows])

  const handleSave = useCallback((
    productId: string,
    branchId: string,
    field: 'reorder_point' | 'safety_stock',
    value: number | null
  ) => {
    const key = `${productId}|${branchId}|${field}`
    setOverrides(prev => new Map(prev).set(key, value))

    // Ambil nilai field lainnya dari overrides atau data asli
    const row = rows.find(r => r.product_id === productId)
    const cfg = row?.configs.find(c => c.branch_id === branchId)
    const otherField = field === 'reorder_point' ? 'safety_stock' : 'reorder_point'
    const otherKey = `${productId}|${branchId}|${otherField}`
    const otherValue = overrides.get(otherKey) ?? cfg?.[otherField] ?? null

    upsert.mutate({
      branch_id: branchId,
      product_id: productId,
      reorder_point: field === 'reorder_point' ? value : otherValue as number | null,
      safety_stock: field === 'safety_stock' ? value : otherValue as number | null,
    })
  }, [rows, overrides, upsert])

  const getValue = (row: StockConfigGridRow, branchId: string, field: 'reorder_point' | 'safety_stock') => {
    const key = `${row.product_id}|${branchId}|${field}`
    if (overrides.has(key)) return overrides.get(key) ?? null
    return row.configs.find(c => c.branch_id === branchId)?.[field] ?? null
  }

  const filtered = rows.filter(r => {
    // Category filter
    if (selectedCategory && r.category_name !== selectedCategory) return false
    // Search filter
    if (search) {
      const q = search.toLowerCase()
      return r.product_name.toLowerCase().includes(q) ||
        r.product_code.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q)
    }
    return true
  })

  // Group by category
  const grouped = filtered.reduce<Record<string, StockConfigGridRow[]>>((acc, row) => {
    if (!acc[row.category_name]) acc[row.category_name] = []
    acc[row.category_name].push(row)
    return acc
  }, {})

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Konfigurasi Safety Stock
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {rows.length} produk · klik cell untuk edit · Enter atau klik luar untuk simpan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none w-48"
              >
                <option value="">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 w-56"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2">
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span><span className="font-semibold text-gray-700 dark:text-gray-300">ROP</span> = Reorder Point (trigger buat PR)</span>
          <span><span className="font-semibold text-gray-700 dark:text-gray-300">SS</span> = Safety Stock (stok minimum absolut)</span>
          <span className="text-gray-400">Kosong = tidak dikonfigurasi (tidak muncul di reorder suggestions)</span>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat data...</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-white dark:bg-gray-800 shadow-sm">
              <tr>
                {/* Sticky product col header */}
                <th className="sticky left-0 z-30 bg-white dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-r border-gray-200 dark:border-gray-700 min-w-[220px]">
                  Produk
                </th>
                <th className="sticky left-[220px] z-30 bg-white dark:bg-gray-800 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-r border-gray-200 dark:border-gray-700 w-16">
                  Satuan
                </th>
                {branches.map(branch => (
                  <th
                    key={branch.id}
                    colSpan={2}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b border-r border-gray-200 dark:border-gray-700 min-w-[160px]"
                  >
                    {branch.branch_name}
                    <div className="flex justify-center gap-2 mt-1 font-normal normal-case text-gray-400">
                      <span className="w-20 text-center">ROP</span>
                      <span className="w-20 text-center">SS</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([category, categoryRows]) => (
                <Fragment key={`cat-${category}`}>
                  {/* Category header row */}
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <td
                      colSpan={2 + branches.length * 2}
                      className="sticky left-0 px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-y border-gray-200 dark:border-gray-600"
                    >
                      {category}
                    </td>
                  </tr>
                  {categoryRows.map((row, idx) => (
                    <tr
                      key={row.product_id}
                      className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 ${
                        idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/50'
                      }`}
                    >
                      {/* Sticky product name */}
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-2 border-r border-gray-200 dark:border-gray-700 min-w-[220px]">
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{row.product_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{row.product_code}</p>
                      </td>
                      {/* Sticky unit */}
                      <td className="sticky left-[220px] z-10 bg-inherit px-3 py-2 text-xs text-gray-500 border-r border-gray-200 dark:border-gray-700 w-16">
                        {row.base_unit_name ?? '—'}
                      </td>
                      {/* Per-branch cells */}
                      {branches.map(branch => (
                        <Fragment key={`${row.product_id}-${branch.id}`}>
                          <EditableCell
                            value={getValue(row, branch.id, 'reorder_point')}
                            productId={row.product_id}
                            branchId={branch.id}
                            field="reorder_point"
                            onSave={handleSave}
                          />
                          <EditableCell
                            value={getValue(row, branch.id, 'safety_stock')}
                            productId={row.product_id}
                            branchId={branch.id}
                            field="safety_stock"
                            onSave={handleSave}
                          />
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
