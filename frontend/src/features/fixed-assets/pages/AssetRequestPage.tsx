import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Save, Package, Plus } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreatePurchaseRequest } from '@/features/purchase-requests/api/purchaseRequests.api'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'
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

export default function AssetRequestPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [branchId, setBranchId] = useState('')
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10))
  const [neededByDate, setNeededByDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [showProductModal, setShowProductModal] = useState(false)

  const branches = useUserBranches()

  const createPR = useCreatePurchaseRequest()
  const isSaving = createPR.isPending

  const supplierCount = new Set(
    lines.map((l) => l.supplier_id ?? '__no_supplier__'),
  ).size
  const branchLabel =
    branches.find((b) => b.id === branchId)?.branch_name ?? null

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
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 item aset'); return }
    const invalidLines = lines.filter(l => l.qty <= 0)
    if (invalidLines.length > 0) { toast.error('Semua qty harus lebih dari 0'); return }

    const payload = {
      branch_id: branchId,
      request_date: requestDate,
      needed_by_date: neededByDate || null,
      priority: 'normal' as const,
      notes: notes ? `[ASSET REQUEST] ${notes}` : '[ASSET REQUEST]',
      lines: lines.map(l => ({
        product_id: l.product_id,
        qty: l.qty,
        uom: l.uom,
        supplier_id: l.supplier_id,
      })),
    }

    try {
      await createPR.mutateAsync(payload)
      toast.success('Asset request berhasil dibuat')
      navigate('/inventory/purchase-requests')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat asset request'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-18">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Package className="w-6 h-6 text-emerald-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                Buat Asset Request
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Permintaan pembelian aset tetap (PO akan otomatis CREDIT)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cabang *
            </label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">Pilih Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Request *
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Catatan
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Deskripsi kebutuhan aset"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800 px-4 sm:px-6 py-3">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          💡 Hanya produk aset yang ditampilkan. Saat di-convert ke PO, payment type otomatis diset CREDIT.
        </p>
      </div>

      {/* Add Product Button */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <button onClick={() => setShowProductModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
          <Plus className="w-4 h-4" /> Tambah Produk Aset
        </button>
      </div>

      {/* Lines Table */}
      <div className="p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {lines.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              Belum ada item. Tambahkan produk aset di atas.
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
                    <div key={supplierId}>
                      {/* Supplier Header */}
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-emerald-100 dark:border-emerald-800">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm">
                            {supplierName}
                          </span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            ({supplierLines.length} item)
                          </span>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px] text-sm">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Qty</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">UOM</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Hapus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {supplierLines.map(l => (
                              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900 dark:text-white">{l.product_name}</div>
                                  {l.product_code && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{l.product_code}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={l.qty || ''}
                                    onChange={e => updateLine(l.id, 'qty', parseInt(e.target.value) || 0)}
                                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-gray-600 dark:text-gray-400 text-sm">{l.uom}</span>
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
                    </div>
                  )
                })
              })()}

              {/* Footer Total */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  Total: {lines.length} item dari {supplierCount} supplier
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {lines.length > 0
                ? `${lines.length} item · ${supplierCount} supplier`
                : 'Belum ada item'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {branchLabel ?? 'Pilih cabang lalu tambah produk aset'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="hidden sm:inline-flex px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || lines.length === 0}
            className="inline-flex items-center justify-center gap-2 min-w-38 sm:min-w-44 px-5 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-emerald-600/25"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Draft'}</span>
          </button>
        </div>
      </div>

      {/* Product Picker Modal - filtered to asset products only */}
      <ProductPickerModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSelect={(product, supplier) => addLine(product, supplier)}
        branchId={branchId}
        showSupplier
        filterAsset
        excludeProductIds={lines.map(l => l.product_id)}
        title="Pilih Produk Aset"
      />
    </div>
  )
}
