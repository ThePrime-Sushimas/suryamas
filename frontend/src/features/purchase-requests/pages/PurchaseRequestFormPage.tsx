import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Save, ClipboardList, Plus } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreatePurchaseRequest, useUpdatePurchaseRequest, usePurchaseRequest } from '../api/purchaseRequests.api'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useUserBranches } from '@/hooks/_shared/useUserBranches'

interface LineItem {
  id: string
  product_id: string
  product_name: string
  product_code: string
  qty: number
  uom: string
  supplier_id: string | null
  supplier_name: string | null
}

export default function PurchaseRequestFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const toast = useToast()

  const [branchId, setBranchId] = useState('')
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10))
  const [neededByDate, setNeededByDate] = useState('')
  const [priority, setPriority] = useState<'normal' | 'medium' | 'high'>('normal')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [showProductModal, setShowProductModal] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Fetch existing PR for edit mode
  const { data: existingPR, isLoading: isLoadingPR } = usePurchaseRequest(id ?? '')

  // Populate form when existing PR is loaded
  useEffect(() => {
    if (!isEdit || initialized || !existingPR) return

    setBranchId(existingPR.branch_id)
    setRequestDate(existingPR.request_date ?? new Date().toISOString().slice(0, 10))
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
        supplier_id: l.supplier_id,
        supplier_name: l.supplier_name ?? null,
      })))
    }

    setInitialized(true)
  }, [existingPR, isEdit, initialized])

  // User's accessible branches
  const branches = useUserBranches()

  // Fetch stock balances for items in lines (based on selected branch — MAIN + READY separate)
  const lineProductIds = lines.map(l => l.product_id)
  const { data: stockData } = useQuery({
    queryKey: ['stock-balances', 'pr-form', branchId, lineProductIds],
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
    enabled: !!branchId && lineProductIds.length > 0,
    staleTime: 30_000,
  })
  const stockMain = stockData?.main ?? {}
  const stockReady = stockData?.ready ?? {}

  const createPR = useCreatePurchaseRequest()
  const updatePR = useUpdatePurchaseRequest()
  const isPending = createPR.isPending || updatePR.isPending

  const addLine = (product: { id: string; name: string; uom_buy: string }, supplier?: { id: string; name: string }) => {
    if (lines.some(l => l.product_id === product.id && l.supplier_id === (supplier?.id ?? null))) {
      toast.error('Produk + supplier sudah ada di daftar')
      return
    }
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      product_code: '',
      qty: 1,
      uom: product.uom_buy,
      supplier_id: supplier?.id ?? null,
      supplier_name: supplier?.name ?? null,
    }])
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
      request_date: requestDate,
      needed_by_date: neededByDate || null,
      priority,
      notes: notes || null,
      lines: lines.map(l => ({
        product_id: l.product_id,
        qty: l.qty,
        uom: l.uom,
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
  if (isEdit && initialized && !['DRAFT', 'PENDING_APPROVAL'].includes(existingPR?.status ?? '')) {
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(isEdit ? `/inventory/purchase-requests/${id}` : '/inventory/purchase-requests')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClipboardList className="w-6 h-6 text-orange-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                {isEdit ? `Edit ${existingPR?.request_number ?? 'PR'}` : 'Buat Purchase Request'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {isEdit ? 'Perbarui permintaan pembelian bahan baku' : 'Permintaan pembelian bahan baku'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isPending || lines.length === 0}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm shrink-0"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{isPending ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Simpan Draft'}</span>
          </button>
        </div>
      </div>

      {/* Form Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cabang *
            </label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              disabled={isEdit}
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
              Tanggal PR *
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={e => setRequestDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
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

      {/* Add Product Button */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <button onClick={() => setShowProductModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      {/* Lines Table - Grouped by Supplier */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
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
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Gudang</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Ready</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {supplierLines.map(l => {
                            const mainStock = stockMain[l.product_id]
                            const readyStock = stockReady[l.product_id]
                            return (
                            <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{l.product_code}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0.01"
                                 
                                  value={l.qty || ''}
                                  onChange={e => updateLine(l.id, 'qty', parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-600 dark:text-gray-400 text-sm">{l.uom}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {branchId && mainStock ? (
                                  <div>
                                    <span className={`text-sm font-mono ${mainStock.qty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {mainStock.qty}
                                    </span>
                                    {mainStock.uom && <span className="text-xs text-gray-400 ml-1">{mainStock.uom}</span>}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {branchId && readyStock ? (
                                  <div>
                                    <span className={`text-sm font-mono ${readyStock.qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                      {readyStock.qty}
                                    </span>
                                    {readyStock.uom && <span className="text-xs text-gray-400 ml-1">{readyStock.uom}</span>}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => removeLine(l.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                            )
                          })}
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

      {/* Product Picker Modal */}
      <ProductPickerModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSelect={(product, supplier) => addLine(product, supplier)}
        branchId={branchId}
        showStock={!!branchId}
        showSupplier
        excludeProductIds={lines.map(l => l.product_id)}
      />
    </div>
  )
}