import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Search, Package, Loader2 } from 'lucide-react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import api from '@/lib/axios'

interface WipSaucePickerProps {
  open: boolean
  onClose: () => void
  onSelect: (product: { id: string; product_code: string; product_name: string; transfer_unit: string }) => void
  excludeProductIds: string[]
}

interface ProductRow {
  id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  sub_category_name: string | null
}

interface SubCategory {
  id: string
  sub_category_name: string
}

const PAGE_SIZE = 100

export function WipSaucePickerModal({ open, onClose, onSelect, excludeProductIds }: WipSaucePickerProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (open) { setTimeout(() => searchRef.current?.focus(), 50); setSearch('') }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Find "WIP Sauce" sub-category
  const { data: wipSauceSubCat } = useQuery({
    queryKey: ['sub-categories', 'wip-sauce'],
    queryFn: async () => {
      const { data } = await api.get('/sub-categories', { params: { limit: 200 } })
      const subCats = data.data as SubCategory[]
      return subCats.find(sc => sc.sub_category_name.toLowerCase().includes('wip sauce')) ?? null
    },
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const subCategoryId = wipSauceSubCat?.id ?? ''

  // Fetch products in this sub-category
  const productsEnabled = open && !!subCategoryId
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['product-picker', 'wip-sauce', subCategoryId, debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const params: Record<string, string> = { limit: String(PAGE_SIZE), page: String(pageParam), sub_category_id: subCategoryId }
      if (debouncedSearch) params.q = debouncedSearch
      const { data } = await api.get('/products/search', { params })
      return { data: data.data as ProductRow[], pagination: data.pagination }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => lastPage.pagination?.hasNext ? lastPage.pagination.page + 1 : undefined,
    enabled: productsEnabled,
    staleTime: 30_000,
  })

  const products = useMemo(() => infiniteData?.pages.flatMap(p => p.data) ?? [], [infiniteData])
  const productIds = useMemo(() => products.map(p => p.id), [products])

  // Fetch transfer UOMs for these products
  const { data: transferUoms } = useQuery({
    queryKey: ['product-uoms', 'transfer-unit', productIds],
    queryFn: async () => {
      // Fetch transfer unit names per product — use product detail which includes UOM info
      const results: Record<string, string> = {}
      // Batch query: get all product_uoms that are default_transfer_unit
      const { data } = await api.get('/product-uoms', { params: { product_ids: productIds.join(','), is_default_transfer_unit: true, limit: 200 } })
      // Fallback: if the endpoint doesn't support batch, just use base_unit_name from products
      if (data?.data) {
        for (const uom of data.data as Array<{ product_id: string; unit_name?: string }>) {
          if (uom.product_id && uom.unit_name) results[uom.product_id] = uom.unit_name
        }
      }
      return results
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
  })

  const handleSelect = (p: ProductRow) => {
    if (excludeProductIds.includes(p.id)) return
    onSelect({
      id: p.id,
      product_code: p.product_code,
      product_name: p.product_name,
      transfer_unit: transferUoms?.[p.id] ?? p.base_unit_name ?? 'pcs',
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative flex flex-col w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pilih Produk Sauce</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sub-kategori: {wipSauceSubCat?.sub_category_name ?? 'WIP Sauce'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-auto">
          {!subCategoryId ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Package className="w-10 h-10 opacity-40 mb-2" />
              <p className="text-sm">Sub-kategori "WIP Sauce" tidak ditemukan</p>
            </div>
          ) : isFetching && products.length === 0 ? (
            <div className="p-5 space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Package className="w-10 h-10 opacity-40 mb-2" />
              <p className="text-sm">{debouncedSearch ? 'Produk tidak ditemukan' : 'Tidak ada produk di sub-kategori ini'}</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left px-5 py-2.5">Produk</th>
                    <th className="text-left px-4 py-2.5">Satuan</th>
                    <th className="px-4 py-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {products.map(p => {
                    const excluded = excludeProductIds.includes(p.id)
                    const unit = transferUoms?.[p.id] ?? p.base_unit_name ?? 'pcs'
                    return (
                      <tr key={p.id}
                        className={`transition-colors ${excluded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer'}`}
                        onClick={() => !excluded && handleSelect(p)}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{p.product_name}</div>
                          <div className="text-xs text-gray-400">{p.product_code}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{unit}</td>
                        <td className="px-4 py-3 text-right">
                          {!excluded ? (
                            <button onClick={e => { e.stopPropagation(); handleSelect(p) }}
                              className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                              Pilih
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Sudah dipilih</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {(hasNextPage || isFetchingNextPage) && (
                <div className="py-4 flex justify-center">
                  {isFetchingNextPage ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</div>
                  ) : (
                    <button onClick={() => fetchNextPage()} className="text-sm text-blue-600 hover:text-blue-800">Muat lebih banyak</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>{products.length > 0 ? `${products.length} produk` : ''}</span>
          <button onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
