import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import api from '@/lib/axios'
import { X, Search, Package, ChevronDown, Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PickedProduct {
  id: string
  name: string
  code: string
  uom_buy: string
  uom_base: string
  category_id: string | null
  category_name: string | null
  average_cost: number
  affects_inventory: boolean
}

export interface PickedSupplier {
  id: string
  name: string
  price?: number
}

export interface ProductPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (product: PickedProduct, supplier?: PickedSupplier) => void
  branchId?: string
  showStock?: boolean
  showSupplier?: boolean
  excludeProductIds?: string[]
  filterRequestable?: boolean
  filterAsset?: boolean
  excludeAssets?: boolean
  title?: string
}

// ─── Internal types ─────────────────────────────────────────────────────────

interface ProductRow {
  id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  category_id: string | null
  category_name: string | null
  average_cost: number
  affects_inventory: boolean
}

interface CategoryOption {
  id: string
  category_name: string
}

interface ProductPage {
  data: ProductRow[]
  pagination: { page: number; totalPages: number; hasNext: boolean }
}

const PAGE_SIZE = 100

// ─── Component ──────────────────────────────────────────────────────────────

export function ProductPickerModal({
  open,
  onClose,
  onSelect,
  branchId,
  showStock = false,
  showSupplier = false,
  excludeProductIds = [],
  filterRequestable = false,
  filterAsset = false,
  excludeAssets = false,
  title = 'Pilih Produk',
}: ProductPickerModalProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
      setSearch('')
      setCategoryFilter('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // ── Fetch categories ──
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'picker'],
    queryFn: async () => {
      const { data } = await api.get('/categories', { params: { limit: 50 } })
      return data.data as CategoryOption[]
    },
    enabled: open,
    staleTime: 5 * 60_000,
  })

  // ── Infinite scroll products ──
  const productsEnabled = open && (!!categoryFilter || debouncedSearch.length >= 2)

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['product-picker', debouncedSearch, categoryFilter, filterAsset, excludeAssets],
    queryFn: async ({ pageParam = 1 }) => {
      const params: Record<string, string> = { limit: String(PAGE_SIZE), page: String(pageParam) }
      if (debouncedSearch) params.q = debouncedSearch
      if (categoryFilter) params.category_id = categoryFilter
      if (filterRequestable) params.is_requestable = 'true'
      if (filterAsset) params.is_asset = 'true'
      else if (excludeAssets) params.is_asset = 'false'
      const { data } = await api.get('/products/search', { params })
      return { data: data.data as ProductRow[], pagination: data.pagination } as ProductPage
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    enabled: productsEnabled,
    staleTime: 30_000,
  })

  const products = useMemo(() => infiniteData?.pages.flatMap(p => p.data) ?? [], [infiniteData])
  const productIds = useMemo(() => products.map(p => p.id), [products])

  // ── Infinite scroll observer ──
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node) return
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }, { threshold: 0.1 })
    observerRef.current.observe(node)
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // ── Fetch purchase UOMs (batch) ──
  const { data: purchaseUoms } = useQuery({
    queryKey: ['product-uoms', 'purchase-batch', productIds],
    queryFn: async () => {
      const { data } = await api.post('/product-uoms/purchase-units-batch', { product_ids: productIds })
      return data.data as Record<string, string>
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
  })

  // ── Fetch stock (MAIN + READY) ──
  const { data: stockData } = useQuery({
    queryKey: ['stock-picker', branchId, productIds],
    queryFn: async () => {
      const [mainRes, readyRes] = await Promise.all([
        api.get('/stock/balances', { params: { branch_id: branchId, warehouse_type: 'MAIN', limit: 100 } }),
        api.get('/stock/balances', { params: { branch_id: branchId, warehouse_type: 'READY', limit: 100 } }),
      ])
      const main: Record<string, { qty: number; uom: string }> = {}
      const ready: Record<string, { qty: number; uom: string }> = {}
      for (const row of (mainRes.data.data ?? [])) main[row.product_id] = { qty: parseFloat(row.qty), uom: row.base_unit_name ?? '' }
      for (const row of (readyRes.data.data ?? [])) ready[row.product_id] = { qty: parseFloat(row.qty), uom: row.base_unit_name ?? '' }
      return { main, ready }
    },
    enabled: showStock && !!branchId && productIds.length > 0,
    staleTime: 30_000,
  })

  // ── Fetch suppliers (batch) ──
  const { data: suppliersByProduct } = useQuery({
    queryKey: ['supplier-products', 'picker-batch', productIds],
    queryFn: async () => {
      const { data } = await api.post('/supplier-products/by-products', { product_ids: productIds })
      return data.data as Record<string, Array<{ supplier_id: string; supplier_name: string; price?: number }>>
    },
    enabled: showSupplier && productIds.length > 0,
    staleTime: 60_000,
  })

  // ── Helper ──
  const getUomBuy = useCallback((p: ProductRow) => {
    return purchaseUoms?.[p.id] ?? p.base_unit_name ?? 'pcs'
  }, [purchaseUoms])

  // ── Handle select ──
  const handleSelect = useCallback((product: ProductRow, supplier?: { supplier_id: string; supplier_name: string; price?: number }) => {
    if (excludeProductIds.includes(product.id)) return
    const picked: PickedProduct = {
      id: product.id,
      name: product.product_name,
      code: product.product_code,
      uom_buy: getUomBuy(product),
      uom_base: product.base_unit_name ?? 'pcs',
      category_id: product.category_id,
      category_name: product.category_name,
      average_cost: product.average_cost ?? 0,
      affects_inventory: product.affects_inventory ?? false,
    }
    const pickedSupplier: PickedSupplier | undefined = supplier
      ? { id: supplier.supplier_id, name: supplier.supplier_name, price: supplier.price }
      : undefined
    onSelect(picked, pickedSupplier)
  }, [excludeProductIds, getUomBuy, onSelect])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative flex flex-col w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau kode produk..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="relative">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Semua Kategori</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Table / list */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          {!productsEnabled ? (
            <EmptyPrompt text="Ketik minimal 2 huruf atau pilih kategori untuk mencari produk." />
          ) : isFetching && products.length === 0 ? (
            <LoadingRows />
          ) : products.length === 0 ? (
            <EmptyPrompt text="Produk tidak ditemukan." />
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden sm:table w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-2.5">Produk</th>
                    <th className="text-left px-3 py-2.5">Satuan</th>
                    {showStock && (
                      <>
                        <th className="text-right px-3 py-2.5">Gudang</th>
                        <th className="text-right px-3 py-2.5">Ready</th>
                      </>
                    )}
                    {showSupplier && <th className="text-left px-3 py-2.5">Supplier</th>}
                    {!showSupplier && <th className="px-3 py-2.5 w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {products.map(p => {
                    const excluded = excludeProductIds.includes(p.id)
                    const mainStock = stockData?.main[p.id]
                    const readyStock = stockData?.ready[p.id]
                    const suppliers = suppliersByProduct?.[p.id] ?? []

                    return (
                      <tr key={p.id} className={`transition-colors ${excluded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer'}`}
                        onClick={() => !excluded && !showSupplier && handleSelect(p)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{p.product_name}</div>                          
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{getUomBuy(p)}</td>
                        {showStock && (
                          <>
                            <td className="px-3 py-3 text-right">
                              <span className={`font-mono text-sm ${(mainStock?.qty ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                {mainStock?.qty ?? 0}
                              </span>
                              {mainStock?.uom && <span className="text-xs text-gray-400 ml-1">{mainStock.uom}</span>}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className={`font-mono text-sm ${(readyStock?.qty ?? 0) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                {readyStock?.qty ?? 0}
                              </span>
                              {readyStock?.uom && <span className="text-xs text-gray-400 ml-1">{readyStock.uom}</span>}
                            </td>
                          </>
                        )}
                        {showSupplier ? (
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            {suppliers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {suppliers.map(s => (
                                  <button key={s.supplier_id} onClick={() => !excluded && handleSelect(p, s)}
                                    disabled={excluded}
                                    className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed">
                                    + {s.supplier_name}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button onClick={() => !excluded && handleSelect(p)} disabled={excluded}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded text-xs hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">
                                + Tambah
                              </button>
                            )}
                          </td>
                        ) : (
                          <td className="px-3 py-3 text-right">
                            {!excluded && (
                              <button onClick={e => { e.stopPropagation(); handleSelect(p) }}
                                className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                                Pilih
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Mobile cards */}
              <ul className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {products.map(p => {
                  const excluded = excludeProductIds.includes(p.id)
                  const mainStock = stockData?.main[p.id]
                  const readyStock = stockData?.ready[p.id]
                  const suppliers = suppliersByProduct?.[p.id] ?? []

                  return (
                    <li key={p.id} className={`px-4 py-3 ${excluded ? 'opacity-40' : ''}`}
                      onClick={() => !excluded && !showSupplier && handleSelect(p)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{p.product_name}</p>
                          <p className="text-xs text-gray-400">{p.product_code} · {getUomBuy(p)}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            {showStock && <span>Gudang: {mainStock?.qty ?? 0} {mainStock?.uom ?? ''}</span>}
                            {showStock && <span>Ready: {readyStock?.qty ?? 0} {readyStock?.uom ?? ''}</span>}
                          </div>
                        </div>
                        {!excluded && !showSupplier && (
                          <button className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white">Pilih</button>
                        )}
                      </div>
                      {showSupplier && !excluded && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {suppliers.length > 0 ? suppliers.map(s => (
                            <button key={s.supplier_id} onClick={e => { e.stopPropagation(); handleSelect(p, s) }}
                              className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs">
                              + {s.supplier_name}
                            </button>
                          )) : (
                            <button onClick={e => { e.stopPropagation(); handleSelect(p) }}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+ Tambah</button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Load more trigger */}
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat lebih banyak...
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>{products.length > 0 ? `${products.length} produk ditampilkan` : ''}</span>
          <button onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyPrompt({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 dark:text-gray-500">
      <Package className="w-10 h-10 opacity-40" />
      <p className="text-sm text-center max-w-xs">{text}</p>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="p-5 space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      ))}
    </div>
  )
}
