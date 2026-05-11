import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Save, ClipboardList } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { useCreatePurchaseRequest, useUpdatePurchaseRequest, usePurchaseRequest } from '../api/purchaseRequests.api'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

interface LineItem {
  id: string
  product_id: string
  product_name: string
  product_code: string
  qty: number
  uom: string
  estimated_price: number | null
  supplier_id: string | null
  supplier_name: string | null
}

export default function PurchaseRequestFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const toast = useToast()

  const [branchId, setBranchId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [neededByDate, setNeededByDate] = useState('')
  const [priority, setPriority] = useState<'normal' | 'medium' | 'high'>('normal')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [initialized, setInitialized] = useState(false)

  const debouncedProductSearch = useDebounce(productSearch, 400)

  // Fetch existing PR for edit mode
  const { data: existingPR, isLoading: isLoadingPR } = usePurchaseRequest(id ?? '')

  // Populate form when existing PR is loaded
  useEffect(() => {
    if (!isEdit || initialized || !existingPR) return

    setBranchId(existingPR.branch_id)
    setNeededByDate(existingPR.needed_by_date ?? '')
    setNotes(existingPR.notes ?? '')

    if (existingPR.lines) {
      setLines(existingPR.lines.map(l => ({
        id: l.id ?? crypto.randomUUID(),
        product_id: l.product_id,
        product_name: l.product_name ?? '',
        product_code: l.product_code ?? '',
        qty: l.qty,
        uom: l.uom,
        estimated_price: l.estimated_price,
        supplier_id: l.supplier_id,
        supplier_name: l.supplier_name ?? null,
      })))
    }

    setInitialized(true)
  }, [existingPR, isEdit, initialized])

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/branches', { params: { status: 'active', limit: 50 } })
      return data.data as { id: string; branch_name: string; branch_code: string }[]
    },
    staleTime: 120_000,
  })
  const branches = branchesData ?? []

  // Fetch categories for product filter
  const { data: categoriesData } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/categories', { params: { limit: 50 } })
      return data.data as { id: string; category_name: string }[]
    },
    staleTime: 120_000,
  })
  const categories = categoriesData ?? []

  // Fetch stock balances for items in lines (based on selected branch)
  const lineProductIds = lines.map(l => l.product_id)
  const { data: stockByProduct } = useQuery({
    queryKey: ['stock-balances', 'pr-form', branchId, lineProductIds],
    queryFn: async () => {
      // Fetch all stock for this branch's MAIN warehouse, filter client-side
      const { data } = await api.get('/stock/balances', { params: { branch_id: branchId, warehouse_type: 'MAIN', limit: 200 } })
      const map: Record<string, number> = {}
      for (const row of (data.data ?? [])) map[row.product_id] = parseFloat(row.qty)
      return map
    },
    enabled: !!branchId && lineProductIds.length > 0,
    staleTime: 30_000,
  })

  // Search products (filtered by category if selected)
  const { data: productsData } = useQuery({
    queryKey: ['products', 'search-pr', debouncedProductSearch, categoryFilter],
    queryFn: async () => {
      const params: Record<string, string> = { q: debouncedProductSearch, limit: '20' }
      if (categoryFilter) params.category_id = categoryFilter
      const { data } = await api.get('/products/search', { params })
      return data.data as { id: string; product_code: string; product_name: string; base_unit_name: string | null }[]
    },
    enabled: debouncedProductSearch.length >= 2,
    staleTime: 30_000,
  })
  const products = productsData ?? []

  // Batch fetch purchase UOM for search results
  const productIdsForUom = products.map(p => p.id)
  const { data: purchaseUomsByProduct } = useQuery({
    queryKey: ['product-uoms', 'purchase-units', productIdsForUom],
    queryFn: async () => {
      const results = await Promise.all(
        productIdsForUom.map(async (id) => {
          try {
            const { data } = await api.get(`/products/${id}/uoms/purchase-unit`)
            return { productId: id, uom: data.data?.unit_name ?? 'pcs' }
          } catch {
            return { productId: id, uom: 'pcs' }
          }
        })
      )
      return results.reduce((acc, r) => ({ ...acc, [r.productId]: r.uom }), {} as Record<string, string>)
    },
    enabled: productIdsForUom.length > 0,
    staleTime: 60_000,
  })

  // Batch fetch suppliers for search results
  const productIds = products.map(p => p.id)
  const { data: suppliersByProduct } = useQuery({
    queryKey: ['supplier-products', 'by-products', productIds],
    queryFn: async () => {
      const { data } = await api.post('/supplier-products/by-products', { product_ids: productIds })
      return data.data as Record<string, { supplier_id: string; supplier_name: string }[]>
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
  })

  const createPR = useCreatePurchaseRequest()
  const updatePR = useUpdatePurchaseRequest()
  const isPending = createPR.isPending || updatePR.isPending

  const addLine = (product: { id: string; product_name: string; base_unit_name: string | null }, supplier?: { supplier_id: string; supplier_name: string }) => {
    if (lines.some(l => l.product_id === product.id && l.supplier_id === (supplier?.supplier_id ?? null))) {
      toast.error('Produk + supplier sudah ada di daftar')
      return
    }
    const purchaseUom = purchaseUomsByProduct?.[product.id] ?? product.base_unit_name ?? 'pcs'
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.product_name,
      product_code: '',
      qty: 1,
      uom: purchaseUom,
      estimated_price: null,
      supplier_id: supplier?.supplier_id ?? null,
      supplier_name: supplier?.supplier_name ?? null,
    }])
    setProductSearch('')
  }

  const updateLine = (lineId: string, field: keyof LineItem, value: unknown) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: value } : l))
  }

  const removeLine = (lineId: string) => setLines(prev => prev.filter(l => l.id !== lineId))

  const handleSubmit = async () => {
    if (!branchId) { toast.error('Pilih cabang'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 item'); return }
    const invalidLines = lines.filter(l => l.qty <= 0)
    if (invalidLines.length > 0) { toast.error('Semua qty harus lebih dari 0'); return }

    const payload = {
      needed_by_date: neededByDate || null,
      priority,
      notes: notes || null,
      lines: lines.map(l => ({
        product_id: l.product_id,
        qty: l.qty,
        uom: l.uom,
        estimated_price: l.estimated_price,
        supplier_id: l.supplier_id,
      })),
    }

    try {
      if (isEdit && id) {
        await updatePR.mutateAsync({ id, ...payload })
        toast.success('Purchase request berhasil diperbarui')
      } else {
        await createPR.mutateAsync({ branch_id: branchId, ...payload })
        toast.success('Purchase request berhasil dibuat')
      }
      navigate('/inventory/purchase-requests')
    } catch (err: unknown) {
      toast.error(parseApiError(err, isEdit ? 'Gagal memperbarui purchase request' : 'Gagal membuat purchase request'))
    }
  }

  // Loading state for edit mode
  if (isEdit && isLoadingPR) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // PR not found or wrong status for edit
  if (isEdit && initialized && existingPR?.status !== 'DRAFT') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Purchase request ini tidak bisa diedit (status: {existingPR?.status})
          </p>
          <button
            onClick={() => navigate(`/inventory/purchase-requests/${id}`)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
          >
            Kembali ke Detail
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(isEdit ? `/inventory/purchase-requests/${id}` : '/inventory/purchase-requests')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClipboardList className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEdit ? `Edit ${existingPR?.request_number ?? 'Purchase Request'}` : 'Buat Purchase Request'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isEdit ? 'Perbarui permintaan pembelian bahan baku' : 'Permintaan pembelian bahan baku'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isPending || lines.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
          </button>
        </div>
      </div>

      {/* Form Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cabang *
            </label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              disabled={isEdit} // Cabang tidak bisa diubah saat edit
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Pilih Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
            {isEdit && (
              <p className="mt-1 text-xs text-gray-400">Cabang tidak dapat diubah setelah PR dibuat</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dibutuhkan Tanggal
            </label>
            <input
              type="date"
              value={neededByDate}
              onChange={e => setNeededByDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioritas</label>
            <select value={priority} onChange={e => setPriority(e.target.value as 'normal' | 'medium' | 'high')}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${priority === 'high' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="normal">Normal</option>
              <option value="medium">Sedang</option>
              <option value="high">Tinggi ⚠️</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Catatan
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Opsional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Add Product */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tambah Produk
        </label>
        <div className="flex gap-3">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
          </select>
          <input
            type="text"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Ketik min. 2 karakter untuk cari produk..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
        {debouncedProductSearch.length >= 2 && products.length > 0 && (
          <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-60 overflow-auto bg-white dark:bg-gray-800 shadow-lg">
            {products.map(p => {
              const suppliers = suppliersByProduct?.[p.id] ?? []
              return (
                <div key={p.id} className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{p.product_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">UOM Beli: {purchaseUomsByProduct?.[p.id] ?? p.base_unit_name ?? 'pcs'}</div>
                  {suppliers.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {suppliers.map(s => (
                        <button key={s.supplier_id} onClick={() => addLine(p, s)}
                          className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                          {s.supplier_name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => addLine(p)}
                      className="mt-1.5 px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded text-xs hover:bg-gray-200">
                      + Tambah (tanpa supplier)
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {debouncedProductSearch.length >= 2 && products.length === 0 && (
          <p className="mt-2 text-sm text-gray-400">Produk tidak ditemukan</p>
        )}
      </div>

      {/* Lines Table - Grouped by Supplier */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {lines.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              Belum ada item. Cari dan tambahkan produk di atas.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Group lines by supplier */}
              {(() => {
                const grouped = lines.reduce((acc, line) => {
                  const key = line.supplier_id ?? '__no_supplier__'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(line)
                  return acc
                }, {} as Record<string, LineItem[]>)

                return Object.entries(grouped).map(([supplierId, supplierLines]) => {
                  const supplierName = supplierLines[0].supplier_name ?? 'Tanpa Supplier'
                  return (
                    <div key={supplierId} className="">
                      {/* Supplier Header */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-blue-100 dark:border-blue-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                              {supplierName}
                            </span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              ({supplierLines.length} item)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Qty</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">UOM</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Stock</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {supplierLines.map(l => (
                            <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{l.product_code}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={l.qty || ''}
                                  onChange={e => updateLine(l.id, 'qty', parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-600 dark:text-gray-400 text-sm">{l.uom}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {branchId && stockByProduct ? (
                                  <span className={`text-sm font-mono ${(stockByProduct[l.product_id] ?? 0) < l.qty ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {stockByProduct[l.product_id] ?? 0}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => removeLine(l.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })
              })()}

              {/* Footer Total */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  Total: {lines.length} item dari {Object.keys(lines.reduce((acc, l) => ({ ...acc, [l.supplier_id ?? '__no_supplier__']: true }), {})).length} supplier
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}