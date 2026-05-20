import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { supplierProductsApi } from '@/features/supplier-products'
import { usePricelists, useDeletePricelist, useApprovePricelist, useRestorePricelist, pricelistsApi, usePriceChangeChart } from '../api/pricelists.api'
import { PricelistTable } from '../components/PricelistTable'
import { PriceChangeHistorySection } from '../components/PriceChangeHistorySection'
import { PriceHistoryChart } from '../components/PriceHistoryChart'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DEFAULT_VALUES } from '../constants/pricelist.constants'
import { CardSkeleton } from '@/components/ui/Skeleton'
import type { PricelistListQuery, SortField } from '../types/pricelist.types'

interface SupplierProductContext {
  id: string
  supplier_id: string
  product_id: string
  supplier?: { supplier_name: string }
  product?: { product_name: string }
}

export const SupplierProductPricelistsPage = memo(function SupplierProductPricelistsPage() {
  const { supplierProductId } = useParams<{ supplierProductId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [supplierProduct, setSupplierProduct] = useState<SupplierProductContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [filters, setFilters] = useState<PricelistListQuery>({
    page: DEFAULT_VALUES.PAGE,
    limit: DEFAULT_VALUES.LIMIT,
    sort_by: DEFAULT_VALUES.SORT_BY,
    sort_order: DEFAULT_VALUES.SORT_ORDER
  })

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [approveId, setApproveId] = useState<string | null>(null)

  // Query with context
  const query = useMemo((): PricelistListQuery => ({
    ...filters,
    supplier_id: supplierProduct?.supplier_id,
    product_id: supplierProduct?.product_id,
    include_deleted: showDeleted || undefined,
  }), [filters, supplierProduct, showDeleted])

  // React Query hooks
  const { data, isLoading } = usePricelists(supplierProduct ? query : { page: 1, limit: 1 })
  const deletePL = useDeletePricelist()
  const approvePL = useApprovePricelist()
  const restorePL = useRestorePricelist()

  const pricelists = supplierProduct ? (data?.data ?? []) : []
  const pagination = data?.pagination

  const activePricelist = pricelists.find((p) => p.is_active && p.status === 'APPROVED' && !p.deleted_at)
    ?? pricelists.find((p) => p.status === 'APPROVED' && !p.deleted_at)

  const chartQuery = supplierProduct && activePricelist
    ? {
        supplier_id: supplierProduct.supplier_id,
        product_id: supplierProduct.product_id,
        uom_id: activePricelist.uom_id,
        days: 90,
        limit: 30,
      }
    : null

  const { data: chartData, isLoading: chartLoading } = usePriceChangeChart(chartQuery)

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

  // Fetch supplier product context
  useEffect(() => {
    const controller = new AbortController()
    const fetchContext = async () => {
      if (!supplierProductId) { navigate('/supplier-products'); return }
      try {
        const data = await supplierProductsApi.getById(supplierProductId, true, false, controller.signal)
        if (!controller.signal.aborted) { setSupplierProduct(data); setContextError(null) }
      } catch {
        if (!controller.signal.aborted) setContextError('Gagal memuat konteks produk supplier')
      } finally {
        if (!controller.signal.aborted) setContextLoading(false)
      }
    }
    fetchContext()
    return () => controller.abort()
  }, [supplierProductId, navigate])

  const handleSort = useCallback((field: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: field as SortField,
      sort_order: prev.sort_by === field && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1
    }))
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try { await deletePL.mutateAsync(deleteId); toast.success('Pricelist berhasil dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) }
    finally { setDeleteId(null) }
  }

  const handleRestore = async () => {
    if (!restoreId) return
    try { await restorePL.mutateAsync(restoreId); toast.success('Pricelist berhasil dipulihkan') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan')) }
    finally { setRestoreId(null) }
  }

  const handleApprove = async () => {
    if (!approveId) return
    try { await approvePL.mutateAsync({ id: approveId, status: 'APPROVED' }); toast.success('Pricelist berhasil diapprove') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal approve')) }
    finally { setApproveId(null) }
  }

  const handleExport = useCallback(async () => {
    try {
      const blob = await pricelistsApi.exportCSV(query)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pricelists-${supplierProduct?.supplier?.supplier_name}-${Date.now()}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Ekspor berhasil')
    } catch { toast.error('Gagal mengekspor') }
  }, [query, supplierProduct, toast])

  if (contextLoading) {
    return <div className="flex items-center justify-center min-h-screen"><CardSkeleton /></div>
  }

  if (!supplierProduct || contextError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{contextError || 'Produk supplier tidak ditemukan'}</p>
          <button onClick={() => navigate('/supplier-products')} className="mt-2 text-sm text-blue-600 hover:text-blue-800">Kembali</button>
        </div>
      </div>
    )
  }

  const isMutating = deletePL.isPending || approvePL.isPending || restorePL.isPending

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10">
      {/* Hero */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Supplier · Produk</p>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {supplierProduct.product?.product_name || '—'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {supplierProduct.supplier?.supplier_name || '—'}
              {activePricelist?.uom_name ? ` · ${activePricelist.uom_name}` : ''}
            </p>
            {activePricelist && (
              <p className="text-3xl font-semibold tabular-nums text-gray-900 dark:text-white mt-4">
                {fmtPrice(Number(activePricelist.price))}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/supplier-products')}
              className="px-4 py-2 text-sm rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Kembali
            </button>
            <button onClick={() => navigate(`/supplier-products/${supplierProductId}/pricelists/create`)}
              className="px-4 py-2 text-sm rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700">
              Tambah Harga
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {activePricelist && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 lg:p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Trend 90 hari</p>
          {chartLoading ? (
            <CardSkeleton />
          ) : (
            <PriceHistoryChart
              points={chartData?.points ?? []}
              activePrice={chartData?.active_price ?? Number(activePricelist.price)}
            />
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kelola Harga</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Semua versi harga untuk kombinasi ini</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Terhapus</span>
          </label>
          <button onClick={handleExport} disabled={isLoading || pricelists.length === 0}
            className="px-4 py-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm">
            Ekspor CSV
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden p-4 lg:p-6">
        <PricelistTable
        data={pricelists}
        loading={isLoading}
        onEdit={id => navigate(`/supplier-products/${supplierProductId}/pricelists/${id}/edit`)}
        onDelete={setDeleteId}
        onRestore={setRestoreId}
        onView={id => navigate(`/supplier-products/${supplierProductId}/pricelists/${id}`)}
        onApprove={setApproveId}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={handleSort}
        showDeleted={showDeleted}
      />
      </div>

      {pagination && pagination.total > 0 && (
        <Pagination
          pagination={pagination}
          onPageChange={p => setFilters(prev => ({ ...prev, page: p }))}
          onLimitChange={l => setFilters(prev => ({ ...prev, limit: l, page: 1 }))}
          currentLength={pricelists.length}
          loading={isLoading}
        />
      )}

      <PriceChangeHistorySection
        supplierId={supplierProduct.supplier_id}
        productId={supplierProduct.product_id}
        uomId={activePricelist?.uom_id}
        compact
      />

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Hapus Pricelist" message="Yakin ingin menghapus pricelist ini?"
        confirmText="Hapus" variant="danger" isLoading={deletePL.isPending} />
      <ConfirmModal isOpen={!!restoreId} onClose={() => setRestoreId(null)} onConfirm={handleRestore}
        title="Pulihkan Pricelist" message="Yakin ingin memulihkan pricelist ini?"
        confirmText="Pulihkan" variant="success" isLoading={restorePL.isPending} />
      <ConfirmModal isOpen={!!approveId} onClose={() => setApproveId(null)} onConfirm={handleApprove}
        title="Approve Pricelist" message="Yakin ingin approve pricelist ini?"
        confirmText="Approve" variant="success" isLoading={approvePL.isPending} />

      {isMutating && (
        <div className="fixed inset-0 bg-gray-900/20 dark:bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Memproses...</p>
          </div>
        </div>
      )}
    </div>
  )
})
