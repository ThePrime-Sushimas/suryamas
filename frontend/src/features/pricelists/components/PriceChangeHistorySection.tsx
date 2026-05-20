import { useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { Pagination } from '@/components/ui/Pagination'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { usePriceChanges } from '../api/pricelists.api'
import { PriceChangeStats } from './PriceChangeStats'
import { PriceChangeCard } from './PriceChangeCard'
import type { PriceChangeListQuery } from '../types/pricelist.types'

interface PriceChangeHistorySectionProps {
  supplierId?: string
  productId?: string
  uomId?: string
  compact?: boolean
}

export function PriceChangeHistorySection({
  supplierId,
  productId,
  uomId,
  compact = false,
}: PriceChangeHistorySectionProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const debouncedSearch = useDebounce(search, 400)

  const query = useMemo(
    (): PriceChangeListQuery => ({
      page,
      limit: compact ? 10 : 20,
      supplier_id: supplierId,
      product_id: productId,
      uom_id: uomId,
      search: debouncedSearch || undefined,
      source: (source || undefined) as PriceChangeListQuery['source'],
    }),
    [page, compact, supplierId, productId, uomId, debouncedSearch, source],
  )

  const { data, isLoading } = usePriceChanges(query)
  const items = data?.items ?? []
  const summary = data?.summary
  const pagination = data?.pagination

  return (
    <section className="space-y-6">
      {!compact && (
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">
            Riwayat Perubahan Harga
          </p>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            Timeline harga
          </h2>
        </div>
      )}

      <PriceChangeStats summary={summary} loading={isLoading && !data} />

      {!compact && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari produk, supplier, invoice..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          >
            <option value="">Semua sumber</option>
            <option value="PI_POST">Invoice</option>
            <option value="MANUAL">Manual</option>
            <option value="PI_UNPOST">Unpost</option>
          </select>
        </div>
      )}

      <div className="space-y-3">
        {isLoading && !items.length ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center">
            <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="font-medium text-gray-900 dark:text-white">Belum ada perubahan harga</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              Riwayat muncul otomatis saat post Purchase Invoice atau input harga manual.
            </p>
          </div>
        ) : (
          items.map((change) => <PriceChangeCard key={change.id} change={change} />)
        )}
      </div>

      {pagination && pagination.total > 0 && (
        <Pagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={() => setPage(1)}
          currentLength={items.length}
          loading={isLoading}
        />
      )}
    </section>
  )
}
